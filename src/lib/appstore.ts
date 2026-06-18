/**
 * App Store Connect API — server-side helper.
 *
 * One Team API key powers two dashboard tabs:
 *   - Reviews        (customerReviews endpoint, JSON)
 *   - Pro/Pro+ subs  (salesReports endpoint, GZIPPED TSV)
 *
 * Auth is a self-minted ES256 JWT (no OAuth). Tokens last ≤20 min, so
 * we mint short-lived ones and cache in-memory. See
 * docs/admin-integrations.md for credential setup.
 *
 * Env:
 *   APP_STORE_CONNECT_ISSUER_ID     team issuer UUID  (JWT iss)
 *   APP_STORE_CONNECT_KEY_ID        10-char key id    (JWT header kid)
 *   APP_STORE_CONNECT_PRIVATE_KEY   .p8 PEM contents  (ES256 signing key)
 *   APP_STORE_CONNECT_VENDOR_NUMBER vendor number     (subs reports only)
 */

import jwt from "jsonwebtoken";
import { gunzipSync } from "zlib";
import type { Review } from "@/app/gr-panel-7x9k/_lib/types";

const ASC_HOST = "https://api.appstoreconnect.apple.com";
const GYMROAM_APP_ID = "6773157406";

function issuer() {
  return process.env.APP_STORE_CONNECT_ISSUER_ID || "";
}
function keyId() {
  return process.env.APP_STORE_CONNECT_KEY_ID || "";
}
function privateKey() {
  // Tolerant of every paste form (the "must be an asymmetric key when
  // using ES256" failure = malformed PEM): base64-encoded .p8 (the
  // bulletproof paste — no newline ambiguity), literal "\n" escapes,
  // real multi-line newlines, and quote-wrapped values. Same normalizer
  // shape as firebase-admin's, since the App Store .p8 is also a
  // PKCS#8 "BEGIN PRIVATE KEY" PEM (EC instead of RSA).
  let key = (process.env.APP_STORE_CONNECT_PRIVATE_KEY || "").trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim();
  }
  if (!key.includes("BEGIN")) {
    try {
      const decoded = Buffer.from(key, "base64").toString("utf8");
      if (decoded.includes("BEGIN")) key = decoded;
    } catch {
      /* leave as-is */
    }
  }
  return key.replace(/\\n/g, "\n").trim();
}
function vendorNumber() {
  return process.env.APP_STORE_CONNECT_VENDOR_NUMBER || "";
}

/** Reviews need issuer + key + private key. */
export function reviewsConfigured(): boolean {
  return !!(issuer() && keyId() && privateKey());
}
/** Subscriptions additionally need the vendor number. */
export function subsConfigured(): boolean {
  return reviewsConfigured() && !!vendorNumber();
}

// ── Token cache (≤20 min lifetime) ──
let cachedToken: { token: string; exp: number } | null = null;

function mintToken(): string {
  const now = Math.floor(Date.now() / 1000);
  // Re-use a cached token until 60s before it expires.
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.token;

  const exp = now + 19 * 60; // 19 min — safely under Apple's 20-min cap
  const token = jwt.sign(
    { iss: issuer(), iat: now, exp, aud: "appstoreconnect-v1" },
    privateKey(),
    { algorithm: "ES256", header: { alg: "ES256", kid: keyId(), typ: "JWT" } }
  );
  cachedToken = { token, exp };
  return token;
}

async function ascGet(path: string): Promise<Response> {
  return fetch(path.startsWith("http") ? path : `${ASC_HOST}${path}`, {
    headers: { Authorization: `Bearer ${mintToken()}` },
  });
}

/* ────────────────────────────────────────────────────────────
   REVIEWS
   ──────────────────────────────────────────────────────────── */

interface AscReviewAttrs {
  rating: number;
  title?: string;
  body?: string;
  reviewerNickname?: string;
  createdDate?: string;
  territory?: string;
}

/** Fetch up to `cap` most-recent reviews, normalized to Review[]. */
export async function fetchReviews(cap = 200): Promise<Review[]> {
  const out: Review[] = [];
  let url =
    `${ASC_HOST}/v1/apps/${GYMROAM_APP_ID}/customerReviews` +
    `?sort=-createdDate&limit=200` +
    `&fields[customerReviews]=rating,title,body,reviewerNickname,createdDate,territory`;

  while (url && out.length < cap) {
    const res = await ascGet(url);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`ASC reviews ${res.status}: ${text.slice(0, 200)}`);
    }
    const json = (await res.json()) as {
      data?: Array<{ id: string; attributes: AscReviewAttrs }>;
      links?: { next?: string };
    };
    for (const d of json.data || []) {
      const a = d.attributes;
      out.push({
        id: d.id,
        author: a.reviewerNickname || "Anonymous",
        rating: a.rating,
        title: a.title,
        body: a.body || "",
        territory: a.territory,
        at: a.createdDate ? new Date(a.createdDate).getTime() : 0,
      });
    }
    url = json.links?.next || "";
  }
  // Trim to the requested cap — a page appends up to 200 at a time, so
  // the loop can overshoot when cap isn't a multiple of the page size.
  return out.slice(0, cap);
}

/* ────────────────────────────────────────────────────────────
   SUBSCRIPTIONS (salesReports — gzipped TSV)
   ──────────────────────────────────────────────────────────── */

/**
 * Fetch + gunzip + parse a sales report into header-keyed rows. The
 * vendor number + version are injected here; callers pass the report
 * type/subtype/frequency/date filters. A day/month with no data
 * legitimately 404s — returned as `[]`, not an error.
 */
export async function fetchSalesReport(
  filters: Record<string, string>
): Promise<Record<string, string>[]> {
  // The report `version` is report-type-specific and Apple bumps it over
  // time — sources disagree on whether the current subscription reports
  // are 1_4 or 1_3. Rather than guess, try the candidates in order and
  // fall back on an HTTP 400 (the status Apple returns for an
  // unsupported version+reportType combo). A genuinely empty period
  // 404s and returns []. Override with filter `version` if a caller
  // already knows the right one.
  const candidateVersions = filters.version ? [filters.version] : ["1_4", "1_3"];

  let lastErr = "";
  for (const version of candidateVersions) {
    const qs = new URLSearchParams();
    qs.set("filter[vendorNumber]", vendorNumber());
    qs.set("filter[version]", version);
    for (const [k, v] of Object.entries(filters)) {
      if (k === "version") continue;
      qs.set(`filter[${k}]`, v);
    }

    const res = await fetch(`${ASC_HOST}/v1/salesReports?${qs.toString()}`, {
      headers: {
        Authorization: `Bearer ${mintToken()}`,
        Accept: "application/a-gzip",
      },
    });
    if (res.status === 404) return []; // no data for this period
    if (res.status === 400) {
      const body = await res.text().catch(() => "400");
      // Apple returns "Invalid vendor number" on SUBSCRIPTION / SUBSCRIBER
      // reports when the account simply has no subscription report data
      // yet (confirmed: the same vendor returns 200 for SALES reports).
      // Treat that as "no data" rather than a hard error, so the tab shows
      // an empty state instead of failing — it'll populate once there's
      // real subscription activity Apple has reported on.
      if (/vendor number/i.test(body)) return [];
      // Otherwise it's most likely a version mismatch — try the next.
      lastErr = body;
      continue;
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`ASC salesReports ${res.status}: ${text.slice(0, 200)}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const tsv = gunzipSync(buf).toString("utf8");
    const lines = tsv.split("\n").filter((l) => l.trim().length > 0);
    if (lines.length < 2) return [];
    const headers = lines[0].split("\t");
    return lines.slice(1).map((line) => {
      const cells = line.split("\t");
      const row: Record<string, string> = {};
      headers.forEach((h, i) => (row[h.trim()] = (cells[i] || "").trim()));
      return row;
    });
  }
  throw new Error(
    `ASC salesReports 400 for all versions [${candidateVersions.join(", ")}]: ${lastErr.slice(0, 160)}`
  );
}

function num(s: string | undefined): number {
  const n = parseFloat((s || "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/**
 * App Store first-time downloads per day over the last `days` days, from
 * the SALES report (next-day data; lags ~1–2 days so we start 2 days back).
 * "Downloads" = Units where Product Type Identifier starts with "1"
 * (first-time app installs across device types; excludes redownloads "3",
 * updates "7", and in-app purchases "IA*"). SALES reports use version 1_1.
 */
export async function fetchDownloads(
  days = 30
): Promise<{ total: number; series: { label: string; value: number; date: string }[] }> {
  const dates: string[] = [];
  for (let back = 2; back < days + 2; back++) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - back);
    dates.push(d.toISOString().slice(0, 10));
  }

  const counts = await Promise.all(
    dates.map(async (date) => {
      const rows = await fetchSalesReport({
        frequency: "DAILY",
        reportType: "SALES",
        reportSubType: "SUMMARY",
        reportDate: date,
        version: "1_1",
      });
      let units = 0;
      for (const row of rows) {
        const pti = row["Product Type Identifier"] || "";
        if (pti.startsWith("1")) units += num(row["Units"]);
      }
      return { date, units };
    })
  );

  const series = counts
    .map(({ date, units }) => ({
      label: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: units,
      date,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return { total: series.reduce((s, x) => s + x.value, 0), series };
}
