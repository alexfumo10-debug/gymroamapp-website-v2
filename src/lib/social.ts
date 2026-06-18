/**
 * Social following — server-side helper for the Social tab (Instagram).
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

