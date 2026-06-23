/**
 * THROWAWAY probe: walk the App Store Analytics report tree and PRINT the
 * real shape of everything — reports, instances, segments, and the actual
 * TSV column headers + a few sample rows. Assumes NOTHING about the schema.
 *
 *   node scripts/appstore-analytics-probe.mjs
 *
 * Uses the App Store Connect key in .env.local (ES256 JWT, same as the
 * request script). Read-only: lists + downloads, no writes.
 */
import nextEnv from "@next/env";
import jwt from "jsonwebtoken";
import { gunzipSync } from "zlib";

nextEnv.loadEnvConfig(process.cwd());
const ISSUER = process.env.APP_STORE_CONNECT_ISSUER_ID;
const KEY_ID = process.env.APP_STORE_CONNECT_KEY_ID;
const PK = (process.env.APP_STORE_CONNECT_PRIVATE_KEY || "").replace(/\\n/g, "\n").trim();
const HOST = "https://api.appstoreconnect.apple.com";
const REQUEST_ID = "fac7ab09-a7a2-4a01-b809-6c32157bc4f7";

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
async function get(path) {
  const res = await fetch(path.startsWith("http") ? path : `${HOST}${path}`, {
    headers: { Authorization: `Bearer ${token()}` },
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = null; }
  return { status: res.status, json, text };
}

// 1) Reports for the request.
console.log("=== 1) GET /v1/analyticsReportRequests/<id>/reports ===");
const reports = await get(`/v1/analyticsReportRequests/${REQUEST_ID}/reports?limit=200`);
console.log("status:", reports.status);
if (!reports.json?.data) {
  console.log("body:", reports.text.slice(0, 500));
  console.log("\n⚠️  No reports array — likely not ready yet. Stopping.");
  process.exit(0);
}
const reportList = reports.json.data;
console.log(`reports: ${reportList.length}`);
for (const r of reportList) {
  console.log(`  • id=${r.id}  name="${r.attributes?.name}"  category=${r.attributes?.category}`);
}
if (reportList.length === 0) {
  console.log("\n⚠️  Empty reports list — Apple hasn't generated the first report yet. Stopping.");
  process.exit(0);
}

// Target the two reports we care about — the "Standard" variants.
const targets = reportList.filter((r) =>
  ["App Store Discovery and Engagement Standard", "App Downloads Standard"].includes(r.attributes?.name)
);
console.log(`\nTargeting ${targets.length} report(s): ${targets.map((t) => t.attributes?.name).join(", ")}`);

for (const report of targets) {
  console.log(`\n\n########## REPORT: ${report.attributes?.name} (${report.attributes?.category}) ##########`);

  // 2) Instances (filter DAILY).
  const inst = await get(`/v1/analyticsReports/${report.id}/instances?filter[granularity]=DAILY&limit=200`);
  console.log("  instances status:", inst.status, " count:", inst.json?.data?.length);
  const instances = inst.json?.data || [];
  for (const i of instances.slice(0, 5)) {
    console.log(`    - instance id=${i.id} granularity=${i.attributes?.granularity} processingDate=${i.attributes?.processingDate}`);
  }
  if (instances.length === 0) { console.log("    (no DAILY instances)"); continue; }

  // Use the most recent instance by processingDate.
  const sorted = [...instances].sort((a, b) =>
    (b.attributes?.processingDate || "").localeCompare(a.attributes?.processingDate || "")
  );
  const instance = sorted[0];
  console.log(`  → using most recent instance ${instance.id} (processingDate=${instance.attributes?.processingDate})`);

  // 3) Segments.
  const seg = await get(`/v1/analyticsReportInstances/${instance.id}/segments?limit=200`);
  console.log("  segments status:", seg.status, " count:", seg.json?.data?.length);
  const segments = seg.json?.data || [];
  for (const s of segments) {
    console.log(`    - segment id=${s.id} checksum=${s.attributes?.checksum} sizeBytes=${s.attributes?.sizeInBytes}`);
    console.log(`      url=${(s.attributes?.url || "").slice(0, 120)}...`);
  }
  if (segments.length === 0) { console.log("    (no segments)"); continue; }

  // 4) Download the first segment, gunzip, print headers + sample rows.
  const url = segments[0].attributes?.url;
  const res = await fetch(url); // pre-signed S3 URL — no auth header
  const buf = Buffer.from(await res.arrayBuffer());
  let tsv;
  try { tsv = gunzipSync(buf).toString("utf8"); }
  catch { tsv = buf.toString("utf8"); } // in case it's not gzipped
  const lines = tsv.split("\n").filter((l) => l.trim().length > 0);
  console.log(`\n  >>> SEGMENT FILE: ${lines.length} non-empty lines`);
  console.log("  >>> HEADER COLUMNS:");
  const headers = (lines[0] || "").split("\t");
  headers.forEach((h, i) => console.log(`        [${i}] ${h}`));
  console.log("  >>> SAMPLE ROWS (up to 8):");
  for (const line of lines.slice(1, 9)) {
    const cells = line.split("\t");
    const obj = {};
    headers.forEach((h, i) => (obj[h.trim()] = cells[i]));
    console.log("       ", JSON.stringify(obj));
  }

  // Show distinct values of any "Event" column (Discovery & Engagement uses it).
  const evtIdx = headers.findIndex((h) => h.trim().toLowerCase() === "event");
  if (evtIdx >= 0) {
    const vals = new Set();
    for (const line of lines.slice(1)) vals.add(line.split("\t")[evtIdx]);
    console.log("  >>> distinct Event values:", [...vals].join(" | "));
  }
}
console.log("\n=== probe done ===");
