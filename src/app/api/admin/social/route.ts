/**
 * GET /api/admin/social — follower analytics per connected platform.
 *
 * Admin-gated. Returns { stats, platforms } where `stats` is a
 * SocialStat[] for every CONFIGURED platform and `platforms` reports
 * each platform's connection status, so the Social tab can show live
 * cards for connected networks and connect-ready notes for the rest.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-gate";
import {
  instagramConfigured,
  tiktokConfigured,
  xConfigured,
  fetchInstagram,
  fetchTikTok,
} from "@/lib/social";
import type { SocialStat } from "@/app/gr-panel-7x9k/_lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const platforms = {
    instagram: instagramConfigured(),
    tiktok: tiktokConfigured(),
    x: xConfigured(),
  };

  const stats: SocialStat[] = [];
  const errors: Record<string, string> = {};

  if (platforms.instagram) {
    try {
      stats.push(await fetchInstagram());
    } catch (e) {
      errors.instagram = (e as Error).message;
    }
  }
  if (platforms.tiktok) {
    try {
      stats.push(await fetchTikTok());
    } catch (e) {
      errors.tiktok = (e as Error).message;
    }
  }
  // X fetcher slots in here once its integration lands.

  return NextResponse.json({ stats, platforms, errors });
}
