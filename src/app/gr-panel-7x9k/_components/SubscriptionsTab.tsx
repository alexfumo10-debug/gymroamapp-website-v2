/**
 * Subscriptions tab — combines two sources:
 *   - Gym Partner (Stripe, B2B $99/mo)        → /api/admin/gym-subs
 *   - Consumer Pro / Pro+ / Trainer (Apple IAP) → /api/admin/consumer-subs
 *
 * Each source renders live when configured, or a slim "connect this
 * source" note when its credentials aren't set — so the tab is useful
 * even with only one side wired (Stripe key already exists; Apple
 * needs the App Store Connect key).
 */

"use client";

import { useMemo } from "react";
import { useAdminApi, type useAdminAuth } from "../_lib/useAdminData";
import { DATA_SOURCES } from "../_lib/sources";
import { formatCurrency, formatDateTime } from "../_lib/format";
import type { SubscriptionTierStat, SubscriptionEvent } from "../_lib/types";
import { StatTile, Loading, SectionHeading, Badge, Card } from "./ui";
import tabs from "./tabs.module.css";

type Auth = ReturnType<typeof useAdminAuth>;
interface SubsResponse {
  configured: boolean;
  tiers: SubscriptionTierStat[];
  events?: SubscriptionEvent[];
  error?: string;
}

function TierCard({ t }: { t: SubscriptionTierStat }) {
  return (
    <Card>
      <div className={tabs.tierTop}>
        <span className={tabs.tierName}>{t.tier}</span>
        <span className={tabs.tierMrr}>{formatCurrency(t.mrr, true)}/mo</span>
      </div>
      <div className={tabs.tierActive}>{t.activeCount.toLocaleString()}</div>
      <div className={tabs.tierLabel}>active subscribers</div>
      <div className={tabs.tierFooter}>
        <span style={{ color: "var(--green)" }}>+{t.newThisMonth} new</span>
        <span style={{ color: "var(--red)" }}>−{t.canceledThisMonth} canceled</span>
        <span className={tabs.cellDim}>this month</span>
      </div>
    </Card>
  );
}

export function SubscriptionsTab({ auth }: { auth: Auth }) {
  const gym = useAdminApi<SubsResponse>("/api/admin/gym-subs", auth.getIdToken, true);
  const consumer = useAdminApi<SubsResponse>(
    "/api/admin/consumer-subs",
    auth.getIdToken,
    true
  );

  const loading = gym.state === "loading" || consumer.state === "loading";

  const allTiers = useMemo<SubscriptionTierStat[]>(() => {
    const g = gym.data?.configured ? gym.data.tiers || [] : [];
    const c = consumer.data?.configured ? consumer.data.tiers || [] : [];
    return [...g, ...c];
  }, [gym.data, consumer.data]);

  const totals = useMemo(() => {
    return allTiers.reduce(
      (acc, t) => ({
        active: acc.active + t.activeCount,
        mrr: acc.mrr + t.mrr,
        nu: acc.nu + t.newThisMonth,
        canc: acc.canc + t.canceledThisMonth,
      }),
      { active: 0, mrr: 0, nu: 0, canc: 0 }
    );
  }, [allTiers]);

  const events = gym.data?.configured ? gym.data.events || [] : [];

  if (loading) return <Loading label="Loading subscriptions…" />;

  const gymUnconfigured = gym.data && gym.data.configured === false;
  const consumerUnconfigured = consumer.data && consumer.data.configured === false;

  return (
    <div>
      <div className={tabs.kpiGrid}>
        <StatTile accent label="Total MRR" value={formatCurrency(totals.mrr, true)} />
        <StatTile label="Active Subscribers" value={totals.active.toLocaleString()} />
        <StatTile label="New This Month" value={totals.nu} />
        <StatTile label="Canceled This Month" value={totals.canc} invertDelta />
      </div>

      {/* Tier cards */}
      {allTiers.length > 0 && (
        <>
          <SectionHeading
            title="By Tier"
            meta={
              consumer.data?.configured
                ? "App Store MRR is estimated from Apple price reports"
                : undefined
            }
          />
          <div className={tabs.chartGrid}>
            {allTiers.map((t) => (
              <TierCard key={t.tier} t={t} />
            ))}
          </div>
        </>
      )}

      {/* Load errors (502 from a source) — surfaced, not swallowed */}
      {(gym.state === "error" || consumer.state === "error") && (
        <div className={tabs.connectNotes}>
          {gym.state === "error" && (
            <div className={tabs.connectNote}>
              <Badge tone="red">Stripe</Badge>
              <span>{gym.error || "Failed to load gym partner subscriptions"}</span>
            </div>
          )}
          {consumer.state === "error" && (
            <div className={tabs.connectNote}>
              <Badge tone="red">App Store</Badge>
              <span>{consumer.error || "Failed to load Apple subscriptions"}</span>
            </div>
          )}
        </div>
      )}

      {/* Source connection notes */}
      {(gymUnconfigured || consumerUnconfigured) && (
        <div className={tabs.connectNotes}>
          {gymUnconfigured && (
            <div className={tabs.connectNote}>
              <Badge tone="orange">Stripe</Badge>
              <span>
                Gym Partner subscriptions not connected —{" "}
                set <code>STRIPE_SECRET_KEY</code>.
              </span>
            </div>
          )}
          {consumerUnconfigured && (
            <div className={tabs.connectNote}>
              <Badge tone="orange">App Store Connect</Badge>
              <span>
                Pro / Pro+ (Apple) not connected — needs the App Store
                Connect API key + vendor number.{" "}
                {DATA_SOURCES.consumerSubs.setupHint}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Stripe itemized events */}
      {events.length > 0 && (
        <>
          <SectionHeading title="Recent Activity" meta="Stripe · gym partners" />
          <div className={tabs.table}>
            <div
              className={`${tabs.row} ${tabs.rowHeader}`}
              style={{ gridTemplateColumns: "120px 1fr 100px 140px" }}
            >
              <span>Type</span>
              <span>Customer</span>
              <span className={tabs.cellRight}>Amount</span>
              <span className={tabs.cellRight}>When</span>
            </div>
            {events.map((e) => (
              <div
                key={e.id}
                className={tabs.row}
                style={{ gridTemplateColumns: "120px 1fr 100px 140px" }}
              >
                <div>
                  <Badge
                    tone={
                      e.type === "cancellation" || e.type === "refund"
                        ? "red"
                        : e.type === "renewal"
                        ? "blue"
                        : "green"
                    }
                  >
                    {e.type}
                  </Badge>
                </div>
                <div className={tabs.cellMuted}>{e.email || "—"}</div>
                <div className={`${tabs.cellMuted} ${tabs.cellRight}`}>
                  {e.amount ? formatCurrency(e.amount) : "—"}
                </div>
                <div className={`${tabs.cellDim} ${tabs.cellRight}`}>
                  {formatDateTime(e.at)}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {allTiers.length === 0 && !gymUnconfigured && !consumerUnconfigured && (
        <Card>
          <p className={tabs.chartSub}>No active subscriptions yet.</p>
        </Card>
      )}
    </div>
  );
}
