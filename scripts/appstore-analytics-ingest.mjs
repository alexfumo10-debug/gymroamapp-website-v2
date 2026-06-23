/**
 * One-time / cron-able populate of the App Store funnel cache, mirroring
 * src/lib/appstore.ts#fetchAnalyticsFunnel exactly, then writing the
 * result to Firestore adminIntegrations/appStoreAnalytics via the Admin
 * SDK. Use this to seed the cache locally; production runs the admin
 * route (/api/admin/app-store/ingest) on a daily Vercel Cron.
 *
 *   node scripts/appstore-analytics-ingest.mjs
 *
 * Reads App Store Connect + Firebase Admin creds from .env.local.
 */
import nextEnv from "@next/env";
import jwt from "jsonwebtoken";
import { gunzipSync } from "zlib";
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

nextEnv.loadEnvConfig(process.cwd());

const ISSUER = process.env.APP_STORE_CONNECT_ISSUER_ID;
const KEY_ID = process.env.APP_STORE_CONNECT_KEY_ID;
const PK = (process.env.APP_STORE_CONNECT_PRIVATE_KEY || "").replace(/\\n/g, "\n").trim();
const HOST = "https://api.appstoreconnect.apple.com";
const REQUEST_ID = "fac7ab09-a7a2-4a01-b809-6c32157bc4f7";
const ENGAGEMENT_REPORT = "App Store Discovery and Engagement Standard";
const DOWNLOADS_REPORT = "App Downloads Standard";

if (!ISSUER || !KEY_ID || !PK) {
  console.error("Missing App Store Connect creds in .env.local.");
  process.exit(1);
}

function token() {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    { iss: ISSUER, iat: now, exp: now + 1100, aud: "appstoreconnect-v1" },
    PK,
    { algorithm: "ES256", header: { alg: "ES256", kid: KEY_ID, typ: "JWT" } }
  );
}
async function getJson(path) {
  const res = await fetch(path.startsWith("http") ? path : `${HOST}${path}`, {
    headers: { Authorization: `Bearer ${token()}` },
  });
  if (!res.ok) throw new Error(`ASC ${res.status} ${path.split("?")[0]}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}
async function listAll(path) {
  const out = [];
  let url = path;
  while (url) {
    const j = await getJson(url);
    out.push(...(j.data || []));
    url = j.links?.next || "";
  }
  return out;
}
function num(s) {
  const n = parseFloat((s || "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
async function fetchSegmentRows(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`segment download ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  let tsv;
  try { tsv = gunzipSync(buf).toString("utf8"); } catch { tsv = buf.toString("utf8"); }
  const lines = tsv.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = lines[0].split("\t").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split("\t");
    const row = {};
    headers.forEach((h, i) => (row[h] = (cells[i] || "").trim()));
    return row;
  });
}
async function fetchReportRows(reportName) {
  const reports = await listAll(`/v1/analyticsReportRequests/${REQUEST_ID}/reports?limit=200`);
  const report = reports.find((r) => r.attributes?.name === reportName);
  if (!report) throw new Error(`report "${reportName}" not found`);
  const instances = await listAll(`/v1/analyticsReports/${report.id}/instances?filter[granularity]=DAILY&limit=200`);
  instances.sort((a, b) => String(a.attributes?.processingDate || "").localeCompare(String(b.attributes?.processingDate || "")));
  const out = [];
  for (const inst of instances) {
    const processingDate = String(inst.attributes?.processingDate || "");
    const segments = await listAll(`/v1/analyticsReportInstances/${inst.id}/segments?limit=200`);
    for (const seg of segments) {
      const url = seg.attributes?.url;
      if (!url) continue;
      for (const row of await fetchSegmentRows(url)) out.push({ processingDate, row });
    }
  }
  return out;
}
function authoritativeRows(tagged) {
  const latestPD = {};
  for (const { processingDate, row } of tagged) {
    const d = row["Date"] || "";
    if (!latestPD[d] || processingDate > latestPD[d]) latestPD[d] = processingDate;
  }
  return tagged.filter(({ processingDate, row }) => processingDate === latestPD[row["Date"] || ""]).map((t) => t.row);
}

const WINDOW_DAYS = 30;
const engRows = authoritativeRows(await fetchReportRows(ENGAGEMENT_REPORT));
const dlRows = authoritativeRows(await fetchReportRows(DOWNLOADS_REPORT));

const allDates = [...engRows, ...dlRows].map((r) => r["Date"]).filter(Boolean).sort();
const asOf = allDates.length ? allDates[allDates.length - 1] : "";
let cutoff = "";
if (asOf) {
  const d = new Date(`${asOf}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - (WINDOW_DAYS - 1));
  cutoff = d.toISOString().slice(0, 10);
}
const inWindow = (r) => !cutoff || (r["Date"] || "") >= cutoff;

let impressions = 0, uniqueImpressions = 0, productPageViews = 0;
for (const r of engRows) {
  if (!inWindow(r)) continue;
  if (r["Event"] === "Impression") { impressions += num(r["Counts"]); uniqueImpressions += num(r["Unique Counts"]); }
  else if (r["Event"] === "Page view") { productPageViews += num(r["Counts"]); }
}
// Exclude update events ("Auto-update"/"Manual update") — they dwarf real
// downloads and aren't downloads. Keep first-time downloads + redownloads.
let downloads = 0;
for (const r of dlRows) {
  if (!inWindow(r)) continue;
  if (/update/i.test(r["Download Type"] || "")) continue;
  downloads += num(r["Counts"]);
}

const conversionRate = uniqueImpressions > 0 ? Math.round((downloads / uniqueImpressions) * 100 * 100) / 100 : 0;
const funnel = { impressions, productPageViews, downloads, conversionRate, asOf };

console.log("Computed funnel:", funnel);
console.log(`(window ${cutoff || "—"} → ${asOf || "—"}; uniqueImpressions=${uniqueImpressions})`);

if (!asOf) {
  console.log("⚠️  No analytics rows yet — not writing an all-zero doc.");
  process.exit(0);
}

// Write to Firestore via Admin SDK.
const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
if (!projectId || !clientEmail || !privateKey) {
  console.error("Missing Firebase admin creds — cannot write cache.");
  process.exit(1);
}
const app = getApps().find((a) => a.name === "ingest") || initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) }, "ingest");
try {
  await getFirestore(app).collection("adminIntegrations").doc("appStoreAnalytics").set(
    { ...funnel, updatedAt: new Date().toISOString() },
    { merge: true }
  );
  console.log("✅ Wrote adminIntegrations/appStoreAnalytics");
} catch (e) {
  console.error(`\n❌ Firestore write failed: ${e.code} ${String(e.message).slice(0, 140)}`);
  console.error("   The funnel above computed correctly from real Apple data; only the");
  console.error("   Firestore write is blocked. If this is 'Invalid JWT Signature', the");
  console.error("   local FIREBASE_ADMIN_PRIVATE_KEY doesn't match the service account —");
  console.error("   run the ingest route in an env with the correct key (e.g. Vercel).");
  process.exit(1);
}
process.exit(0);
