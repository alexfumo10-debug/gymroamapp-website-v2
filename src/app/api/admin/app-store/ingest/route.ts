/**
 * POST /api/admin/app-store/ingest — populate the App Store funnel cache.
 *
 * Downloads the latest App Store Connect Analytics reports (Discovery &
 * Engagement + App Downloads), computes the impressions → product page
 * views → downloads funnel, and writes it to Firestore
 * adminIntegrations/appStoreAnalytics. The read route
 * (/api/admin/app-store) serves that cache to the Traffic tab.
 *
 * Apple's analytics data lags ~2 days, so this is meant to run DAILY
 * (Vercel Cron — see vercel.json). It's idempotent: re-running just
 * overwrites the cache with the freshest numbers.
 *
 * Auth: an admin Firebase ID token (humans), OR — so a Vercel Cron, which
 * can't mint a Firebase token, can drive it — a bearer matching
 * CRON_SECRET. Vercel automatically sends `Authorization: Bearer
 * $CRON_SECRET` to cron-invoked routes. GET and POST both work.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-gate";
import { subsConfigured, fetchAnalyticsFunnel } from "@/lib/appstore";
import { adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** True when the request carries the Vercel cron bearer secret. */
function isCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

async function ingest(req: NextRequest) {
  // Cron secret OR admin token. Cron is checked first so it never trips
  // the admin allowlist (the cron bearer isn't a Firebase ID token).
  if (!isCron(req)) {
    const denied = await requireAdmin(req);
    if (denied) return denied;
  }

  if (!subsConfigured()) {
    return NextResponse.json(
      { ok: false, error: "App Store Connect key not configured" },
      { status: 503 }
    );
  }

  try {
    const funnel = await fetchAnalyticsFunnel(30);

    // No rows yet (Apple still generating the first report) — don't write
    // an all-zero doc that would mask the UI's "pending first report" state.
    if (!funnel.asOf) {
      return NextResponse.json({
        ok: true,
        wrote: false,
        reason: "no analytics rows available yet",
        funnel,
      });
    }

    await adminDb()
      .collection("adminIntegrations")
      .doc("appStoreAnalytics")
      .set(
        { ...funnel, updatedAt: new Date().toISOString() },
        { merge: true }
      );

    return NextResponse.json({ ok: true, wrote: true, funnel });
  } catch (e) {
    console.error("[/api/admin/app-store/ingest]", e);
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 502 }
    );
  }
}

export const POST = ingest;
export const GET = ingest;
