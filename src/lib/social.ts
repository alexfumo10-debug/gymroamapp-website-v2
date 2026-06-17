/**
 * Social following — server-side helpers for the Social tab.
 *
 * One SocialStat per connected platform. Instagram is wired (Meta Graph
 * API); TikTok and X are stubs that report "not configured" until their
 * env vars + integrations land. The /api/admin/social route aggregates
 * whichever platforms are configured.
 *
 * Instagram env:
 *   INSTAGRAM_ACCESS_TOKEN   long-lived Page token (bearer)
 *   INSTAGRAM_IG_USER_ID     the IG Business account id (17841…)
 *   META_APP_SECRET          for appsecret_proof (optional, recommended)
 *   META_GRAPH_VERSION       defaults v25.0
 *
 * Notes from research: followers_count/media_count need only
 * instagram_basic. The follower_count growth metric is unavailable for
 * accounts <100 followers and needs instagram_manage_insights — so
 * growth degrades gracefully to 0. engagementRate is not an official IG
 * field; left undefined here rather than presenting a fabricated number.
 */

import { createHmac } from "crypto";
import { adminDb } from "@/lib/firebase-admin";
import type { SocialStat } from "@/app/gr-panel-7x9k/_lib/types";

const HOST = "https://graph.facebook.com";
const graphVersion = () => process.env.META_GRAPH_VERSION || "v25.0";

export function instagramConfigured(): boolean {
  return !!(process.env.INSTAGRAM_ACCESS_TOKEN && process.env.INSTAGRAM_IG_USER_ID);
}

function igProof(token: string): string | null {
  const secret = process.env.META_APP_SECRET;
  return secret ? createHmac("sha256", secret).update(token).digest("hex") : null;
}

function igUrl(path: string, params: Record<string, string>): string {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN || "";
  const qs = new URLSearchParams(params);
  qs.set("access_token", token);
  const proof = igProof(token);
  if (proof) qs.set("appsecret_proof", proof);
  return `${HOST}/${graphVersion()}/${path}?${qs.toString()}`;
}

async function igGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const res = await fetch(igUrl(path, params));
  const json = await res.json();
  if (!res.ok) {
    const msg = (json as { error?: { message?: string } }).error?.message;
    throw new Error(`Instagram ${res.status}: ${msg || "request failed"}`);
  }
  return json as T;
}

/** Net follower change over the trailing 7 days (0 if unavailable). */
async function instagramGrowth7d(igId: string): Promise<number> {
  try {
    const until = Math.floor(Date.now() / 1000);
    const since = until - 7 * 24 * 60 * 60;
    const j = await igGet<{
      data?: { values?: { value: number }[] }[];
    }>(`${igId}/insights`, {
      metric: "follower_count",
      period: "day",
      since: String(since),
      until: String(until),
    });
    const values = j.data?.[0]?.values || [];
    return values.reduce((sum, v) => sum + (v.value || 0), 0);
  } catch {
    // <100 followers, or missing instagram_manage_insights — degrade.
    return 0;
  }
}

export async function fetchInstagram(): Promise<SocialStat> {
  const igId = process.env.INSTAGRAM_IG_USER_ID as string;
  const profile = await igGet<{
    username?: string;
    followers_count?: number;
    media_count?: number;
  }>(igId, { fields: "username,followers_count,media_count" });

  const followingDelta7d = await instagramGrowth7d(igId);

  return {
    platform: "instagram",
    followers: profile.followers_count || 0,
    posts: profile.media_count || 0,
    followingDelta7d,
    // engagementRate intentionally omitted — not an official IG metric.
  };
}

/* ────────────────────────────────────────────────────────────
   TikTok — OAuth user-delegated (Login Kit + Display API).
   No app-only auth: the account owner authorizes once (see
   scripts/tiktok-setup.mjs), which seeds TIKTOK_REFRESH_TOKEN.
   Access tokens last 24h and the refresh token ROTATES on every
   refresh, so we persist the live tokens in Firestore
   (adminIntegrations/tiktok) — shared between local + Vercel — and
   only refresh when the cached access token is near expiry.
   ──────────────────────────────────────────────────────────── */

const TT_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const TT_API = "https://open.tiktokapis.com/v2";

export function tiktokConfigured(): boolean {
  return !!(
    process.env.TIKTOK_CLIENT_KEY &&
    process.env.TIKTOK_CLIENT_SECRET &&
    process.env.TIKTOK_REFRESH_TOKEN
  );
}

// In-process single-flight guard. TikTok rotates (invalidates) the refresh
// token on every use, so two concurrent refreshes would spend the same
// token and one would fail. Collapsing concurrent callers onto one
// in-flight refresh prevents that within an instance. (Cross-instance
// concurrency on Vercel is still possible but unlikely for a 1–2 admin
// tool; the bad-token recovery below is the backstop if it ever happens.)
let tiktokRefreshInFlight: Promise<string> | null = null;

/** Get a valid access token, refreshing + rotating via Firestore. */
async function tiktokAccessToken(): Promise<string> {
  const ref = adminDb().collection("adminIntegrations").doc("tiktok");
  const snap = await ref.get();
  const data = (snap.exists ? snap.data() : {}) as {
    accessToken?: string;
    accessTokenExpiry?: number;
    refreshToken?: string;
  };
  const now = Date.now();
  if (data.accessToken && (data.accessTokenExpiry || 0) > now + 60_000) {
    return data.accessToken;
  }

  // Collapse concurrent refreshes onto a single in-flight request.
  if (tiktokRefreshInFlight) return tiktokRefreshInFlight;

  tiktokRefreshInFlight = (async () => {
    try {
      // Prefer the rotated refresh token in Firestore; fall back to env seed.
      const refreshToken = data.refreshToken || process.env.TIKTOK_REFRESH_TOKEN;
      if (!refreshToken) throw new Error("No TikTok refresh token available");

      const body = new URLSearchParams({
        client_key: process.env.TIKTOK_CLIENT_KEY || "",
        client_secret: process.env.TIKTOK_CLIENT_SECRET || "",
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      });
      const res = await fetch(TT_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      const j = await res.json();
      if (!res.ok || !j.access_token) {
        // A 4xx means the persisted refresh token is bad (expired/rotated
        // away). Clear it so the env seed becomes reachable again and a
        // re-auth via scripts/tiktok-setup.mjs can recover — otherwise the
        // dead Firestore token would win forever. Leave it intact on 5xx
        // (transient) so a TikTok outage doesn't wipe a good token.
        if (data.refreshToken && res.status >= 400 && res.status < 500) {
          await ref
            .set({ refreshToken: null, accessToken: null, accessTokenExpiry: 0 }, { merge: true })
            .catch(() => {});
        }
        throw new Error(
          `TikTok token refresh failed: ${j.error_description || j.error || res.status}`
        );
      }
      // Persist the new access token AND the rotated refresh token.
      await ref.set(
        {
          accessToken: j.access_token,
          accessTokenExpiry: now + (j.expires_in || 86400) * 1000,
          refreshToken: j.refresh_token || refreshToken,
          updatedAt: now,
        },
        { merge: true }
      );
      return j.access_token as string;
    } finally {
      tiktokRefreshInFlight = null;
    }
  })();

  return tiktokRefreshInFlight;
}

export async function fetchTikTok(): Promise<SocialStat> {
  const token = await tiktokAccessToken();
  const auth = { Authorization: `Bearer ${token}` };

  const uRes = await fetch(
    `${TT_API}/user/info/?fields=open_id,display_name,follower_count,following_count,likes_count,video_count`,
    { headers: auth }
  );
  const u = await uRes.json();
  if (!uRes.ok) {
    throw new Error(`TikTok user/info: ${u.error?.message || uRes.status}`);
  }
  const stats = u.data?.user || {};

  // engagementRate isn't returned by TikTok — compute from recent videos.
  let engagementRate: number | undefined;
  try {
    const vRes = await fetch(
      `${TT_API}/video/list/?fields=id,like_count,comment_count,share_count,view_count`,
      {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ max_count: 20 }),
      }
    );
    const v = await vRes.json();
    const vids: { like_count?: number; comment_count?: number; share_count?: number; view_count?: number }[] =
      v.data?.videos || [];
    const views = vids.reduce((s, x) => s + (x.view_count || 0), 0);
    const eng = vids.reduce(
      (s, x) => s + (x.like_count || 0) + (x.comment_count || 0) + (x.share_count || 0),
      0
    );
    if (views > 0) engagementRate = (eng / views) * 100;
  } catch {
    /* engagement is best-effort */
  }

  return {
    platform: "tiktok",
    followers: stats.follower_count || 0,
    posts: stats.video_count || 0,
    followingDelta7d: 0, // not provided by TikTok; needs historical snapshots
    engagementRate,
  };
}

/* ── X — stub until its integration lands ── */
export function xConfigured(): boolean {
  return !!(process.env.X_BEARER_TOKEN && process.env.X_USERNAME);
}
