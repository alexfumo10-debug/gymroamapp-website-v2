/**
 * GET /api/admin/consumer-subs — Apple consumer subscriptions (Pro/Pro+,
 * and any other App Store auto-renewables like Trainer Pro).
 *
 * Admin-gated. Returns { configured, tiers } where each tier carries
 * activeCount + MRR (from the SUBSCRIPTION/SUMMARY snapshot) and
 * newThisMonth + canceledThisMonth (summed from SUBSCRIPTION_EVENT
 * daily reports for the current month).
 *
 * Apple gives aggregate event COUNTS (no per-customer email/amount),
 * so we surface tier-level stats rather than an itemized event feed —
 * the Stripe gym-subs route provides the itemized feed.
 *
 * The exact report column names (version 1_4) can drift; parsing is
 * intentionally defensive (sum any "Active *" column; missing columns
 * read as zero) and the route degrades to empty rather than throwing.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-gate";
import { subsConfigured, fetchSalesReport, isAscAuthError } from "@/lib/appstore";
import type { SubscriptionTierStat } from "@/app/gr-panel-7x9k/_lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NAME_COL = "Subscription Name";
const PRICE_COL = "Customer Price";
const DURATION_COL = "Standard Subscription Duration";
const CURRENCY_COL = "Customer Currency";
const SUBSCRIBERS_COL = "Subscribers";
const EVENT_COL = "Event";
const QTY_COL = "Quantity";

function num(s: string | undefined): number {
  const n = parseFloat((s || "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
function day(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Active-subscriber count for a SUBSCRIPTION/SUMMARY row. Prefers Apple's
 * documented unique-count column ("Subscribers") when present; otherwise
 * falls back to summing the active-state count columns. Column names vary
 * by report version, so the fallback matches the offer/win-back variants
 * too, not just "Active "-prefixed ones.
 */
function activeInRow(row: Record<string, string>): number {
  const subscribers = row[SUBSCRIBERS_COL];
  if (subscribers && subscribers.trim() !== "") return num(subscribers);
  let total = 0;
  for (const [k, v] of Object.entries(row)) {
    const key = k.toLowerCase();
    if (
      key.startsWith("active") ||
      key.includes("offer subscriptions") ||
      key.includes("offer code subscriptions") ||
      key.includes("win-back")
    ) {
      total += num(v);
    }
  }
  return total;
}

/** Normalize a per-billing-period price to a monthly figure using the
 *  subscription's duration string (e.g. "1 Year" → /12). */
function toMonthly(price: number, duration: string | undefined): number {
  const d = (duration || "").toLowerCase();
  if (d.includes("year")) return price / 12;
  if (d.includes("week")) return (price * 52) / 12;
  if (d.includes("day")) return (price * 365) / 12;
  return price; // monthly (or unknown → assume monthly)
}

/**
 * Map an Apple SUBSCRIPTION_EVENT "Event" value to our event type.
 * IMPORTANT: "Start Introductory Price" is a free-trial START, not a paid
 * purchase — it must NOT count toward newThisMonth (only the conversion
 * "Paid Subscription from Introductory Price" / a plain new paid sub does).
 */
function eventType(
  ev: string
): "purchase" | "renewal" | "cancellation" | "refund" | null {
  const e = ev.toLowerCase().trim();
  if (e.includes("refund")) return "refund";
  if (e.includes("renew")) return "renewal"; // "Renew", "Renewal from Billing Retry"
  if (
    e === "paid subscription from introductory price" ||
    e === "subscribe" ||
    e === "paid subscription"
  ) {
    return "purchase";
  }
  if (e.includes("cancel")) return "cancellation"; // "Cancel", "Canceled from Billing Retry"
  // "Start Introductory Price", "Reactivate", "Upgrade", etc. → not counted.
  return null;
}

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  if (!subsConfigured()) {
    return NextResponse.json({ configured: false, tiers: [] });
  }

  try {
    const tiers = new Map<string, SubscriptionTierStat>();
    const ensure = (name: string) => {
      const t =
        tiers.get(name) ||
        ({ tier: name, activeCount: 0, mrr: 0, newThisMonth: 0, canceledThisMonth: 0 } as SubscriptionTierStat);
      tiers.set(name, t);
      return t;
    };

    // ── Active snapshot — most recent available DAILY SUMMARY ──
    // Apple lags 1–2 days; walk back until we hit a non-empty report.
    for (let back = 1; back <= 6; back++) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - back);
      const rows = await fetchSalesReport({
        frequency: "DAILY",
        reportType: "SUBSCRIPTION",
        reportSubType: "SUMMARY",
        reportDate: day(d),
      });
      if (rows.length === 0) continue;
      for (const row of rows) {
        const name = row[NAME_COL] || "Subscription";
        const active = activeInRow(row);
        if (active === 0) continue;
        const t = ensure(name);
        t.activeCount += active;
        // MRR is APPROXIMATE — Apple provides no MRR field, so we derive
        // it from Customer Price normalized to monthly. Only sum USD rows
        // to avoid cross-currency addition; non-USD rows still count
        // toward activeCount but are excluded from mrr.
        const currency = (row[CURRENCY_COL] || "USD").toUpperCase();
        if (currency === "USD") {
          t.mrr += active * toMonthly(num(row[PRICE_COL]), row[DURATION_COL]);
        }
      }
      break; // got a snapshot, stop walking back
    }

    // ── Month-to-date events — new / canceled per tier ──
    const now = new Date();
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
    );
    for (
      let d = new Date(monthStart);
      d <= now;
      d.setUTCDate(d.getUTCDate() + 1)
    ) {
      const rows = await fetchSalesReport({
        frequency: "DAILY",
        reportType: "SUBSCRIPTION_EVENT",
        reportSubType: "SUMMARY",
        reportDate: day(d),
      });
      for (const row of rows) {
        const type = eventType(row[EVENT_COL] || "");
        if (!type) continue;
        const t = ensure(row[NAME_COL] || "Subscription");
        const qty = num(row[QTY_COL]) || 1;
        if (type === "purchase") t.newThisMonth += qty;
        else if (type === "cancellation") t.canceledThisMonth += qty;
      }
    }

    return NextResponse.json({
      configured: true,
      tiers: Array.from(tiers.values()),
    });
  } catch (e) {
    console.error("[/api/admin/consumer-subs]", e);
    // Apple rejecting the key → clean placeholder, not a red error.
    if (isAscAuthError(e)) {
      return NextResponse.json({ configured: false, tiers: [] });
    }
    return NextResponse.json(
      { configured: true, error: (e as Error).message, tiers: [] },
      { status: 502 }
    );
  }
}
