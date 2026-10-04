/**
 * POST|GET /api/admin/affiliate-sync — manual/on-demand referral sync.
 *
 * The logic lives in @/lib/affiliate-referral-sync so the App Store ingest
 * cron can drive it too. This route stays as the admin's manual trigger and
 * as a cron-callable endpoint, but it is NOT the only schedule any more: its
 * own Vercel cron never fired once in 47 days, so the proven daily ingest
 * cron now calls the same function. See the lib header.
 *
 * Auth: admin Firebase token, OR the CRON_SECRET bearer.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-gate";
import { syncAffiliateReferrals } from "@/lib/affiliate-referral-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

async function sync(req: NextRequest) {
  if (!isCron(req)) {
    const denied = await requireAdmin(req);
    if (denied) return denied;
  }

  try {
    const result = await syncAffiliateReferrals();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[/api/admin/affiliate-sync]", e);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}

export const POST = sync;
export const GET = sync;
