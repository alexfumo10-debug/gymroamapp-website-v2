/**
 * Affiliate performance — program-wide totals and per-creator detail.
 *
 * Reads /api/admin/affiliate-stats, which runs the same computeStats()
 * the creator dashboard uses. If a creator queries a number here and it
 * doesn't match what they see, that's a bug, not a rounding difference.
 *
 * `readiness` drives the honesty of this view: while the iOS side isn't
 * reporting conversions, install/signup/Pro columns render as "—" with
 * a banner rather than as zeros an admin might act on.
 */

"use client";

import { useMemo, useState } from "react";
import { useAdminApi } from "../_lib/useAdminData";
import { formatCurrency, formatCompact, formatDate } from "../_lib/format";
import { MIN_PAYOUT_USD, CLEARING_DAYS } from "@/lib/affiliate";
import { StatTile, Loading, ErrorState, EmptyHint, Badge } from "./ui";
import tabs from "./tabs.module.css";
import styles from "./AffiliatesTab.module.css";

interface Row {
  applicationId: string;
  fullName: string;
  email: string;
  paymentMethod: string;
  instagramHandle: string;
  tiktokHandle: string;
  code: string;
  trackingLink: string;
  funnel: {
    clicks: number;
    installs: number;
    signups: number;
    proConversions: number;
    conversionRate: number;
  };
  tier: { currentLabel: string; rollingSignups: number; toNextTier: number | null };
  commission: {
    accruedUsd: number;
    clearedUsd: number;
    paidUsd: number;
    payableUsd: number;
    clawbackUsd: number;
    belowMinimum: boolean;
    nextPayoutDate: string;
  };
  ledger: {
    occurredAt: number;
    type: string;
    netUsd: number;
    tierRate: number;
    commissionUsd: number;
    status: string;
    clearsAt: number | null;
  }[];
}

interface Response {
  affiliates: Row[];
  totals: {
    affiliates: number;
    clicks: number;
    installs: number;
    signups: number;
    proConversions: number;
    accruedUsd: number;
    clearedUsd: number;
    paidUsd: number;
    payableUsd: number;
  } | null;
  readiness: {
    clicks: "live" | "pending";
    referrals: "live" | "pending";
    transactions: "live" | "pending";
  };
  error?: string;
}

interface Props {
  auth: { getIdToken: () => Promise<string | null> };
}

/** RFC-4180-ish escaping: quote every field, double any inner quotes.
 *  Creator names contain commas and apostrophes often enough that
 *  naive joining corrupts the payout file. */
function csvCell(v: string | number): string {
  return `"${String(v).replace(/"/g, '""')}"`;
}

export function AffiliatePerformance({ auth }: Props) {
  const { data, state, error } = useAdminApi<Response>(
    "/api/admin/affiliate-stats",
    auth.getIdToken,
    true
  );
  const [openId, setOpenId] = useState<string | null>(null);

  const rows = useMemo(() => data?.affiliates || [], [data]);
  const open = openId ? rows.find((r) => r.applicationId === openId) : null;

  const conversionsPending = data?.readiness.referrals === "pending";
  const moneyPending = data?.readiness.transactions === "pending";

  function exportPayoutCsv() {
    // Only rows that would actually be paid this run. Exporting
    // everyone invites paying someone below the minimum by accident.
    const payable = rows.filter(
      (r) => r.commission.payableUsd >= MIN_PAYOUT_USD
    );
    const header = [
      "Name",
      "Email",
      "Code",
      "Payment Method",
      "Payable USD",
      "Cleared USD",
      "Already Paid USD",
      "Clawback USD",
      "Pro Conversions",
      "Tier",
    ];
    const lines = [
      header.map(csvCell).join(","),
      ...payable.map((r) =>
        [
          r.fullName,
          r.email,
          r.code,
          r.paymentMethod,
          r.commission.payableUsd.toFixed(2),
          r.commission.clearedUsd.toFixed(2),
          r.commission.paidUsd.toFixed(2),
          r.commission.clawbackUsd.toFixed(2),
          r.funnel.proConversions,
          r.tier.currentLabel,
        ]
          .map(csvCell)
          .join(",")
      ),
    ];

    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gymroam-affiliate-payouts-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (state === "loading") return <Loading label="Loading performance…" />;
  if (state === "error") return <ErrorState message={error || data?.error || "failed"} />;
  if (!rows.length) {
    return (
      <EmptyHint>
        No approved affiliates yet. Approve an application and their numbers
        show up here.
      </EmptyHint>
    );
  }

  const t = data!.totals!;
  const payableCount = rows.filter(
    (r) => r.commission.payableUsd >= MIN_PAYOUT_USD
  ).length;

  const GRID = "1.4fr 0.9fr 70px 70px 70px 80px 90px 100px";

  return (
    <div>
      <div className={tabs.kpiGrid}>
        <StatTile label="Active Creators" value={t.affiliates} />
        <StatTile label="Link Clicks" value={formatCompact(t.clicks)} />
        <StatTile
          label="Pro Conversions"
          value={conversionsPending ? "—" : formatCompact(t.proConversions)}
          sub={conversionsPending ? "not tracking yet" : undefined}
        />
        <StatTile
          accent
          label="Payable Now"
          value={moneyPending ? "—" : formatCurrency(t.payableUsd)}
          sub={
            moneyPending
              ? "not tracking yet"
              : `${payableCount} over the ${formatCurrency(MIN_PAYOUT_USD)} minimum`
          }
        />
      </div>

      {(conversionsPending || moneyPending) && (
        <div className={styles.pendingBanner}>
          <strong>Partial data.</strong>{" "}
          {conversionsPending && "Install, signup, and Pro-conversion tracking "}
          {conversionsPending && moneyPending && "and "}
          {moneyPending && "commission reporting "}
          {conversionsPending && moneyPending ? "are" : "is"} waiting on the iOS
          and backend work. Link clicks are live. Columns show &ldquo;—&rdquo;
          rather than zero so nothing here reads as a real result yet.
        </div>
      )}

      <div className={tabs.toolbar}>
        <div className={styles.toolbarNote}>
          Commission clears {CLEARING_DAYS} days after a subscription starts.
          Export includes only creators above the {formatCurrency(MIN_PAYOUT_USD)}{" "}
          minimum.
        </div>
        <button
          className={styles.exportBtn}
          onClick={exportPayoutCsv}
          disabled={payableCount === 0}
        >
          Export payouts ({payableCount})
        </button>
      </div>

      <div className={tabs.table}>
        <div
          className={`${tabs.row} ${tabs.rowHeader}`}
          style={{ gridTemplateColumns: GRID }}
        >
          <span>Creator</span>
          <span>Code</span>
          <span className={tabs.cellRight}>Clicks</span>
          <span className={tabs.cellRight}>Signups</span>
          <span className={tabs.cellRight}>Pro</span>
          <span className={tabs.cellRight}>Tier</span>
          <span className={tabs.cellRight}>Accruing</span>
          <span className={tabs.cellRight}>Payable</span>
        </div>

        {rows.map((r) => (
          <div
            key={r.applicationId}
            className={`${tabs.row} ${tabs.rowClickable}`}
            style={{ gridTemplateColumns: GRID }}
            onClick={() => setOpenId(r.applicationId)}
          >
            <div className={tabs.cellStack}>
              <span className={tabs.cellPrimary}>{r.fullName}</span>
              <span className={tabs.cellSecondary}>{r.email}</span>
            </div>
            <div className={styles.codeCell}>{r.code}</div>
            <div className={`${tabs.cellMuted} ${tabs.cellRight}`}>
              {r.funnel.clicks}
            </div>
            <div className={`${tabs.cellMuted} ${tabs.cellRight}`}>
              {conversionsPending ? "—" : r.funnel.signups}
            </div>
            <div className={`${tabs.cellPrimary} ${tabs.cellRight}`}>
              {conversionsPending ? "—" : r.funnel.proConversions}
            </div>
            <div className={tabs.cellRight}>
              <Badge tone="accent">{r.tier.currentLabel}</Badge>
            </div>
            <div className={`${tabs.cellMuted} ${tabs.cellRight}`}>
              {moneyPending ? "—" : formatCurrency(r.commission.accruedUsd)}
            </div>
            <div className={`${tabs.cellRight} ${styles.payableCell}`}>
              {moneyPending ? "—" : formatCurrency(r.commission.payableUsd)}
            </div>
          </div>
        ))}
      </div>

      {open && (
        <div className={tabs.modalOverlay} onClick={() => setOpenId(null)}>
          <div className={tabs.modal} onClick={(e) => e.stopPropagation()}>
            <div className={tabs.modalHead}>
              <div className={tabs.cellStack}>
                <span className={tabs.modalTitle}>{open.fullName}</span>
                <span className={tabs.cellSecondary}>
                  {open.code} · {open.email}
                </span>
              </div>
              <button
                className={tabs.modalClose}
                onClick={() => setOpenId(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className={tabs.modalBody}>
              <div className={tabs.detailSectionTitle}>Funnel</div>
              <div className={tabs.detailGrid}>
                <Detail k="Link clicks" v={String(open.funnel.clicks)} />
                <Detail
                  k="Installs"
                  v={conversionsPending ? "not tracking yet" : String(open.funnel.installs)}
                />
                <Detail
                  k="Signups"
                  v={conversionsPending ? "not tracking yet" : String(open.funnel.signups)}
                />
                <Detail
                  k="Pro conversions"
                  v={conversionsPending ? "not tracking yet" : String(open.funnel.proConversions)}
                />
                <Detail
                  k="Conversion rate"
                  v={
                    conversionsPending
                      ? "not tracking yet"
                      : `${open.funnel.conversionRate.toFixed(1)}%`
                  }
                />
              </div>

              <div className={tabs.detailSectionTitle}>Tier &amp; commission</div>
              <div className={tabs.detailGrid}>
                <Detail k="Current tier" v={open.tier.currentLabel} />
                <Detail
                  k="Rolling 12mo signups"
                  v={conversionsPending ? "not tracking yet" : String(open.tier.rollingSignups)}
                />
                <Detail
                  k="To next tier"
                  v={open.tier.toNextTier === null ? "top tier" : String(open.tier.toNextTier)}
                />
                <Detail k="Accruing" v={formatCurrency(open.commission.accruedUsd)} />
                <Detail k="Cleared" v={formatCurrency(open.commission.clearedUsd)} />
                <Detail k="Paid" v={formatCurrency(open.commission.paidUsd)} />
                <Detail k="Clawbacks" v={formatCurrency(open.commission.clawbackUsd)} />
                <Detail
                  k="Payable now"
                  v={`${formatCurrency(open.commission.payableUsd)}${
                    open.commission.belowMinimum ? " (under minimum — rolls forward)" : ""
                  }`}
                />
                <Detail k="Payment method" v={open.paymentMethod || "—"} />
              </div>

              <div className={tabs.detailSectionTitle}>
                Commission ledger
              </div>
              {open.ledger.length === 0 ? (
                <EmptyHint>
                  No transactions recorded yet for this code.
                </EmptyHint>
              ) : (
                <div className={styles.ledger}>
                  <div className={`${styles.ledgerRow} ${styles.ledgerHead}`}>
                    <span>Date</span>
                    <span>Type</span>
                    <span className={tabs.cellRight}>Net</span>
                    <span className={tabs.cellRight}>Rate</span>
                    <span className={tabs.cellRight}>Commission</span>
                    <span className={tabs.cellRight}>Status</span>
                  </div>
                  {open.ledger.map((l, i) => (
                    <div key={i} className={styles.ledgerRow}>
                      <span>{formatDate(l.occurredAt)}</span>
                      <span className={tabs.cellMuted}>{l.type}</span>
                      <span className={tabs.cellRight}>
                        {formatCurrency(l.netUsd)}
                      </span>
                      <span className={`${tabs.cellRight} ${tabs.cellMuted}`}>
                        {Math.round(l.tierRate * 100)}%
                      </span>
                      <span className={tabs.cellRight}>
                        {formatCurrency(l.commissionUsd)}
                      </span>
                      <span className={tabs.cellRight}>
                        <Badge
                          tone={
                            l.status === "cleared"
                              ? "green"
                              : l.status === "clawback"
                              ? "red"
                              : "orange"
                          }
                        >
                          {l.status}
                        </Badge>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ k, v }: { k: string; v: string }) {
  return (
    <div className={tabs.detailRow}>
      <span className={tabs.detailKey}>{k}</span>
      <span className={tabs.detailVal}>{v}</span>
    </div>
  );
}
