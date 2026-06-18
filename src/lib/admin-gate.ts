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
  // Generic errors only — this gate runs BEFORE the caller is confirmed
  // to be an admin, so it must not leak internal init/verify detail to
  // unauthenticated callers. (The detailed init-vs-token split lived here
  // temporarily to debug the FIREBASE_ADMIN_* env-var setup; reverted now
  // that the credentials are confirmed working. Server-side console.error
  // still captures the real exception for our own logs.)
  try {
    const decoded = await adminAuth().verifyIdToken(idToken);
    const email = (decoded.email || "").toLowerCase();
    if (!ADMIN_EMAILS.includes(email)) {
      return NextResponse.json({ error: "not an admin" }, { status: 403 });
    }
    return null;
  } catch (e) {
    console.error("requireAdmin failed:", e);
    return NextResponse.json({ error: "invalid token" }, { status: 401 });
  }
}
