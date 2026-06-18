/**
 * One-time bootstrap: request an ONGOING App Store Analytics report for
 * GymRoam. Apple takes ~1–2 days to generate the first report, after
 * which daily files are available to download. Idempotent — if an
 * ONGOING request already exists, it just prints it.
 *
 *   node scripts/appstore-analytics-request.mjs
 *
 * Uses the App Store Connect key already in .env.local (Admin role is
 * required for this first request — our key is Admin).
 */
import nextEnv from "@next/env";
import jwt from "jsonwebtoken";

nextEnv.loadEnvConfig(process.cwd());
const ISSUER = process.env.APP_STORE_CONNECT_ISSUER_ID;
const KEY_ID = process.env.APP_STORE_CONNECT_KEY_ID;
const PK = (process.env.APP_STORE_CONNECT_PRIVATE_KEY || "").replace(/\\n/g, "\n").trim();
const APP_ID = "6773157406";
const HOST = "https://api.appstoreconnect.apple.com";

if (!ISSUER || !KEY_ID || !PK) {
  console.error("Missing App Store Connect creds in .env.local.");
  process.exit(1);
}

const now = Math.floor(Date.now() / 1000);
const token = jwt.sign(
  { iss: ISSUER, iat: now, exp: now + 1100, aud: "appstoreconnect-v1" },
  PK,
  { algorithm: "ES256", header: { alg: "ES256", kid: KEY_ID, typ: "JWT" } }
);
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

// 1) Check for an existing request (idempotent).
const existing = await (
  await fetch(`${HOST}/v1/apps/${APP_ID}/analyticsReportRequests?filter[accessType]=ONGOING`, { headers })
).json();

if (existing.data && existing.data.length > 0) {
  const r = existing.data[0];
  console.log(`✅ An ONGOING analytics report request already exists (id ${r.id}).`);
  console.log("   Reports generate within ~1–2 days of the original request; nothing more to do here.");
  process.exit(0);
}
if (existing.errors) {
  console.error("❌ Error listing requests:", existing.errors.map((e) => e.detail).join(" | "));
  process.exit(1);
}

// 2) Create the ONGOING request.
const res = await fetch(`${HOST}/v1/analyticsReportRequests`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    data: {
      type: "analyticsReportRequests",
      attributes: { accessType: "ONGOING" },
      relationships: { app: { data: { type: "apps", id: APP_ID } } },
    },
  }),
});
const j = await res.json();
if (!res.ok) {
  console.error("❌ Request failed:", (j.errors || []).map((e) => `${e.title}: ${e.detail}`).join(" | ") || res.status);
  process.exit(1);
}
console.log(`✅ ONGOING analytics report requested (id ${j.data?.id}).`);
console.log("   Apple will generate the first report within ~1–2 days. After that, the");
console.log("   ingestion job can download daily impressions / page views / downloads.");
