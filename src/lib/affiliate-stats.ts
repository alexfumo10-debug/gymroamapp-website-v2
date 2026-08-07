/**
 * Affiliate funnel + commission computation. SERVER ONLY.
 *
 * Shared by the creator dashboard (/api/affiliate/me) and the admin
 * view (/api/admin/affiliate-stats) so both render the same numbers
 * from the same code. If these ever disagree, an affiliate and an
 * admin are looking at different money — hence one implementation.
 *
 * ── Why commission is COMPUTED, not stored ──
 * The ledger is derived on read from the raw transaction records
 * rather than incrementally written. That means:
 *   - there is exactly one place the rules live (this file)
 *   - a rule fix corrects history instead of leaving drift behind
 *   - every figure is reproducible from Apple's own records
 * The cost is a full read per query. At current volume that's nothing;
 * if it ever bites, snapshot monthly and compute only the open period.
 *
 * ── Data ownership ──
 * `affiliateCodes` and `affiliateClicks` are written by this website.
 * `affiliateReferrals` and `affiliateTransactions` are written by the
 * iOS/backend side — see docs/affiliate-program-handoff.md for the
 * exact contract. Everything here degrades honestly when those
 * collections are absent: it reports `pending` readiness rather than
 * showing a confident zero.
 */

import type { Firestore, Timestamp } from "firebase-admin/firestore";
import {
  COMMISSION_TIERS,
  ROLLING_WINDOW_DAYS,
  CLEARING_DAYS,
  MIN_PAYOUT_USD,
  tierForSignups,
  signupsToNextTier,
  commissionOnNet,
  trackingLink,
  normalizeCode,
} from "./affiliate";

const DAY_MS = 24 * 60 * 60 * 1000;

/* ────────────────────────────────────────────────────────────
   RAW SHAPES — what the collections hold
   ──────────────────────────────────────────────────────────── */

/** One referred person. Written by the iOS/backend side. */
export interface AffiliateReferral {
  code: string;
  /** GymRoam user id, once they have an account. */
  userId?: string;
  /** Apple's stable per-subscriber id — the join key to transactions. */
  originalTransactionId?: string;
  installedAt?: Timestamp | number | null;
  signedUpAt?: Timestamp | number | null;
  proConvertedAt?: Timestamp | number | null;
  /** Set by the backend's fraud checks; excluded from commission. */
  flagged?: boolean;
  flagReason?: string;
}

/** One money event from Apple. Written by the iOS/backend side. */
export interface AffiliateTransaction {
  code: string;
  originalTransactionId?: string;
  type: "purchase" | "renewal" | "refund" | "chargeback";
  /** What the customer paid. Informational only. */
  grossUsd?: number;
  /** What WE received, after Apple's cut and taxes. Commission basis. */
  netUsd?: number;
  currency?: string;
  occurredAt?: Timestamp | number | null;
}

/* ────────────────────────────────────────────────────────────
   OUTPUT SHAPES — what the dashboards render
   ──────────────────────────────────────────────────────────── */

export type Readiness = "live" | "pending";

export interface FunnelStats {
  clicks: number;
  installs: number;
  signups: number;
  proConversions: number;
  /** Pro conversions ÷ clicks, as a percentage. */
  conversionRate: number;
}

export interface TierStats {
  /** Pro signups inside the rolling window — what sets the tier. */
  rollingSignups: number;
  currentRate: number;
  currentLabel: string;
  /** null once they're at the top tier. */
  toNextTier: number | null;
  nextLabel: string | null;
}

export interface CommissionStats {
  /** Earned but still inside the 30-day clearing window. */
  accruedUsd: number;
  /** Past the clearing window, payable, not yet paid. */
  clearedUsd: number;
  /** Already paid out. */
  paidUsd: number;
  /** Negative adjustments from refunds after a commission cleared. */
  clawbackUsd: number;
  /** cleared − paid: what a payout run would send today. */
  payableUsd: number;
  /** True when payable is under the minimum and rolls forward. */
  belowMinimum: boolean;
  nextPayoutDate: string;
}

export interface LedgerEntry {
  occurredAt: number;
  type: AffiliateTransaction["type"];
  netUsd: number;
  tierRate: number;
  commissionUsd: number;
  status: "accruing" | "cleared" | "clawback";
  clearsAt: number | null;
}

export interface AffiliateStats {
  code: string;
  trackingLink: string;
  funnel: FunnelStats;
  tier: TierStats;
  commission: CommissionStats;
  ledger: LedgerEntry[];
  /** Which inputs are actually wired. The UI must show "pending"
   *  sources as awaiting data rather than as a real zero. */
  readiness: {
    clicks: Readiness;
    referrals: Readiness;
    transactions: Readiness;
  };
}

/* ────────────────────────────────────────────────────────────
   HELPERS
   ──────────────────────────────────────────────────────────── */

function toMillis(v: Timestamp | number | null | undefined): number | null {
  if (v == null) return null;
  if (typeof v === "number") return v < 1e12 ? v * 1000 : v;
  if (typeof (v as Timestamp).toMillis === "function") {
    return (v as Timestamp).toMillis();
  }
  const seconds = (v as unknown as { seconds?: number }).seconds;
  return typeof seconds === "number" ? seconds * 1000 : null;
}

/** First day of next month — payouts run within 30 days of month close. */
function nextPayoutDate(now = Date.now()): string {
  const d = new Date(now);
  const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  return next.toISOString().slice(0, 10);
}

/**
 * The tier rate in force at a given moment.
 *
 * Counts Pro conversions in the rolling window ENDING at `atMs`, so a
 * transaction is rated by what the affiliate had achieved when it
 * happened. This is what makes tier increases forward-only: raising a
 * tier today cannot re-rate a payment earned last month, because that
 * payment's rate was computed against last month's window.
 */
function rateAt(conversionTimes: number[], atMs: number): number {
  const windowStart = atMs - ROLLING_WINDOW_DAYS * DAY_MS;
  let count = 0;
  for (const t of conversionTimes) {
    if (t <= atMs && t >= windowStart) count++;
  }
  return tierForSignups(count).rate;
}

/* ────────────────────────────────────────────────────────────
   LOADERS
   ──────────────────────────────────────────────────────────── */

/**
 * Read every input for one or more codes.
 *
 * A missing collection is not an error — it means the iOS side hasn't
 * shipped its half yet. We distinguish "collection has no documents at
 * all" (pending) from "this affiliate has none" (a real zero) by
 * checking whether the collection holds anything for anyone.
 */
export async function loadRawData(db: Firestore, codes: string[]) {
  const wanted = new Set(codes.map(normalizeCode));

  const [clicksSnap, referralsSnap, txSnap] = await Promise.all([
    db.collection("affiliateClicks").get(),
    db.collection("affiliateReferrals").get(),
    db.collection("affiliateTransactions").get(),
  ]);

  const clicks: Record<string, number> = {};
  clicksSnap.forEach((d) => {
    const code = normalizeCode((d.data() as { code?: string }).code || "");
    if (!wanted.has(code)) return;
    clicks[code] = (clicks[code] || 0) + 1;
  });

  const referrals: Record<string, AffiliateReferral[]> = {};
  referralsSnap.forEach((d) => {
    const r = d.data() as AffiliateReferral;
    const code = normalizeCode(r.code || "");
    if (!wanted.has(code)) return;
    (referrals[code] ||= []).push(r);
  });

  const transactions: Record<string, AffiliateTransaction[]> = {};
  txSnap.forEach((d) => {
    const t = d.data() as AffiliateTransaction;
    const code = normalizeCode(t.code || "");
    if (!wanted.has(code)) return;
    (transactions[code] ||= []).push(t);
  });

  return {
    clicks,
    referrals,
    transactions,
    readiness: {
      // `affiliateClicks` is ours and starts empty and legitimately so —
      // it's live the moment the route is deployed.
      clicks: "live" as Readiness,
      referrals: (referralsSnap.empty ? "pending" : "live") as Readiness,
      transactions: (txSnap.empty ? "pending" : "live") as Readiness,
    },
  };
}

/* ────────────────────────────────────────────────────────────
   COMPUTE
   ──────────────────────────────────────────────────────────── */

export function computeStats(params: {
  code: string;
  clicks: number;
  referrals: AffiliateReferral[];
  transactions: AffiliateTransaction[];
  paidUsd?: number;
  readiness: AffiliateStats["readiness"];
  now?: number;
}): AffiliateStats {
  const {
    code,
    clicks,
    referrals,
    transactions,
    paidUsd = 0,
    readiness,
    now = Date.now(),
  } = params;

  /* ── Funnel ── */
  // Flagged referrals (self-referral, spike heuristics) are excluded
  // from every downstream number, not just commission — a flagged
  // signup must not push someone into a higher tier either.
  const clean = referrals.filter((r) => !r.flagged);

  const installs = clean.filter((r) => toMillis(r.installedAt) != null).length;
  const signups = clean.filter((r) => toMillis(r.signedUpAt) != null).length;
  const conversionTimes = clean
    .map((r) => toMillis(r.proConvertedAt))
    .filter((t): t is number => t != null)
    .sort((a, b) => a - b);
  const proConversions = conversionTimes.length;

  const funnel: FunnelStats = {
    clicks,
    installs,
    signups,
    proConversions,
    conversionRate: clicks > 0 ? (proConversions / clicks) * 100 : 0,
  };

  /* ── Tier (as of now) ── */
  const windowStart = now - ROLLING_WINDOW_DAYS * DAY_MS;
  const rollingSignups = conversionTimes.filter((t) => t >= windowStart).length;
  const current = tierForSignups(rollingSignups);
  const toNext = signupsToNextTier(rollingSignups);
  const nextTier = COMMISSION_TIERS[COMMISSION_TIERS.indexOf(current) + 1];

  const tier: TierStats = {
    rollingSignups,
    currentRate: current.rate,
    currentLabel: current.label,
    toNextTier: toNext,
    nextLabel: nextTier ? nextTier.label : null,
  };

  /* ── Commission ledger ── */
  // Which subscriptions ended badly, and when. A refund or chargeback
  // kills the commission on that subscriber: before the clearing
  // window closes it simply never accrues; after, it's a clawback.
  const terminatedAt = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== "refund" && t.type !== "chargeback") continue;
    const at = toMillis(t.occurredAt);
    const key = t.originalTransactionId || "";
    if (at == null || !key) continue;
    const existing = terminatedAt.get(key);
    if (existing == null || at < existing) terminatedAt.set(key, at);
  }

  const ledger: LedgerEntry[] = [];
  let accruedUsd = 0;
  let clearedUsd = 0;
  let clawbackUsd = 0;

  for (const t of transactions) {
    const at = toMillis(t.occurredAt);
    if (at == null) continue;

    // Earning events only. Refunds are handled via `terminatedAt`, so
    // they don't produce their own positive entry.
    if (t.type !== "purchase" && t.type !== "renewal") continue;

    // Commission is on NET — what we actually received. A transaction
    // with no net figure yet (Apple's financials lag the event) is not
    // guessed at; it's skipped until the real number lands.
    const netUsd = typeof t.netUsd === "number" ? t.netUsd : null;
    if (netUsd == null) continue;

    const rate = rateAt(conversionTimes, at);
    const commissionUsd = commissionOnNet(netUsd, rate);
    const clearsAt = at + CLEARING_DAYS * DAY_MS;

    const killedAt = terminatedAt.get(t.originalTransactionId || "");
    const killedBeforeClearing = killedAt != null && killedAt < clearsAt;
    const killedAfterClearing = killedAt != null && killedAt >= clearsAt;

    if (killedBeforeClearing) {
      // Refunded inside the window — never accrues, nothing to show
      // beyond the fact that it happened.
      ledger.push({
        occurredAt: at,
        type: t.type,
        netUsd,
        tierRate: rate,
        commissionUsd: 0,
        status: "clawback",
        clearsAt: null,
      });
      continue;
    }

    if (killedAfterClearing) {
      // Cleared, paid or payable, then refunded: claw it back.
      clearedUsd += commissionUsd;
      clawbackUsd += commissionUsd;
      ledger.push({
        occurredAt: at,
        type: t.type,
        netUsd,
        tierRate: rate,
        commissionUsd,
        status: "clawback",
        clearsAt,
      });
      continue;
    }

    if (now >= clearsAt) {
      clearedUsd += commissionUsd;
      ledger.push({
        occurredAt: at,
        type: t.type,
        netUsd,
        tierRate: rate,
        commissionUsd,
        status: "cleared",
        clearsAt,
      });
    } else {
      accruedUsd += commissionUsd;
      ledger.push({
        occurredAt: at,
        type: t.type,
        netUsd,
        tierRate: rate,
        commissionUsd,
        status: "accruing",
        clearsAt,
      });
    }
  }

  ledger.sort((a, b) => b.occurredAt - a.occurredAt);

  const payableUsd = Math.max(0, clearedUsd - clawbackUsd - paidUsd);

  const commission: CommissionStats = {
    accruedUsd,
    clearedUsd,
    paidUsd,
    clawbackUsd,
    payableUsd,
    belowMinimum: payableUsd > 0 && payableUsd < MIN_PAYOUT_USD,
    nextPayoutDate: nextPayoutDate(now),
  };

  return {
    code,
    trackingLink: trackingLink(code),
    funnel,
    tier,
    commission,
    ledger,
    readiness,
  };
}
