/**
 * GET /api/admin/reviews — App Store customer ratings & reviews.
 *
 * Admin-gated. Returns { configured, reviews } where `configured` is
 * false (200, not an error) when the App Store Connect key isn't set
 * yet, so the Reviews tab can render its connect-ready state instead
 * of erroring.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-gate";
import { reviewsConfigured, fetchReviews, isAscAuthError } from "@/lib/appstore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  if (!reviewsConfigured()) {
    return NextResponse.json({ configured: false, reviews: [] });
  }

  try {
    const reviews = await fetchReviews(200);
    return NextResponse.json({ configured: true, reviews });
  } catch (e) {
    console.error("[/api/admin/reviews]", e);
    // Apple rejecting the key (wrong-account / not-yet-valid) → show the
    // clean connect-ready placeholder, not a red error.
    if (isAscAuthError(e)) {
      return NextResponse.json({ configured: false, reviews: [] });
    }
    return NextResponse.json(
      { configured: true, error: (e as Error).message, reviews: [] },
      { status: 502 }
    );
  }
}
