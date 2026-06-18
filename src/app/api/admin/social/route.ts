/**
 * GET /api/admin/social — Instagram follower analytics.
 *
 * Admin-gated. Returns { stats, platforms, errors }. Instagram is the
 * only tracked platform (TikTok and X were removed).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-gate";
import { instagramConfigured, fetchInstagram } from "@/lib/social";
import type { SocialStat } from "@/app/gr-panel-7x9k/_lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const platforms = { instagram: instagramConfigured() };
  const stats: SocialStat[] = [];
  const errors: Record<string, string> = {};

  if (platforms.instagram) {
    try {
      stats.push(await fetchInstagram());
    } catch (e) {
      errors.instagram = (e as Error).message;
    }
  }

  return NextResponse.json({ stats, platforms, errors });
}
