/**
 * Traffic tab — website page-view analytics from Firestore /pageViews.
 * Daily trend + top pages + referrer breakdown, all real data.
 */

"use client";

import { useMemo } from "react";
import { useCollection, useAdminApi, type useAdminAuth } from "../_lib/useAdminData";
import { buildDailySeries, withinDays, formatCompact } from "../_lib/format";
import type { PageView, SeriesPoint } from "../_lib/types";
import { StatTile, Loading, ErrorState, SectionHeading } from "./ui";
import { TrendArea, MiniBar, Donut, ChartLegend, CHART_COLORS } from "./charts";
import tabs from "./tabs.module.css";

type Auth = ReturnType<typeof useAdminAuth>;

interface AppStoreResponse {
  configured: boolean;
  downloads: { total: number; series: SeriesPoint[] } | null;
  funnel: {
    impressions?: number;
    productPageViews?: number;
    conversionRate?: number;
    asOf?: string;
    lifetimeFirstTimeDownloads?: number;
    lifetimeAsOf?: string;
  } | null;
  error?: string;
}

/** Count occurrences of a derived key, return top-N as a series. */
function topCounts<T>(
  items: T[],
  getKey: (t: T) => string,
  topN: number
): SeriesPoint[] {
  const counts: Record<string, number> = {};
  items.forEach((it) => {
    const k = getKey(it) || "(unknown)";
    counts[k] = (counts[k] || 0) + 1;
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([label, value]) => ({ label, value }));
}

export function TrafficTab({ auth }: { auth: Auth }) {
  const views = useCollection<PageView>("pageViews", { orderField: "createdAt" });
  const appStore = useAdminApi<AppStoreResponse>(
    "/api/admin/app-store",
    auth.getIdToken,
    true
  );

  const series = useMemo(
    () => buildDailySeries(views.data, (v) => v.createdAt, 30),
    [views.data]
  );
  const topPages = useMemo(
    () => topCounts(views.data, (v) => v.path, 8),
    [views.data]
  );
  const referrers = useMemo(() => {
    const data = topCounts(
      views.data,
      (v) => {
        const r = (v.referrer || "").trim();
        if (!r) return "Direct";
        try {
          return new URL(r).hostname.replace(/^www\./, "");
        } catch {
          return r;
        }
      },
      6
    );
    return data;
  }, [views.data]);

  const total = views.data.length;
  const views7d = views.data.filter((v) => withinDays(v.createdAt, 7)).length;
  const uniqueSessions = useMemo(
    () => new Set(views.data.map((v) => v.sessionId).filter(Boolean)).size,
    [views.data]
  );

  if (views.state === "loading") return <Loading label="Loading traffic…" />;
  if (views.state === "error") return <ErrorState message={views.error} />;

  const as = appStore.data;
  const dl = as?.downloads;
  const fn = as?.funnel;

  return (
    <div>
      <SectionHeading title="Website" meta="gymroamapp.com · first-party, bot-filtered" />
      <div className={tabs.kpiGrid}>
        <StatTile accent label="Total Page Views" value={formatCompact(total)} />
        <StatTile label="Views (7d)" value={formatCompact(views7d)} />
        <StatTile label="Unique Sessions" value={formatCompact(uniqueSessions)} />
        <StatTile
          label="Top Page"
          value={
            <span style={{ fontSize: 18 }}>{topPages[0]?.label || "—"}</span>
          }
          sub={topPages[0] ? `${topPages[0].value} views` : undefined}
        />
      </div>

      <div className={tabs.chartGrid}>
        <div className={`${tabs.chartCard} ${tabs.chartCardWide}`}>
          <h3 className={tabs.chartTitle}>Page Views</h3>
          <p className={tabs.chartSub}>Daily, last 30 days</p>
          <TrendArea data={series} color={CHART_COLORS.blue} name="Views" />
        </div>

        <div className={tabs.chartCard}>
          <h3 className={tabs.chartTitle}>Top Pages</h3>
          <p className={tabs.chartSub}>By total views</p>
          {topPages.length ? (
            <MiniBar data={topPages} color={CHART_COLORS.accent} name="Views" />
          ) : (
            <p className={tabs.chartSub}>No data yet.</p>
          )}
        </div>

        <div className={tabs.chartCard}>
          <h3 className={tabs.chartTitle}>Referrers</h3>
          <p className={tabs.chartSub}>Where visitors come from</p>
          {referrers.length ? (
            <div className={tabs.donutWrap}>
              <Donut data={referrers} height={180} />
              <ChartLegend data={referrers} />
            </div>
          ) : (
            <p className={tabs.chartSub}>No data yet.</p>
          )}
        </div>
      </div>

      {/* ── App Store section ── */}
      <SectionHeading
        title="App Store"
        meta={
          appStore.state === "loading"
            ? "loading…"
            : as?.configured === false
            ? "needs App Store Connect key"
            : "App Store Connect"
        }
      />
      {appStore.state === "error" && as?.configured !== false ? (
        <p className={tabs.chartSub} style={{ color: "var(--red)" }}>
          Couldn&apos;t load App Store data: {appStore.error || as?.error || "request failed"}
        </p>
      ) : as?.configured === false ? (
        <p className={tabs.chartSub}>
          Connect the App Store Connect key (Subscriptions tab) to see App
          Store data here.
        </p>
      ) : (
        <>
          <div className={tabs.kpiGrid}>
            <StatTile
              accent
              label="Downloads (Lifetime)"
              value={
                fn?.lifetimeFirstTimeDownloads != null
                  ? formatCompact(fn.lifetimeFirstTimeDownloads)
                  : "—"
              }
              sub="first-time, since launch (matches App Store Connect)"
            />
            <StatTile
              label="Downloads (30d)"
              value={dl ? formatCompact(dl.total) : "—"}
              sub="first-time installs"
            />
            <StatTile
              label="Impressions"
              value={fn?.impressions != null ? formatCompact(fn.impressions) : "—"}
              sub={fn ? undefined : "pending first report"}
            />
            <StatTile
              label="Product Page Views"
              value={fn?.productPageViews != null ? formatCompact(fn.productPageViews) : "—"}
              sub={fn ? undefined : "pending first report"}
            />
            <StatTile
              label="Conversion Rate"
              value={fn?.conversionRate != null ? `${fn.conversionRate.toFixed(1)}%` : "—"}
              sub={fn ? undefined : "pending first report"}
            />
          </div>

          <div className={tabs.chartGrid}>
            <div className={`${tabs.chartCard} ${tabs.chartCardWide}`}>
              <h3 className={tabs.chartTitle}>App Store Downloads</h3>
              <p className={tabs.chartSub}>First-time installs per day (data lags ~2 days)</p>
              {dl && dl.series.length ? (
                <TrendArea data={dl.series} color={CHART_COLORS.green} name="Downloads" />
              ) : (
                <p className={tabs.chartSub}>
                  {appStore.state === "loading" ? "Loading…" : "No download data yet."}
                </p>
              )}
            </div>
          </div>

          {!fn && (
            <p className={tabs.chartSub} style={{ marginTop: -12 }}>
              📊 Impressions, product page views & conversion rate populate
              within ~1–2 days — Apple is generating the first analytics
              report (requested {""}
              just now), after which they refresh daily.
            </p>
          )}
        </>
      )}
    </div>
  );
}
