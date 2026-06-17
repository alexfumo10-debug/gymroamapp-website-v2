/**
 * GET /api/admin/app-store — App Store page analytics.
 *
 * Two data tiers:
 *   • downloads — first-time installs per day from the SALES report
 *     (live-ish, next-day data). Available now.
 *   • funnel    — impressions / product page views / conversion rate from
 *     the async Analytics Reports API, ingested daily into Firestore
 *     (adminIntegrations/appStoreAnalytics). Null until Apple generates
 *     the first report (~1–2 days after the request) and the ingestion
 *     job runs.
 *
 * Admin-gated. Uses the same App Store Connect key as reviews/subs.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-gate";
import { subsConfigured, fetchDownloads } from "@/lib/appstore";
import { adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface FunnelCache {
  impressions?: number;
  productPageViews?: number;
  downloads?: number;
  conversionRate?: number;
  asOf?: string; // ISO date the cached data covers through
}

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  if (!subsConfigured()) {
    // Needs the App Store Connect key + vendor number (same as subs).
    return NextResponse.json({ configured: false, downloads: null, funnel: null });
  }

  // Funnel comes from the ingestion cache — read it (may not exist yet).
  let funnel: FunnelCache | null = null;
  try {
    const snap = await adminDb()
      .collection("adminIntegrations")
      .doc("appStoreAnalytics")
      .get();
    if (snap.exists) funnel = snap.data() as FunnelCache;
  } catch (e) {
    console.error("[/api/admin/app-store] funnel cache read:", e);
  }

  try {
    const downloads = await fetchDownloads(30);
    return NextResponse.json({ configured: true, downloads, funnel });
  } catch (e) {
    console.error("[/api/admin/app-store] downloads:", e);
    return NextResponse.json(
      { configured: true, error: (e as Error).message, downloads: null, funnel },
      { status: 502 }
    );
  }
}
