/**
 * GET /api/admin/ads?range=last_30d — Meta ad performance.
 *
 * Admin-gated. Returns { configured, ads, currency } where `configured`
 * is false (200) until the Meta env vars are set, so the Ad Stats tab
 * can show its connect-ready state instead of erroring.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-gate";
import { metaConfigured, fetchAdStats, fetchCurrency } from "@/lib/meta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_RANGES = new Set([
  "last_7d",
  "last_14d",
  "last_30d",
  "last_90d",
  "maximum",
]);

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  if (!metaConfigured()) {
    return NextResponse.json({ configured: false, ads: [], currency: "USD" });
  }

  const rangeParam = req.nextUrl.searchParams.get("range") || "last_30d";
  const range = ALLOWED_RANGES.has(rangeParam) ? rangeParam : "last_30d";

  try {
    const [ads, currency] = await Promise.all([
      fetchAdStats(range),
      fetchCurrency(),
    ]);
    return NextResponse.json({ configured: true, ads, currency });
  } catch (e) {
    console.error("[/api/admin/ads]", e);
    return NextResponse.json(
      { configured: true, error: (e as Error).message, ads: [], currency: "USD" },
      { status: 502 }
    );
  }
}
