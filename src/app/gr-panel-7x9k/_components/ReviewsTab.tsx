/**
 * Reviews tab — App Store ratings & reviews via /api/admin/reviews.
 * Shows the connect-ready state until the App Store Connect key is set.
 */

"use client";

import { useMemo } from "react";
import { useAdminApi, type useAdminAuth } from "../_lib/useAdminData";
import { DATA_SOURCES } from "../_lib/sources";
import { formatDate } from "../_lib/format";
import type { Review, SeriesPoint } from "../_lib/types";
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
interface ReviewsResponse {
  configured: boolean;
  reviews: Review[];
  error?: string;
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className={tabs.stars} aria-label={`${rating} of 5 stars`}>
      {"★".repeat(Math.max(0, Math.min(5, rating)))}
      <span className={tabs.starsEmpty}>
        {"★".repeat(Math.max(0, 5 - rating))}
      </span>
    </span>
  );
}

export function ReviewsTab({ auth }: { auth: Auth }) {
  const { data, state } = useAdminApi<ReviewsResponse>(
    "/api/admin/reviews",
    auth.getIdToken,
    true
  );

  const reviews = data?.reviews || [];
  const stats = useMemo(() => {
    if (reviews.length === 0) return { avg: 0, positive: 0 };
    const sum = reviews.reduce((a, r) => a + r.rating, 0);
    const positive = reviews.filter((r) => r.rating >= 4).length;
    return {
      avg: sum / reviews.length,
      positive: Math.round((positive / reviews.length) * 100),
    };
  }, [reviews]);

  const distribution = useMemo<SeriesPoint[]>(() => {
    const counts = [0, 0, 0, 0, 0];
    reviews.forEach((r) => {
      const i = Math.max(1, Math.min(5, r.rating)) - 1;
      counts[i] += 1;
    });
    return [5, 4, 3, 2, 1].map((star) => ({
      label: `${star}★`,
      value: counts[star - 1],
    }));
  }, [reviews]);

  if (state === "loading") return <Loading label="Loading reviews…" />;
  if (data && data.configured === false) {
    return (
      <div>
        <SectionHeading title="Ratings & Reviews" meta="Connect-ready" />
        <ConnectReadyState source={DATA_SOURCES.reviews} />
      </div>
    );
  }
  if (state === "error") {
    return <ErrorState message={data?.error || "Failed to load reviews"} />;
  }

  return (
    <div>
      <div className={tabs.kpiGrid}>
        <StatTile accent label="Average Rating" value={stats.avg.toFixed(2)} sub="out of 5" />
        <StatTile label="Total Reviews" value={reviews.length} sub="with text" />
        <StatTile label="Positive (4–5★)" value={`${stats.positive}%`} />
      </div>

      <div className={tabs.chartGrid}>
        <div className={`${tabs.chartCard} ${tabs.chartCardWide}`}>
          <h3 className={tabs.chartTitle}>Rating Distribution</h3>
          <p className={tabs.chartSub}>Count per star rating</p>
          <MiniBar data={distribution} color={CHART_COLORS.accent} name="Reviews" />
        </div>
      </div>

      <SectionHeading title="Recent Reviews" meta={`${reviews.length} shown`} />
      <div className={tabs.table}>
        {reviews.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--dim)" }}>
            No written reviews yet.
          </div>
        ) : (
          reviews.map((r) => (
            <div key={r.id} className={tabs.fbItem}>
              <div className={tabs.fbTop}>
                <Stars rating={r.rating} />
                {r.title && <span className={tabs.fbTitle}>{r.title}</span>}
                <span className={tabs.fbMeta} style={{ marginLeft: "auto" }}>
                  {r.territory || ""} · {formatDate(r.at, { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </div>
              {r.body && <p className={tabs.fbDesc}>{r.body}</p>}
              <div className={tabs.fbMeta}>— {r.author}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
