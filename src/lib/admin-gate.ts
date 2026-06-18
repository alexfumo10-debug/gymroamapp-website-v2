/**
 * Shared admin auth gate for /api/admin/* route handlers.
 *
 * Every admin data route exposes sensitive business data (revenue,
 * user PII, reviews), so each one must verify the caller is a signed-in
 * admin. This centralizes the exact pattern the existing
 * /api/admin/users-auth route established:
 *   - require `Authorization: Bearer <Firebase ID token>`
 *   - verify the token with the Admin SDK
 *   - check the token's email against the allowlist
 *
 * Usage in a route:
 *   const denied = await requireAdmin(req);
 *   if (denied) return denied;            // 401/403 already formed
 *   ...return data...
 */

import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";

export const ADMIN_EMAILS = [
  "gymroamapp@gmail.com",
  "kevin@aigrowthhouse.com",
];

/**
 * Returns a NextResponse (the error to send) when the caller is NOT an
 * authorized admin, or `null` when they are — so the route can proceed.
 */
export async function requireAdmin(
  req: NextRequest
): Promise<NextResponse | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "missing bearer token" }, { status: 401 });
  }
  const idToken = authHeader.slice("Bearer ".length);

  // TEMP DIAGNOSTIC (ale/admin-gate-diagnostic): the two failure modes —
  // (a) Admin SDK can't initialize from FIREBASE_ADMIN_* env vars, and
  // (b) the ID token is bad — were both collapsed into a generic
  // "invalid token", making the live env-var problem impossible to
  // diagnose. Split them and surface the real error message + stage.
  // Firebase init/verify error strings contain NO secret material
  // (no key bytes), and this is an admin-only route. Tighten back to a
  // generic message once the env vars are confirmed working.
  let auth;
  try {
    auth = adminAuth(); // throws if FIREBASE_ADMIN_* missing/malformed
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "admin sdk init failed", stage: "adminAuth", detail: msg },
      { status: 401 }
    );
  }
  try {
    const decoded = await auth.verifyIdToken(idToken);
    const email = (decoded.email || "").toLowerCase();
    if (!ADMIN_EMAILS.includes(email)) {
      return NextResponse.json({ error: "not an admin" }, { status: 403 });
    }
    return null;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "invalid token", stage: "verifyIdToken", detail: msg },
      { status: 401 }
    );
  }
}
