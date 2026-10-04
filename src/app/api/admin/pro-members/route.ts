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
 *
 *     CAVEAT, surfaced per row: `isPro` is written by the USER'S DEVICE and
 *     only cleared by that device on a later launch. Nothing server-side ever
 *     learns about a cancellation — Apple's reports are anonymous — so a
 *     subscriber who cancels and stops opening the app keeps a true badge
 *     indefinitely. Each row therefore carries when the account last
 *     contacted Firebase, and `unconfirmed` when that is old enough that the
 *     badge can no longer be trusted. Real fix is App Store Server
 *     Notifications; until then the dashboard says what it knows.
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
// No device contact in this long → the isPro badge can't be trusted. Set
// above a monthly cycle so an annual subscriber who checks in occasionally
// isn't flagged, but a churned account surfaces within a billing period.
const UNCONFIRMED_AFTER_DAYS = 30;

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
  /** Last time the account contacted Firebase at all (ISO) — the only proof
   *  the badge is still being reaffirmed by a real device. */
  lastSeen: string | null;
  /** Days since that contact. null when the account has never been seen. */
  lastSeenDays: number | null;
  /** Purchased badge we can no longer verify: no device contact in
   *  UNCONFIRMED_AFTER_DAYS. They may have cancelled and walked away. */
  unconfirmed: boolean;
}

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const [usersSnap, authList] = await Promise.all([
    adminDb().collection("users").get(),
    adminAuth().listUsers(1000),
  ]);

  const emailByUid: Record<string, string | null> = {};
  // Last contact: a token refresh means the app actually ran, which is
  // stronger evidence than a sign-in that could be months old.
  const lastSeenByUid: Record<string, number | null> = {};
  authList.users.forEach((u) => {
    emailByUid[u.uid] = u.email || null;
    const refresh = u.metadata.lastRefreshTime
      ? Date.parse(u.metadata.lastRefreshTime)
      : null;
    const signIn = u.metadata.lastSignInTime
      ? Date.parse(u.metadata.lastSignInTime)
      : null;
    lastSeenByUid[u.uid] = Math.max(refresh || 0, signIn || 0) || null;
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

    const seenMs = lastSeenByUid[doc.id] ?? null;
    const seenDays =
      seenMs === null ? null : Math.floor((now - seenMs) / 86_400_000);

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
      lastSeen: seenMs ? new Date(seenMs).toISOString() : null,
      lastSeenDays: seenDays,
      unconfirmed: false,
    };

    if (FOUNDER_HANDLES.has(handle)) {
      founders.push({ ...base, source: "founder", proAccessUntil: null, permanent: false });
    } else if (untilMs > now) {
      comped.push({ ...base, source: "comped" });
    } else if (badgeActive && untilMs === 0) {
      // Badge on, never granted → real purchaser. Flag it when no device has
      // reaffirmed the badge recently: that's the churn we can't otherwise see.
      purchased.push({
        ...base,
        source: "purchased",
        proAccessUntil: null,
        unconfirmed: seenDays === null || seenDays >= UNCONFIRMED_AFTER_DAYS,
      });
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

  // Unverifiable badges first — those are the rows that need a decision.
  purchased.sort(
    (a, b) =>
      Number(b.unconfirmed) - Number(a.unconfirmed) ||
      (b.lastSeenDays ?? 1e9) - (a.lastSeenDays ?? 1e9)
  );

  const purchasedUnconfirmed = purchased.filter((p) => p.unconfirmed).length;

  return NextResponse.json({
    counts: {
      purchased: purchased.length,
      /** Of `purchased`, how many badges no device has reaffirmed lately. */
      purchasedUnconfirmed,
      /** Purchased badges we can still stand behind. */
      purchasedConfirmed: purchased.length - purchasedUnconfirmed,
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
