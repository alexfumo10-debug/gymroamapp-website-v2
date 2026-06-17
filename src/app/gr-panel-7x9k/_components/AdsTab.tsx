/**
 * Ad Stats tab — Meta ad performance via /api/admin/ads.
 * Connect-ready until the Meta env vars are set.
 */

"use client";

import { useMemo, useState } from "react";
import { useAdminApi, type useAdminAuth } from "../_lib/useAdminData";
import { DATA_SOURCES } from "../_lib/sources";
import { formatCompact } from "../_lib/format";
import type { AdStat, SeriesPoint } from "../_lib/types";
import {
  StatTile,
  Loading,
  ErrorState,
  ConnectReadyState,
  SectionHeading,
} from "./ui";
import { MiniBar, CHART_COLORS } from "./charts";
import tabs from "./tabs.module.css";

type Auth = ReturnType<typeof useAdminAuth>;
interface AdsResponse {
  configured: boolean;
  ads: AdStat[];
  currency: string;
  error?: string;
}

const RANGES = [
  { key: "last_7d", label: "7d" },
  { key: "last_30d", label: "30d" },
  { key: "last_90d", label: "90d" },
] as const;

function money(n: number, currency: string): string {
  try {
    return n.toLocaleString("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: n % 1 === 0 ? 0 : 2,
    });
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

export function AdsTab({ auth }: { auth: Auth }) {
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("last_30d");
  const { data, state } = useAdminApi<AdsResponse>(
    `/api/admin/ads?range=${range}`,
    auth.getIdToken,
    true
  );

  const ads = useMemo(
    () => [...(data?.ads || [])].sort((a, b) => b.spend - a.spend),
    [data]
  );
  const currency = data?.currency || "USD";

  const totals = useMemo(
    () =>
      ads.reduce(
        (acc, a) => ({
          spend: acc.spend + a.spend,
          impressions: acc.impressions + a.impressions,
          clicks: acc.clicks + a.clicks,
          conversions: acc.conversions + (a.conversions || 0),
        }),
        { spend: 0, impressions: 0, clicks: 0, conversions: 0 }
      ),
    [ads]
  );
  const avgCtr = totals.impressions
    ? (totals.clicks / totals.impressions) * 100
    : 0;

  const spendByAd = useMemo<SeriesPoint[]>(
    () =>
      ads.slice(0, 8).map((a) => ({
        label: a.name.length > 16 ? a.name.slice(0, 15) + "…" : a.name,
        value: Math.round(a.spend),
      })),
    [ads]
  );

  if (state === "loading") return <Loading label="Loading ad stats…" />;
  if (data && data.configured === false) {
    return (
      <div>
        <SectionHeading title="Ad Stats" meta="Connect-ready" />
        <ConnectReadyState source={DATA_SOURCES.ads} />
      </div>
    );
  }
  if (state === "error") {
    return <ErrorState message={data?.error || "Failed to load ad stats"} />;
  }

  return (
    <div>
      {/* Range selector */}
      <div className={tabs.toolbar}>
        <div className={tabs.filterChips}>
          {RANGES.map((r) => (
            <button
              key={r.key}
              className={`${tabs.chip} ${range === r.key ? tabs.chipActive : ""}`}
              onClick={() => setRange(r.key)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className={tabs.kpiGrid}>
        <StatTile accent label="Total Spend" value={money(totals.spend, currency)} />
        <StatTile label="Impressions" value={formatCompact(totals.impressions)} />
        <StatTile label="Clicks" value={formatCompact(totals.clicks)} sub={`${avgCtr.toFixed(2)}% CTR`} />
        <StatTile label="Conversions" value={formatCompact(totals.conversions)} sub="installs + purchases" />
      </div>

      {ads.length === 0 ? (
        <div style={{ padding: 32, textAlign: "center", color: "var(--dim)" }}>
          No ad activity in this window.
        </div>
      ) : (
        <>
          <div className={tabs.chartGrid}>
            <div className={`${tabs.chartCard} ${tabs.chartCardWide}`}>
              <h3 className={tabs.chartTitle}>Spend by Ad</h3>
              <p className={tabs.chartSub}>Top {spendByAd.length} by spend ({currency})</p>
              <MiniBar data={spendByAd} color={CHART_COLORS.accent} name="Spend" />
            </div>
          </div>

          <SectionHeading title="Ads" meta={`${ads.length} active`} />
          <div className={tabs.table}>
            <div
              className={`${tabs.row} ${tabs.rowHeader}`}
              style={{ gridTemplateColumns: "44px 1.6fr 90px 80px 90px 70px 70px" }}
            >
              <span />
              <span>Ad</span>
              <span className={tabs.cellRight}>Impr.</span>
              <span className={tabs.cellRight}>Clicks</span>
              <span className={tabs.cellRight}>Spend</span>
              <span className={tabs.cellRight}>CTR</span>
              <span className={tabs.cellRight}>CPC</span>
            </div>
            {ads.map((a) => (
              <div
                key={a.id}
                className={tabs.row}
                style={{ gridTemplateColumns: "44px 1.6fr 90px 80px 90px 70px 70px" }}
              >
                <div className={tabs.adThumb}>
                  {a.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.thumbnailUrl} alt="" width={36} height={36} />
                  ) : (
                    <span className={tabs.adThumbEmpty}>▦</span>
                  )}
                </div>
                <div className={tabs.cellPrimary}>{a.name}</div>
                <div className={`${tabs.cellMuted} ${tabs.cellRight}`}>{formatCompact(a.impressions)}</div>
                <div className={`${tabs.cellMuted} ${tabs.cellRight}`}>{formatCompact(a.clicks)}</div>
                <div className={`${tabs.cellMuted} ${tabs.cellRight}`}>{money(a.spend, currency)}</div>
                <div className={`${tabs.cellDim} ${tabs.cellRight}`}>{a.ctr.toFixed(2)}%</div>
                <div className={`${tabs.cellDim} ${tabs.cellRight}`}>{money(a.cpc, currency)}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
