/**
 * Admin-only: cross-reference Firestore /users with Firebase Auth.
 *
 * Returns a map of `{ [uid]: AuthUserInfo }` so the admin App Users
 * section can:
 *   - Show the CANONICAL email (Firebase Auth is the source of truth;
 *     the Firestore /users doc may not mirror it reliably).
 *   - Flag orphans — Firestore /users docs whose UID has no matching
 *     Firebase Auth account (left-over from deleted/test accounts).
 *
 * Auth: caller must pass `Authorization: Bearer <Firebase ID token>`
 * and the token's email must be in the admin allowlist. The whole
 * point of this route is to return every Auth user's email; without
 * the gate it would be a PII leak.
 *
 * Returns: { users: { [uid]: { email, emailVerified, providers[],
 *                              lastSignIn, createdAt, disabled } } }
 *
 * Scale: listUsers() pages at 1000/call. We loop all pages so the
 * response is the COMPLETE Auth roster. At pre-launch scale this is
 * fine; if user count ever exceeds ~10k consider caching the map and
 * trimming the client-side merge.
 */

import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";

// Firebase Admin SDK needs Node APIs — won't run on Edge.
export const runtime = "nodejs";
// This is dynamic per-request (auth check) — don't try to prerender.
export const dynamic = "force-dynamic";

const ADMIN_EMAILS = [
  "gymroamapp@gmail.com",
  "kevin@aigrowthhouse.com",
];

interface AuthUserInfo {
  email: string | null;
  emailVerified: boolean;
  providers: string[];
  lastSignIn: string | null;
  createdAt: string | null;
  disabled: boolean;
}

export async function GET(req: NextRequest) {
  // --- Verify caller is an admin ---
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "missing bearer token" },
      { status: 401 }
    );
  }
  const idToken = authHeader.slice("Bearer ".length);

  let callerEmail: string | undefined;
  try {
    const decoded = await adminAuth().verifyIdToken(idToken);
    callerEmail = decoded.email?.toLowerCase();
  } catch (e) {
    console.error("verifyIdToken failed:", e);
    return NextResponse.json(
      { error: "invalid id token" },
      { status: 401 }
    );
  }

  if (!callerEmail || !ADMIN_EMAILS.includes(callerEmail)) {
    return NextResponse.json(
      { error: "not an admin" },
      { status: 403 }
    );
  }

  // --- Pull every Auth user, paginated ---
  try {
    const auth = adminAuth();
    const users: Record<string, AuthUserInfo> = {};
    let pageToken: string | undefined;
    let totalScanned = 0;

    do {
      const result = await auth.listUsers(1000, pageToken);
      for (const u of result.users) {
        users[u.uid] = {
          email: u.email ?? null,
          emailVerified: u.emailVerified,
          providers: u.providerData.map((p) => p.providerId),
          lastSignIn: u.metadata.lastSignInTime ?? null,
          createdAt: u.metadata.creationTime ?? null,
          disabled: u.disabled,
        };
        totalScanned++;
      }
      pageToken = result.pageToken;
    } while (pageToken);

    return NextResponse.json({
      users,
      totalScanned,
    });
  } catch (e) {
    console.error("listUsers failed:", e);
    return NextResponse.json(
      { error: "failed to list auth users" },
      { status: 500 }
    );
  }
}
