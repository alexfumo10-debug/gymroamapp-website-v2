/**
 * GET /api/admin/pro-members — the real, named list of who has GymRoam Pro.
 *
 * Apple's subscription reports are AGGREGATE + anonymized — they never tell
 * you which user bought. So the identity of Pro members comes from our own
 * Firestore /users docs, where each user's device/entitlement state is
 * mirrored. Three buckets:
 *
 *   • purchased — badge `isPro:true` and NO Pro grant → a real App Store
 *     subscriber (the person who actually paid).
 *   • comped    — `proAccessUntil` in the future → Pro we granted from the
 *     panel. (A stale badge on an expired grant is shown here, flagged.)
 *   • founder   — handle @alex / @kevin → always Pro, separate.
 *
 * Emails are the canonical Firebase Auth email (not a stale user-doc value).
 * Admin-only (Firebase ID token → ADMIN_EMAILS).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-gate";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Founder handles get Pro via the in-app `isFounder` gate (not a stored
// flag) — the reserved handle IS the signal, matching UsernameValidator.
const FOUNDER_HANDLES = new Set(["alex", "kevin"]);
// A grant past this reads as "permanent" (the panel stores permanent as 2999).
const PERMANENT_MS = Date.parse("2900-01-01T00:00:00Z");

type Source = "purchased" | "comped" | "founder";

interface ProMember {
  uid: string;
  name: string;
  username: string | null;
  email: string | null;
  source: Source;
  proAccessUntil: string | null; // ISO — comped only
  permanent: boolean;
  badgeActive: boolean; // isPro on the doc = the user's device has activated Pro
  expiredComp: boolean; // stale badge on a lapsed grant
}

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const [usersSnap, authList] = await Promise.all([
    adminDb().collection("users").get(),
    adminAuth().listUsers(1000),
  ]);

  const emailByUid: Record<string, string | null> = {};
  authList.users.forEach((u) => {
    emailByUid[u.uid] = u.email || null;
  });

  const now = Date.now();
  const purchased: ProMember[] = [];
  const comped: ProMember[] = [];
  const founders: ProMember[] = [];

  usersSnap.forEach((doc) => {
    const d = doc.data();
    const handle = String(d.username || "").replace(/^@+/, "").toLowerCase();
    const badgeActive = d.isPro === true;
    const until = d.proAccessUntil as { toDate?: () => Date } | undefined;
    const untilMs = until && typeof until.toDate === "function" ? until.toDate().getTime() : 0;

    const base: Omit<ProMember, "source"> = {
      uid: doc.id,
      name:
        (d.displayName as string) ||
        (d.username as string) ||
        emailByUid[doc.id] ||
        doc.id,
      username: (d.username as string) || null,
      email: emailByUid[doc.id] ?? (d.email as string) ?? null,
      proAccessUntil: untilMs ? new Date(untilMs).toISOString() : null,
      permanent: untilMs > PERMANENT_MS,
      badgeActive,
      expiredComp: false,
    };

    if (FOUNDER_HANDLES.has(handle)) {
      founders.push({ ...base, source: "founder", proAccessUntil: null, permanent: false });
    } else if (untilMs > now) {
      comped.push({ ...base, source: "comped" });
    } else if (badgeActive && untilMs === 0) {
      // Badge on, never granted → real purchaser.
      purchased.push({ ...base, source: "purchased", proAccessUntil: null });
    } else if (badgeActive && untilMs > 0) {
      // Badge still on but the grant lapsed — surfaced, flagged (their device
      // will demote the badge on next launch).
      comped.push({ ...base, source: "comped", expiredComp: true });
    }
    // else: not Pro — skip.
  });

  // Comped: soonest-expiring first, permanent last.
  comped.sort(
    (a, b) =>
      (a.permanent ? 1 : 0) - (b.permanent ? 1 : 0) ||
      (Date.parse(a.proAccessUntil || "") || Infinity) -
        (Date.parse(b.proAccessUntil || "") || Infinity)
  );

  return NextResponse.json({
    counts: {
      purchased: purchased.length,
      comped: comped.length,
      founders: founders.length,
      total: purchased.length + comped.length + founders.length,
    },
    purchased,
    comped,
    founders,
    asOf: new Date().toISOString(),
  });
}
