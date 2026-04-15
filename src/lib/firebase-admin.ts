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
  // Private key often stored with literal "\n" — convert to real newlines
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(
    /\\n/g,
    "\n"
  );

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
