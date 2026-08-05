/**
 * POST /api/admin/creator-grant — grant bonus Pro to everyone who signed up
 * with a given creator code.
 *
 * A creator (say @chloe) tells their audience to enter their code during
 * onboarding; iOS writes it to `users/{uid}.acquisition.creatorCode`. This
 * route finds those users and extends each one's Pro comp window by N days,
 * reusing the same `proAccessUntil` field the iOS app (2.3+) already reads,
 * so it lights up every Pro feature with no app update.
 *
 * IDEMPOTENT by design: each granted user is stamped in
 * `proCodeGrants[<code>]`. Re-running the same code skips anyone already
 * granted for it and only rewards NEW signups, so it's safe to click again
 * as the creator's numbers grow.
 *
 * Extension is additive from whichever is later: now, or their existing
 * proAccessUntil (so a comped user's window is extended, never shortened).
 *
 * Admin-only (Firebase ID token → ADMIN_EMAILS).
 *
 * Body: { code: string, days?: number, dryRun?: boolean }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminContext } from "@/lib/admin-gate";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_DAYS = 7;
const MAX_DAYS = 365;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Matches iOS normalizeCreatorCode (strip @, trim, lowercase) + strips accents. */
function normalizeCode(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/@/g, "")
    .trim()
    .toLowerCase();
}

/** Firestore-safe map key (letters, digits, underscore only). */
function safeKey(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase();
}

interface Body {
  code?: string;
  days?: number;
  dryRun?: boolean;
}

export async function POST(req: NextRequest) {
  const { denied, email: adminEmail } = await requireAdminContext(req);
  if (denied) return denied;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
  }

  const code = normalizeCode(body.code || "");
  if (!code) {
    return NextResponse.json({ ok: false, error: "missing code" }, { status: 400 });
  }
  const grantKey = safeKey(code);
  const daysRaw = Number(body.days);
  const days =
    Number.isFinite(daysRaw) && daysRaw > 0 ? Math.min(daysRaw, MAX_DAYS) : DEFAULT_DAYS;
  const dryRun = body.dryRun === true;

  try {
    const snap = await adminDb().collection("users").get();
    const now = Date.now();
    const matched: { uid: string; name: string; alreadyGranted: boolean }[] = [];

    snap.forEach((doc) => {
      const d = doc.data();
      const acq = d.acquisition as { creatorCode?: string } | undefined;
      const raw = acq?.creatorCode;
      if (!raw || normalizeCode(String(raw)) !== code) return;
      const grants = (d.proCodeGrants || {}) as Record<string, unknown>;
      matched.push({
        uid: doc.id,
        name: (d.displayName as string) || (d.username as string) || doc.id,
        alreadyGranted: Object.prototype.hasOwnProperty.call(grants, grantKey),
      });
    });

    const toGrant = matched.filter((m) => !m.alreadyGranted);

    if (dryRun) {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        code,
        days,
        matched: matched.length,
        wouldGrant: toGrant.length,
        alreadyGranted: matched.length - toGrant.length,
        users: toGrant.map((m) => m.name),
      });
    }

    const results: { uid: string; name: string; newUntil: string }[] = [];
    for (const m of toGrant) {
      const ref = adminDb().collection("users").doc(m.uid);
      const cur = await ref.get();
      const existing = cur.data()?.proAccessUntil as { toDate?: () => Date } | undefined;
      const base =
        existing && typeof existing.toDate === "function"
          ? Math.max(now, existing.toDate().getTime())
          : now;
      const until = new Date(base + days * DAY_MS);
      await ref.set(
        {
          proAccessUntil: Timestamp.fromDate(until),
          proGrantReason: `Creator code @${code} (+${days}d)`,
          proGrantedBy: adminEmail,
          proGrantedAt: FieldValue.serverTimestamp(),
          [`proCodeGrants.${grantKey}`]: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      results.push({ uid: m.uid, name: m.name, newUntil: until.toISOString() });
    }

    return NextResponse.json({
      ok: true,
      code,
      days,
      matched: matched.length,
      granted: results.length,
      skippedAlreadyGranted: matched.length - toGrant.length,
      users: results,
    });
  } catch (e) {
    console.error("[/api/admin/creator-grant]", e);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
