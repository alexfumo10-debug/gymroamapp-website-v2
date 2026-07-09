/**
 * POST /api/admin/pro-grant — grant or revoke a GymRoam Pro comp on a user.
 *
 * Writes a server-only entitlement window to the user's Firestore doc:
 *   proAccessUntil  (Timestamp)  — Pro is comped while this is in the future.
 *
 * The iOS app (2.3+) reads `proAccessUntil` and ORs it into
 * `UserStore.isProMember`, so a grant lights up EVERY Pro feature with NO
 * app update — this single Firestore write is all it takes. Used to comp
 * influencers / testers / partners without touching StoreKit.
 *
 * Admin-only (Firebase ID token → ADMIN_EMAILS). The Admin SDK write
 * bypasses Firestore rules; the matching rule change that blocks a CLIENT
 * from self-writing the `pro*` fields lives in the iOS repo's
 * firestore.rules — see the engineering hand-off spec.
 *
 * Body:
 *   { uid: string,
 *     action: "grant" | "revoke",
 *     durationDays?: number | "permanent",   // grant only; default 365
 *     reason?: string }                       // grant only; optional label
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminContext } from "@/lib/admin-gate";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// "Permanent" comps store a far-future date so the iOS read stays a single
// `proAccessUntil > now` comparison with no special-casing.
const PERMANENT_UNTIL = new Date("2999-12-31T00:00:00Z");
const MAX_DURATION_DAYS = 3650; // 10y guardrail on a finite grant
const DEFAULT_DURATION_DAYS = 365;

interface Body {
  uid?: string;
  action?: string;
  durationDays?: number | "permanent";
  reason?: string;
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

  const uid = (body.uid || "").trim();
  const action = body.action;
  if (!uid) {
    return NextResponse.json({ ok: false, error: "missing uid" }, { status: 400 });
  }
  if (action !== "grant" && action !== "revoke") {
    return NextResponse.json(
      { ok: false, error: "action must be 'grant' or 'revoke'" },
      { status: 400 }
    );
  }

  const userRef = adminDb().collection("users").doc(uid);

  // Guard against typos / orphan uids — only write to a doc that exists.
  const snap = await userRef.get();
  if (!snap.exists) {
    return NextResponse.json(
      { ok: false, error: "no user doc for that uid" },
      { status: 404 }
    );
  }

  try {
    if (action === "revoke") {
      await userRef.set(
        {
          proAccessUntil: FieldValue.delete(),
          proRevokedBy: adminEmail,
          proRevokedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return NextResponse.json({ ok: true, action, uid, proAccessUntil: null });
    }

    // grant
    let until: Date;
    if (body.durationDays === "permanent") {
      until = PERMANENT_UNTIL;
    } else {
      const days = Number(body.durationDays);
      const safeDays =
        Number.isFinite(days) && days > 0
          ? Math.min(days, MAX_DURATION_DAYS)
          : DEFAULT_DURATION_DAYS;
      until = new Date(Date.now() + safeDays * 24 * 60 * 60 * 1000);
    }
    const reason = (body.reason || "").toString().trim().slice(0, 200);

    await userRef.set(
      {
        proAccessUntil: Timestamp.fromDate(until),
        proGrantReason: reason || null,
        proGrantedBy: adminEmail,
        proGrantedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    return NextResponse.json({
      ok: true,
      action,
      uid,
      proAccessUntil: until.toISOString(),
      proGrantReason: reason || null,
    });
  } catch (e) {
    console.error("[/api/admin/pro-grant]", e);
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
