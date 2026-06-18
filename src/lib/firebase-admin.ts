/**
 * Firebase Admin SDK — server-side only.
 *
 * Used by API routes (webhooks) that need to write Firestore without auth
 * headers. Never import from client components.
 *
 * Required env vars (set in Vercel + .env.local):
 *   FIREBASE_ADMIN_PROJECT_ID      (e.g. "gymroam-ad7dc")
 *   FIREBASE_ADMIN_CLIENT_EMAIL    (from service account JSON)
 *   FIREBASE_ADMIN_PRIVATE_KEY     (from service account JSON, with \n literals)
 *
 * Get these from:
 *   Firebase Console → Project Settings → Service Accounts
 *   → Generate new private key (downloads JSON)
 */

import { getApps, initializeApp, cert, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { getAuth, Auth } from "firebase-admin/auth";

/**
 * Normalize the FIREBASE_ADMIN_PRIVATE_KEY env var into valid PEM,
 * tolerant of every common paste mishap (the "Invalid PEM formatted
 * message" failure mode):
 *   - Surrounding single/double quotes (copied with the JSON quotes)
 *   - Literal `\n` sequences (copied straight from the JSON) → real newlines
 *   - base64-encoded PEM (the bulletproof paste — no newline ambiguity)
 *   - Already-real newlines (pasted multi-line) → used as-is
 * Accepts whichever form is present so the value can't be silently
 * mangled by the JSON → clipboard → Vercel → runtime pipeline.
 */
function normalizePrivateKey(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  let key = raw.trim();
  // Strip accidental wrapping quotes.
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim();
  }
  // If it isn't already PEM, assume base64-encoded PEM and decode it.
  if (!key.includes("BEGIN PRIVATE KEY")) {
    try {
      const decoded = Buffer.from(key, "base64").toString("utf8");
      if (decoded.includes("BEGIN PRIVATE KEY")) key = decoded;
    } catch {
      /* fall through — leave key as-is */
    }
  }
  // Convert any literal \n to real newlines (no-op if already real).
  key = key.replace(/\\n/g, "\n");
  return key;
}

let adminApp: App | undefined;

function getAdminApp(): App {
  if (adminApp) return adminApp;

  const existing = getApps().find((a) => a.name === "admin");
  if (existing) {
    adminApp = existing;
    return existing;
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = normalizePrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY);

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase admin credentials. Set FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY."
    );
  }

  adminApp = initializeApp(
    {
      credential: cert({ projectId, clientEmail, privateKey }),
    },
    "admin"
  );
  return adminApp;
}

export function adminDb(): Firestore {
  return getFirestore(getAdminApp());
}

export function adminAuth(): Auth {
  return getAuth(getAdminApp());
}
