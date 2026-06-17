/**
 * Feedback tab — read view of the public feedback board.
 *
 * Status breakdown donut + a filterable list. (Status-change /
 * delete actions from the live panel are intentionally left out of
 * this v2 read view for now; they'll be ported once the rebuild is
 * approved so we don't fork the write logic mid-flight.)
 */

"use client";

import { useMemo, useState } from "react";
import { useCollection } from "../_lib/useAdminData";
import { formatDate } from "../_lib/format";
import type { FeedbackItem, FeedbackStatus, SeriesPoint } from "../_lib/types";
import { StatTile, Loading, ErrorState, Badge } from "./ui";
import { Donut, ChartLegend } from "./charts";
import tabs from "./tabs.module.css";

const STATUS_ORDER: FeedbackStatus[] = [
  "under review",
  "planned",
  "in progress",
  "shipped",
];

const STATUS_TONE: Record<FeedbackStatus, "neutral" | "blue" | "accent" | "green"> = {
  "under review": "neutral",
  planned: "blue",
  "in progress": "accent",
  shipped: "green",
};

export function FeedbackTab() {
  const feedback = useCollection<FeedbackItem>("feedback", {
    orderField: "createdAt",
  });
  const [filter, setFilter] = useState<"all" | FeedbackStatus>("all");

  const byStatus = useMemo<SeriesPoint[]>(() => {
    const counts: Record<string, number> = {};
    feedback.data.forEach((f) => {
      counts[f.status] = (counts[f.status] || 0) + 1;
    });
    return STATUS_ORDER.filter((s) => counts[s]).map((s) => ({
      label: s,
      value: counts[s],
    }));
  }, [feedback.data]);

  const filtered = useMemo(
    () =>
      filter === "all"
        ? feedback.data
        : feedback.data.filter((f) => f.status === filter),
    [feedback.data, filter]
  );

  const underReview = feedback.data.filter(
    (f) => f.status === "under review"
  ).length;
  const shipped = feedback.data.filter((f) => f.status === "shipped").length;

  if (feedback.state === "loading") return <Loading label="Loading feedback…" />;
  if (feedback.state === "error") return <ErrorState message={feedback.error} />;

  return (
    <div>
      <div className={tabs.kpiGrid}>
        <StatTile accent label="Total Feedback" value={feedback.data.length} />
        <StatTile label="Under Review" value={underReview} />
        <StatTile label="Shipped" value={shipped} />
      </div>

      <div className={tabs.chartGrid}>
        <div className={tabs.chartCard}>
          <h3 className={tabs.chartTitle}>By Status</h3>
          <p className={tabs.chartSub}>{feedback.data.length} submissions</p>
          {byStatus.length ? (
            <div className={tabs.donutWrap}>
              <Donut data={byStatus} height={180} />
              <ChartLegend data={byStatus} />
            </div>
          ) : (
            <p className={tabs.chartSub}>No feedback yet.</p>
          )}
        </div>
      </div>

      {/* Filter chips */}
      <div className={tabs.toolbar}>
        <div className={tabs.filterChips}>
          {(["all", ...STATUS_ORDER] as const).map((f) => {
            const count =
              f === "all"
                ? feedback.data.length
                : feedback.data.filter((x) => x.status === f).length;
            return (
              <button
                key={f}
                className={`${tabs.chip} ${filter === f ? tabs.chipActive : ""}`}
                onClick={() => setFilter(f)}
              >
                {f === "all" ? "All" : f}
                {count > 0 && ` · ${count}`}
              </button>
            );
          })}
        </div>
      </div>

      {/* List */}
      <div className={tabs.table}>
        {filtered.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--dim)" }}>
            No feedback in this view.
          </div>
        ) : (
          filtered.map((f) => (
            <div key={f.id} className={tabs.fbItem}>
              <div className={tabs.fbTop}>
                <span className={tabs.fbTitle}>{f.title}</span>
                <Badge tone={STATUS_TONE[f.status]}>{f.status}</Badge>
                {typeof f.votes === "number" && (
                  <span className={tabs.fbVotes}>▲ {f.votes}</span>
                )}
              </div>
              {f.description && <p className={tabs.fbDesc}>{f.description}</p>}
              <div className={tabs.fbMeta}>
                {f.category || "Feature"} · {f.submittedBy || "Anonymous"} ·{" "}
                {formatDate(f.createdAt, { month: "short", day: "numeric" })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
