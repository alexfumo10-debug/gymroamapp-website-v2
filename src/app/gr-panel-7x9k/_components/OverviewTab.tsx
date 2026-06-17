/**
 * Overview tab — the at-a-glance dashboard.
 *
 * Pulls every LIVE source (users, traffic, feedback, pipeline) and
 * renders top-line KPIs + trend charts. Connect-ready sources (subs,
 * ads, reviews, social, crashes) are summarized as "awaiting
 * connection" chips so the overview reflects the full vision without
 * faking numbers.
 */

"use client";

import { useMemo } from "react";
import { useCollection } from "../_lib/useAdminData";
import {
  buildDailySeries,
  withinDays,
  pctChange,
  formatCompact,
} from "../_lib/format";
import { DATA_SOURCES } from "../_lib/sources";
import type {
  AppUser,
  PageView,
  FeedbackItem,
  GymApplication,
  TrainerApplication,
  CareerApplication,
  SeriesPoint,
  FirestoreTimestamp,
} from "../_lib/types";
import { StatTile, Card, Loading } from "./ui";
import { TrendArea, MiniBar, Donut, ChartLegend, CHART_COLORS } from "./charts";
import tabs from "./tabs.module.css";

/** Count items whose timestamp falls in the [from,to) day window. */
function countInWindow<T>(
  items: T[],
  get: (t: T) => FirestoreTimestamp | number | undefined,
  fromDaysAgo: number,
  toDaysAgo: number
): number {
  return items.filter((it) => {
    const within = withinDays(get(it), fromDaysAgo);
    const beyond = toDaysAgo > 0 ? withinDays(get(it), toDaysAgo) : false;
    return within && !beyond;
  }).length;
}

export function OverviewTab() {
  const users = useCollection<AppUser>("users");
  const views = useCollection<PageView>("pageViews", { orderField: "createdAt" });
  const feedback = useCollection<FeedbackItem>("feedback", {
    orderField: "createdAt",
  });
  const gym = useCollection<GymApplication>("gymPartnerApplications");
  const trainer = useCollection<TrainerApplication>("trainerApplications");
  const career = useCollection<CareerApplication>("careersApplications");

  const loading =
    users.state === "loading" ||
    views.state === "loading" ||
    feedback.state === "loading";

  const stats = useMemo(() => {
    const u = users.data;
    const v = views.data;
    const f = feedback.data;

    const getUserTs = (x: AppUser) => x.createdAt ?? x.updatedAt;

    // This-week vs last-week deltas.
    const usersThisWk = countInWindow(u, getUserTs, 7, 0);
    const usersLastWk = countInWindow(u, getUserTs, 14, 7);
    const viewsThisWk = countInWindow(v, (x) => x.createdAt, 7, 0);
    const viewsLastWk = countInWindow(v, (x) => x.createdAt, 14, 7);

    const activeGymPartners = gym.data.filter(
      (g) => g.subscriptionActive
    ).length;
    const pendingPipeline =
      gym.data.filter((g) => g.status === "pending").length +
      trainer.data.filter((t) => t.status === "pending").length +
      career.data.filter((c) => c.status === "pending").length;
    const openFeedback = f.filter((x) => x.status === "under review").length;

    return {
      totalUsers: u.length,
      usersDelta: pctChange(usersThisWk, usersLastWk),
      usersThisWk,
      views7d: viewsThisWk,
      viewsDelta: pctChange(viewsThisWk, viewsLastWk),
      activeGymPartners,
      pendingPipeline,
      openFeedback,
      totalFeedback: f.length,
    };
  }, [users.data, views.data, feedback.data, gym.data, trainer.data, career.data]);

  // ── Chart series ──
  const userSeries = useMemo(
    () =>
      buildDailySeries(users.data, (u) => u.createdAt ?? u.updatedAt, 30),
    [users.data]
  );
  const trafficSeries = useMemo(
    () => buildDailySeries(views.data, (v) => v.createdAt, 30),
    [views.data]
  );
  const feedbackByStatus = useMemo<SeriesPoint[]>(() => {
    const order = ["under review", "planned", "in progress", "shipped"];
    const counts: Record<string, number> = {};
    feedback.data.forEach((f) => {
      counts[f.status] = (counts[f.status] || 0) + 1;
    });
    return order
      .filter((s) => counts[s])
      .map((s) => ({ label: s, value: counts[s] }));
  }, [feedback.data]);
  const pipelineByType = useMemo<SeriesPoint[]>(
    () => [
      { label: "Gym", value: gym.data.filter((g) => g.status === "pending").length },
      { label: "Trainer", value: trainer.data.filter((t) => t.status === "pending").length },
      { label: "Career", value: career.data.filter((c) => c.status === "pending").length },
    ],
    [gym.data, trainer.data, career.data]
  );

  if (loading) return <Loading label="Loading dashboard…" />;

  const pendingConnect = Object.values(DATA_SOURCES).filter(
    (s) => s.status === "connect-ready"
  );

  return (
    <div>
      {/* KPI tiles */}
      <div className={tabs.kpiGrid}>
        <StatTile
          accent
          label="App Users"
          value={formatCompact(stats.totalUsers)}
          delta={stats.usersDelta}
          deltaSuffix="%"
          sub={`+${stats.usersThisWk} this week`}
        />
        <StatTile
          label="Web Views (7d)"
          value={formatCompact(stats.views7d)}
          delta={stats.viewsDelta}
          deltaSuffix="%"
          sub="vs prior week"
        />
        <StatTile
          label="Active Gym Partners"
          value={stats.activeGymPartners}
          sub="Stripe subscriptions"
        />
        <StatTile
          label="Pending Pipeline"
          value={stats.pendingPipeline}
          sub="gym · trainer · career"
        />
        <StatTile
          label="Open Feedback"
          value={stats.openFeedback}
          sub={`${stats.totalFeedback} total`}
        />
      </div>

      {/* Trend charts */}
      <div className={tabs.chartGrid}>
        <div className={`${tabs.chartCard} ${tabs.chartCardWide}`}>
          <h3 className={tabs.chartTitle}>New App Users</h3>
          <p className={tabs.chartSub}>Daily, last 30 days</p>
          <TrendArea data={userSeries} color={CHART_COLORS.accent} name="Users" />
        </div>

        <div className={`${tabs.chartCard} ${tabs.chartCardWide}`}>
          <h3 className={tabs.chartTitle}>Website Traffic</h3>
          <p className={tabs.chartSub}>Page views per day, last 30 days</p>
          <TrendArea data={trafficSeries} color={CHART_COLORS.blue} name="Views" />
        </div>

        <div className={tabs.chartCard}>
          <h3 className={tabs.chartTitle}>Feedback by Status</h3>
          <p className={tabs.chartSub}>{stats.totalFeedback} submissions</p>
          {feedbackByStatus.length ? (
            <div className={tabs.donutWrap}>
              <Donut data={feedbackByStatus} height={180} />
              <ChartLegend data={feedbackByStatus} />
            </div>
          ) : (
            <p className={tabs.chartSub}>No feedback yet.</p>
          )}
        </div>

        <div className={tabs.chartCard}>
          <h3 className={tabs.chartTitle}>Pending Applications</h3>
          <p className={tabs.chartSub}>By type</p>
          <MiniBar data={pipelineByType} color={CHART_COLORS.green} name="Pending" />
        </div>
      </div>

      {/* Awaiting-connection summary */}
      <Card>
        <h3 className={tabs.chartTitle}>Awaiting connection</h3>
        <p className={tabs.chartSub}>
          {pendingConnect.length} data sources are built and ready to switch
          on once their credentials are provisioned.
        </p>
        <div className={tabs.filterChips}>
          {pendingConnect.map((s) => (
            <span key={s.key} className={tabs.chip}>
              {s.label}
            </span>
          ))}
        </div>
      </Card>
    </div>
  );
}
