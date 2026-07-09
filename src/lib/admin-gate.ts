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

export interface AdminContext {
  /** The error response to return when the caller is NOT an admin, else null. */
  denied: NextResponse | null;
  /** The verified, lowercased admin email when authorized, else null. */
  email: string | null;
}

/**
 * Verify the caller is a signed-in admin AND surface their identity.
 * Single source of truth for the admin gate — `requireAdmin` wraps this.
 * Use this variant when the route needs to know WHICH admin acted (e.g.
 * to stamp an audit field like `proGrantedBy`).
 *
 * Generic error messages only — this runs BEFORE the caller is confirmed
 * to be an admin, so it must not leak internal init/verify detail to
 * unauthenticated callers. The server-side console.error still captures
 * the real exception for our own logs.
 */
export async function requireAdminContext(
  req: NextRequest
): Promise<AdminContext> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return {
      denied: NextResponse.json({ error: "missing bearer token" }, { status: 401 }),
      email: null,
    };
  }
  const idToken = authHeader.slice("Bearer ".length);
  try {
    const decoded = await adminAuth().verifyIdToken(idToken);
    const email = (decoded.email || "").toLowerCase();
    if (!ADMIN_EMAILS.includes(email)) {
      return {
        denied: NextResponse.json({ error: "not an admin" }, { status: 403 }),
        email: null,
      };
    }
    return { denied: null, email };
  } catch (e) {
    console.error("requireAdmin failed:", e);
    return {
      denied: NextResponse.json({ error: "invalid token" }, { status: 401 }),
      email: null,
    };
  }
}

/**
 * Returns a NextResponse (the error to send) when the caller is NOT an
 * authorized admin, or `null` when they are — so the route can proceed.
 */
export async function requireAdmin(
  req: NextRequest
): Promise<NextResponse | null> {
  return (await requireAdminContext(req)).denied;
}
