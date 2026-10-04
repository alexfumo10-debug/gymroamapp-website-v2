/**
 * Derive affiliate referrals from code-tagged signups.
 *
 * THE GAP THIS CLOSES
 * When someone enters a creator code during onboarding, the iOS app records
 * it on the user document as `acquisition.creatorCode`. The creator dashboard
 * and the commission engine read `affiliateReferrals` — a collection the app
 * never writes. Without this, a creator drives real signups and their
 * dashboard sits at zero: clicks logged by /r/{code}, nothing after.
 *
 * WHY THIS LIVES IN A LIB AND NOT JUST A ROUTE
 * It first shipped as its own Vercel cron (09:15 daily) and never fired once
 * in 47 days — proven by a `syncedAt` stamp frozen at the manual run that
 * seeded it, when the sync rewrites that stamp on every pass. Rather than
 * depend on a second cron slot that silently does nothing, the logic lives
 * here so the App Store ingest cron — which demonstrably runs daily — can
 * drive it too. One proven schedule beats two configured ones.
 *
 * IDEMPOTENT: the referral doc id IS the user's uid, so re-running updates in
 * place instead of duplicating. Safe to call from several places per day.
 *
 * DELIBERATELY NOT SET: `proConvertedAt` and `originalTransactionId`. Those
 * need Apple transaction data we don't have server-side, and the commission
 * engine skips any referral without them — better a funnel that stops
 * honestly at "signed up" than one that invents conversions.
 */

import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export interface ReferralSyncResult {
  usersScanned: number;
  matched: number;
  written: number;
  perCode: Record<string, number>;
  unknownCodes: string[];
}

/** Fold a code the same way iOS and the dashboard both do. */
function normalize(raw: string): string {
  return String(raw || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/@/g, "")
    .trim()
    .toLowerCase();
}

export async function syncAffiliateReferrals(): Promise<ReferralSyncResult> {
  const db = adminDb();

  // Live codes, by normalized form → the canonical stored code. A referral is
  // only created for a code that actually belongs to someone.
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

  // Batched so a few hundred users is one round trip per 400, not one each.
  let batch = db.batch();
  let pending = 0;

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
      // Typo, retired code, or a creator who was removed. Counted, not written.
      unknownCodes.add(norm);
      continue;
    }
    matched++;
    perCode[canonical] = (perCode[canonical] || 0) + 1;

    const signedUpAt =
      acq?.at && typeof acq.at.toDate === "function"
        ? acq.at.toDate()
        : doc.createTime?.toDate() || null;

    batch.set(
      db.collection("affiliateReferrals").doc(doc.id), // uid as id → idempotent
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
    pending++;

    if (pending >= 400) {
      await batch.commit();
      batch = db.batch();
      pending = 0;
    }
  }

  if (pending > 0) await batch.commit();

  return {
    usersScanned: usersSnap.size,
    matched,
    written,
    perCode,
    unknownCodes: [...unknownCodes],
  };
}
