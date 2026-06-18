/**
 * Meta Marketing API — server-side helper for the Ad Stats tab.
 *
 * Auth: a long-lived System User access token (with ads_read) passed as
 * a bearer/query param. We additionally send `appsecret_proof`
 * (HMAC-SHA256 of the token, keyed by the app secret) when the app
 * secret is configured, so a leaked token alone can't be replayed.
 *
 * Env:
 *   META_ACCESS_TOKEN    system-user token (never expires)
 *   META_AD_ACCOUNT_ID   act_XXXXXXXXXX
 *   META_APP_SECRET      app secret (optional but recommended)
 *   META_GRAPH_VERSION   e.g. v25.0 (defaults to v25.0)
 *
 * Numeric insight fields (spend/ctr/cpc/actions[].value) come back as
 * STRINGS — always Number()/parseFloat them. ctr/cpc are server-computed
 * (ctr already a %, cpc per-click in the account currency) — never
 * re-derive them. See docs/admin-integrations.md.
 */

import { createHmac } from "crypto";
import type { AdStat } from "@/app/gr-panel-7x9k/_lib/types";

const HOST = "https://graph.facebook.com";

function token() {
  return process.env.META_ACCESS_TOKEN || "";
}
function adAccount() {
  return process.env.META_AD_ACCOUNT_ID || "";
}
function graphVersion() {
  return process.env.META_GRAPH_VERSION || "v25.0";
}

export function metaConfigured(): boolean {
  return !!(token() && adAccount());
}

/** appsecret_proof = HMAC-SHA256(access_token) keyed by the app secret. */
function appSecretProof(): string | null {
  const secret = process.env.META_APP_SECRET;
  if (!secret) return null;
  return createHmac("sha256", secret).update(token()).digest("hex");
}

function graphUrl(path: string, params: Record<string, string>): string {
  const qs = new URLSearchParams(params);
  qs.set("access_token", token());
  const proof = appSecretProof();
  if (proof) qs.set("appsecret_proof", proof);
  return `${HOST}/${graphVersion()}/${path}?${qs.toString()}`;
}

interface GraphError {
  error?: { message?: string; type?: string; code?: number };
}

async function graphGet<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) {
    const e = (json as GraphError).error;
    throw new Error(
      `Meta ${res.status}: ${e?.message || "request failed"}${e?.code ? ` (code ${e.code})` : ""}`
    );
  }
  return json as T;
}

/** Action types that count as a "conversion" for an iOS app. */
const CONVERSION_ACTIONS = new Set([
  "mobile_app_install",
  "app_install",
  "omni_app_install",
  "app_custom_event.fb_mobile_purchase",
  "omni_purchase",
  "purchase",
]);

interface InsightRow {
  ad_id: string;
  ad_name: string;
  impressions?: string;
  clicks?: string;
  spend?: string;
  ctr?: string;
  cpc?: string;
  actions?: { action_type: string; value: string }[];
}
interface AdCreative {
  id: string;
  creative?: { thumbnail_url?: string };
}

/** The ad account's reporting currency (spend is in this, not always USD). */
export async function fetchCurrency(): Promise<string> {
  try {
    const j = await graphGet<{ currency?: string }>(
      graphUrl(adAccount(), { fields: "currency" })
    );
    return j.currency || "USD";
  } catch {
    return "USD";
  }
}

/**
 * Per-ad performance over the given window (date_preset), joined with
 * each ad's creative thumbnail. Boosted posts come back as ordinary ads.
 */
export async function fetchAdStats(
  datePreset = "last_30d",
  cap = 200
): Promise<AdStat[]> {
  // 1) Insights (level=ad) — paginate up to cap.
  const rows: InsightRow[] = [];
  let url = graphUrl(`${adAccount()}/insights`, {
    level: "ad",
    fields: "ad_id,ad_name,impressions,clicks,spend,ctr,cpc,actions",
    date_preset: datePreset,
    limit: "200",
  });
  while (url && rows.length < cap) {
    const page = await graphGet<{ data: InsightRow[]; paging?: { next?: string } }>(url);
    rows.push(...(page.data || []));
    url = page.paging?.next || "";
  }

  // 2) Creative thumbnails — one call, joined by ad id.
  const thumbById = new Map<string, string>();
  try {
    const ads = await graphGet<{ data: AdCreative[] }>(
      graphUrl(`${adAccount()}/ads`, {
        fields: "id,name,creative{thumbnail_url}",
        limit: "200",
      })
    );
    for (const a of ads.data || []) {
      if (a.creative?.thumbnail_url) thumbById.set(a.id, a.creative.thumbnail_url);
    }
  } catch {
    /* thumbnails are best-effort; AdStat.thumbnailUrl is optional */
  }

  return rows.slice(0, cap).map((r) => {
    const conversions = (r.actions || [])
      .filter((a) => CONVERSION_ACTIONS.has(a.action_type))
      .reduce((sum, a) => sum + (parseFloat(a.value) || 0), 0);
    return {
      id: r.ad_id,
      name: r.ad_name,
      thumbnailUrl: thumbById.get(r.ad_id),
      impressions: Number(r.impressions) || 0,
      clicks: Number(r.clicks) || 0,
      spend: parseFloat(r.spend || "0") || 0,
      ctr: parseFloat(r.ctr || "0") || 0, // already a %
      cpc: parseFloat(r.cpc || "0") || 0,
      conversions,
    };
  });
}
