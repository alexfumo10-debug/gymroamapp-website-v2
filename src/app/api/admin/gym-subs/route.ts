/**
 * GET /api/admin/gym-subs — Stripe Gym Partner subscriptions ($99/mo B2B).
 *
 * Admin-gated. Returns { configured, tiers, events }.
 * Only the Gym Partner tier lives on Stripe; consumer Pro/Pro+ are
 * Apple IAP and come from /api/admin/consumer-subs.
 *
 * Notes baked in from the integration research:
 *   - stripe@22 (API 2026-03-25.dahlia): do NOT pin an older apiVersion;
 *     Subscription.current_period_* moved onto items.data[] (we don't
 *     need period here — only price + status + product).
 *   - Events API retains 30 days, so new/canceled "this month" is exact
 *     for the current month only.
 *   - Amounts are in cents; MRR is interval-normalized to monthly.
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { requireAdmin } from "@/lib/admin-gate";
import type {
  SubscriptionTierStat,
  SubscriptionEvent,
} from "@/app/gr-panel-7x9k/_lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripe) stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
  return stripe;
}

/** Normalize a price's recurring amount to a monthly figure (USD dollars). */
function monthlyAmount(price: Stripe.Price | null | undefined): number {
  if (!price || !price.unit_amount) return 0;
  const cents = price.unit_amount;
  const interval = price.recurring?.interval;
  const count = price.recurring?.interval_count || 1;
  let monthlyCents = cents;
  if (interval === "year") monthlyCents = cents / (12 * count);
  else if (interval === "week") monthlyCents = (cents * 52) / (12 * count);
  else if (interval === "day") monthlyCents = (cents * 365) / (12 * count);
  else monthlyCents = cents / count; // month
  return monthlyCents / 100;
}

function tierName(price: Stripe.Price | undefined): string {
  const product = price?.product;
  if (product && typeof product === "object" && "name" in product) {
    return (product as Stripe.Product).name || "Gym Partner";
  }
  return "Gym Partner";
}

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ configured: false, tiers: [], events: [] });
  }

  try {
    const s = getStripe();

    // ── Active subscriptions → per-tier activeCount + MRR ──
    const subs = await s.subscriptions
      .list({
        status: "active",
        limit: 100,
        expand: ["data.items.data.price.product"],
      })
      .autoPagingToArray({ limit: 10000 });

    const tierMap = new Map<string, SubscriptionTierStat>();
    for (const sub of subs) {
      const item = sub.items.data[0];
      const price = item?.price;
      const tier = tierName(price);
      const row =
        tierMap.get(tier) ||
        ({ tier, activeCount: 0, mrr: 0, newThisMonth: 0, canceledThisMonth: 0 } as SubscriptionTierStat);
      row.activeCount += 1;
      row.mrr += monthlyAmount(price) * (item?.quantity || 1);
      tierMap.set(tier, row);
    }

    // ── This-month created / canceled counts (Events, 30-day window) ──
    // Use a UTC month boundary — Stripe's `created` filter is UTC epoch
    // seconds, so a local-time boundary would misattribute events near
    // the 1st on a non-UTC server.
    const nowD = new Date();
    const startOfMonth = Math.floor(
      Date.UTC(nowD.getUTCFullYear(), nowD.getUTCMonth(), 1) / 1000
    );
    const monthEvents = await s.events
      .list({
        types: [
          "customer.subscription.created",
          "customer.subscription.deleted",
        ],
        created: { gte: startOfMonth },
        limit: 100,
      })
      .autoPagingToArray({ limit: 10000 });

    // Without a per-event tier lookup we attribute month counts to the
    // single Stripe tier (Gym Partner); refine if more Stripe tiers are added.
    const soleTier = tierMap.keys().next().value || "Gym Partner";
    for (const ev of monthEvents) {
      const row =
        tierMap.get(soleTier) ||
        ({ tier: soleTier, activeCount: 0, mrr: 0, newThisMonth: 0, canceledThisMonth: 0 } as SubscriptionTierStat);
      if (ev.type === "customer.subscription.created") row.newThisMonth += 1;
      if (ev.type === "customer.subscription.deleted") row.canceledThisMonth += 1;
      tierMap.set(soleTier, row);
    }

    // ── Recent events feed → SubscriptionEvent[] ──
    const recent = await s.events
      .list({
        types: ["invoice.paid", "customer.subscription.deleted"],
        limit: 40,
      })
      .autoPagingToArray({ limit: 40 });

    const events: SubscriptionEvent[] = [];
    for (const ev of recent) {
      if (ev.type === "invoice.paid") {
        const inv = ev.data.object as Stripe.Invoice;
        const reason = inv.billing_reason;
        events.push({
          id: ev.id,
          tier: "Gym Partner",
          type: reason === "subscription_cycle" ? "renewal" : "purchase",
          amount: (inv.amount_paid || 0) / 100,
          email: inv.customer_email || undefined,
          at: ev.created * 1000,
        });
      } else if (ev.type === "customer.subscription.deleted") {
        events.push({
          id: ev.id,
          tier: "Gym Partner",
          type: "cancellation",
          amount: 0,
          at: ev.created * 1000,
        });
      }
    }

    return NextResponse.json({
      configured: true,
      tiers: Array.from(tierMap.values()),
      events,
    });
  } catch (e) {
    console.error("[/api/admin/gym-subs]", e);
    return NextResponse.json(
      { configured: true, error: (e as Error).message, tiers: [], events: [] },
      { status: 502 }
    );
  }
}
