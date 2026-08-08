/**
 * GET /api/admin/users — every app user, with a signup date that is always
 * present.
 *
 * WHY THIS EXISTS
 * The Users tab read `users` with the client SDK and showed "Joined" from
 * `createdAt`. That field is written by the iOS profile save, not at account
 * creation, so it's missing for two whole cohorts:
 *   - legacy accounts created before the field existed (shipped in 1.0.3)
 *   - anyone who signed up but hasn't finished onboarding yet
 * Those users rendered with a blank date and sorted to the very bottom of
 * the list, which reads as "the dashboard isn't pulling all users".
 *
 * Firestore stamps every document with a server `createTime` that cannot be
 * missing — but the client SDK doesn't expose it, only the Admin SDK does.
 * So we read server-side and resolve a guaranteed `joinedAt`:
 *     createdAt  ??  updatedAt  ?? server createTime
 * The tab sorts and displays on that, so no user can be dateless again.
 *
 * Admin-only (Firebase ID token → ADMIN_EMAILS).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-gate";
import { adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Firestore Timestamp | epoch seconds | epoch ms → epoch ms. */
function toMillis(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "object" && typeof (v as { toDate?: () => Date }).toDate === "function") {
    return (v as { toDate: () => Date }).toDate().getTime();
  }
  if (typeof v === "number") {
    // iOS writes epoch SECONDS for updatedAt; anything below ~1e12 is seconds.
    return v < 1e12 ? v * 1000 : v;
  }
  return null;
}

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    const snap = await adminDb().collection("users").get();

    const users = snap.docs.map((d) => {
      const data = d.data();
      const created = toMillis(data.createdAt);
      const updated = toMillis(data.updatedAt);
      // createTime is server metadata: always present, never client-writable.
      const serverCreated = d.createTime ? d.createTime.toDate().getTime() : null;

      return {
        ...data,
        id: d.id,
        uid: d.id,
        // Normalized to epoch ms so the client formats without Firestore types.
        createdAt: created,
        updatedAt: updated,
        /** Guaranteed signup date. Never null. */
        joinedAt: created ?? updated ?? serverCreated,
        /** True when the date came from document metadata, not a written
         *  field — the tab labels these so an approximate date isn't
         *  mistaken for a recorded one. */
        joinedAtApprox: created == null && updated == null,
        /** Signed up but never finished the profile step. Worth surfacing:
         *  these accounts have almost no profile data. */
        incompleteOnboarding: data.hasCompletedOnboarding !== true,
      };
    });

    return NextResponse.json({ ok: true, users, count: users.length });
  } catch (e) {
    console.error("[/api/admin/users]", e);
    return NextResponse.json(
      { ok: false, error: (e as Error).message, users: [] },
      { status: 500 }
    );
  }
}
