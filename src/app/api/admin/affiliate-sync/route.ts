/**
 * POST|GET /api/admin/affiliate-sync — turn code-tagged signups into referrals.
 *
 * THE GAP THIS CLOSES
 * When someone enters a creator code during onboarding, the iOS app records it
 * on the user document as `acquisition.creatorCode`. But the creator dashboard
 * (and the commission engine) read `affiliateReferrals` — a collection the app
 * never writes. So a creator could send real signups and their dashboard would
 * sit at zero forever: clicks logged by /r/{code}, and nothing after.
 *
 * Rather than wait on an app release to write referrals directly, this derives
 * them server-side from data the app already records. Nothing to ship in the
 * binary, works for every build already in the wild.
 *
 * IDEMPOTENT: the referral doc id IS the user's uid, so re-running updates in
 * place instead of duplicating. Safe on a schedule and safe to hit twice.
 *
 * DELIBERATELY NOT SET: `proConvertedAt` and `originalTransactionId`. Those
 * require Apple transaction data we don't have server-side yet, and the
 * commission engine skips any referral without them — better a funnel that
 * stops honestly at "signed up" than one that invents conversions.
 *
 * Auth: admin Firebase token, OR the CRON_SECRET bearer so a schedule can
 * drive it (same pattern as the App Store ingest route).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-gate";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Fold a code the same way iOS and the dashboard both do. */
function normalize(raw: string): string {
  return String(raw || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/@/g, "")
    .trim()
    .toLowerCase();
}

function isCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

async function sync(req: NextRequest) {
  if (!isCron(req)) {
    const denied = await requireAdmin(req);
    if (denied) return denied;
  }

  try {
    const db = adminDb();

    // Live codes, by normalized form → the canonical stored code. A referral
    // is only created for a code that actually belongs to someone.
    const codesSnap = await db.collection("affiliateCodes").get();
    const liveCodes = new Map<string, string>();
    codesSnap.forEach((d) => {
      const data = d.data();
      if (data.active === false) return;
      liveCodes.set(normalize(d.id), (data.code as string) || d.id);
    });

    const usersSnap = await db.collection("users").get();

    let matched = 0;
    let written = 0;
    const unknownCodes = new Set<string>();
    const perCode: Record<string, number> = {};

    for (const doc of usersSnap.docs) {
      const data = doc.data();
      const acq = data.acquisition as
        | { creatorCode?: string; at?: { toDate?: () => Date } }
        | undefined;
      const raw = acq?.creatorCode;
      if (!raw) continue;

      const norm = normalize(String(raw));
      const canonical = liveCodes.get(norm);
      if (!canonical) {
        // Typo, retired code, or a creator who was deleted. Counted, not written.
        unknownCodes.add(norm);
        continue;
      }
      matched++;
      perCode[canonical] = (perCode[canonical] || 0) + 1;

      const signedUpAt =
        acq?.at && typeof acq.at.toDate === "function"
          ? acq.at.toDate()
          : doc.createTime?.toDate() || null;

      await db
        .collection("affiliateReferrals")
        .doc(doc.id) // uid as the id → idempotent
        .set(
          {
            code: canonical,
            userId: doc.id,
            ...(signedUpAt ? { signedUpAt } : {}),
            source: "acquisition", // derived, not app-reported
            syncedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      written++;
    }

    return NextResponse.json({
      ok: true,
      usersScanned: usersSnap.size,
      matched,
      written,
      perCode,
      unknownCodes: [...unknownCodes],
    });
  } catch (e) {
    console.error("[/api/admin/affiliate-sync]", e);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}

export const POST = sync;
export const GET = sync;
