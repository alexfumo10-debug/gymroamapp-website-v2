/**
 * Live tab — who's on the app right now, and where.
 *
 * Auto-refreshes every 20s while open. Two data halves from
 * /api/admin/live:
 *   - GA4 realtime: active users in the last 30 min, by minute and by
 *     country/city (AGGREGATE counts — no per-user location is collected
 *     anywhere, by design).
 *   - Firebase Auth refreshes: a named "recently active" feed at ~1-hour
 *     resolution (an app session forces a token refresh at least hourly).
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { type useAdminAuth } from "../_lib/useAdminData";
import { formatRelative } from "../_lib/format";
import { MiniBar, CHART_COLORS } from "./charts";
import { StatTile, Loading, ErrorState, SectionHeading, Card, Badge } from "./ui";
import tabs from "./tabs.module.css";

type Auth = ReturnType<typeof useAdminAuth>;

const POLL_MS = 20_000;

interface LiveResponse {
  authActivity: {
    totalAccounts: number;
    active1h: number;
    active24h: number;
    active7d: number;
    feed: {
      uid: string;
      name: string;
      username: string | null;
      homeCity: string | null;
      email: string | null;
      isRelay: boolean;
      providers: string[];
      lastActiveMs: number | null;
    }[];
  };
  ga:
    | {
        configured: true;
        activeNow: number;
        byLocation: { country: string; city: string; users: number }[];
        perMinute: { minutesAgo: number; users: number }[];
      }
    | { configured: false; hint: string };
  asOf: string;
}

/** Poll /api/admin/live every POLL_MS while mounted. */
function useLiveData(getIdToken: Auth["getIdToken"]) {
  const [data, setData] = useState<LiveResponse | null>(null);
  const [error, setError] = useState("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const token = await getIdToken();
      if (!token) throw new Error("not signed in");
      const res = await fetch("/api/admin/live", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `${res.status}`);
      setData(json);
      setError("");
    } catch (e) {
      // Keep the last good data on a failed poll; only surface the error
      // when we have nothing to show.
      setError((e as Error).message);
    }
  }, [getIdToken]);

  useEffect(() => {
    load();
    timer.current = setInterval(load, POLL_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [load]);

  return { data, error };
}

export function LiveTab({ auth }: { auth: Auth }) {
  const { data, error } = useLiveData(auth.getIdToken);

  if (!data && !error) return <Loading label="Loading live activity…" />;
  if (!data) return <ErrorState message={error} />;

  const { authActivity, ga } = data;
  const updatedAt = new Date(data.asOf).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  // GA per-minute rows → chart series, oldest → newest ("-29m" … "now").
  const minuteSeries =
    ga.configured
      ? ga.perMinute.map((m) => ({
          label: m.minutesAgo === 0 ? "now" : `-${m.minutesAgo}m`,
          value: m.users,
        }))
      : [];

  return (
    <div>
      <SectionHeading
        title="Live Activity"
        meta={
          <span className={tabs.liveMeta}>
            <span className={tabs.liveDot} aria-hidden="true" />
            auto-refreshes every 20s · updated {updatedAt}
          </span>
        }
      />

      {/* KPIs */}
      <div className={tabs.kpiGrid}>
        <StatTile
          accent
          label="Active Now"
          value={ga.configured ? ga.activeNow : "—"}
          sub={ga.configured ? "last 30 min (GA realtime)" : "needs GA grant"}
        />
        <StatTile
          label="Active Last Hour"
          value={authActivity.active1h}
          sub="auth sessions"
        />
        <StatTile label="Last 24 Hours" value={authActivity.active24h} sub="unique users" />
        <StatTile label="Last 7 Days" value={authActivity.active7d} sub="unique users" />
      </div>

      {ga.configured ? (
        <div className={tabs.twoCol}>
          {/* Per-minute activity */}
          <Card>
            <div className={tabs.chartTitle}>Activity — last 30 minutes</div>
            <div className={tabs.chartSub}>active users per minute</div>
            <MiniBar data={minuteSeries} color={CHART_COLORS.accent} height={200} name="Active" />
          </Card>

          {/* Where they are */}
          <Card>
            <div className={tabs.chartTitle}>Where they are</div>
            <div className={tabs.chartSub}>
              active users by location, last 30 min (aggregate — GA collects no
              per-user location)
            </div>
            {ga.byLocation.length === 0 ? (
              <p className={tabs.cellDim} style={{ padding: "16px 0" }}>
                No one on right now.
              </p>
            ) : (
              <div className={tabs.liveGeoList}>
                {ga.byLocation.map((l, i) => (
                  <div className={tabs.liveGeoRow} key={`${l.country}-${l.city}-${i}`}>
                    <span className={tabs.liveGeoPlace}>
                      {l.city && l.city !== "(not set)" ? `${l.city}, ` : ""}
                      {l.country}
                    </span>
                    <span className={tabs.liveGeoCount}>{l.users}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      ) : (
        <Card>
          <div className={tabs.chartTitle}>Turn on realtime geography</div>
          <p className={tabs.chartSub} style={{ margin: "8px 0 12px", lineHeight: 1.6 }}>
            The iOS app already logs to Google Analytics — the &quot;Active Now&quot;
            count and city/country map just need a one-time, one-click grant (no
            keys, no app update):
          </p>
          <ol className={tabs.liveSetupList}>
            <li>
              Open <strong>analytics.google.com</strong> → Admin (gear) → property{" "}
              <strong>gymroam-ad7dc</strong> → <strong>Property access management</strong>
            </li>
            <li>
              Add user:{" "}
              <code>firebase-adminsdk-fbsvc@gymroam-ad7dc.iam.gserviceaccount.com</code>{" "}
              with the <strong>Viewer</strong> role
            </li>
            <li>Come back — this card becomes the live map within a minute.</li>
          </ol>
          <p className={tabs.cellDim} style={{ fontSize: 12 }}>
            Last check: {(ga as { hint: string }).hint}
          </p>
        </Card>
      )}

      {/* Recently active feed */}
      <SectionHeading
        title="Recently Active"
        meta={`${authActivity.totalAccounts} total accounts · resolution ~1h (auth refresh)`}
      />
      <div className={tabs.table}>
        <div
          className={`${tabs.row} ${tabs.rowHeader}`}
          style={{ gridTemplateColumns: "34px 1.6fr 1fr 1fr 110px" }}
        >
          <span />
          <span>User</span>
          <span>Home City</span>
          <span>Sign-in</span>
          <span className={tabs.cellRight}>Last Active</span>
        </div>
        {authActivity.feed.map((u) => (
          <div
            key={u.uid}
            className={tabs.row}
            style={{ gridTemplateColumns: "34px 1.6fr 1fr 1fr 110px" }}
          >
            <div className={tabs.avatar}>{(u.name[0] || "?").toUpperCase()}</div>
            <div className={tabs.cellStack}>
              <span className={tabs.cellPrimary}>{u.name}</span>
              <span className={tabs.cellSecondary}>
                {u.username ? `@${u.username.replace(/^@+/, "")}` : u.email || "—"}
              </span>
            </div>
            <div className={tabs.cellMuted}>{u.homeCity || "—"}</div>
            <div className={tabs.cellMuted}>
              {u.providers.includes("apple.com") ? (
                <Badge tone="neutral"> Apple{u.isRelay ? " · relay" : ""}</Badge>
              ) : (
                <Badge tone="neutral">Email</Badge>
              )}
            </div>
            <div className={`${tabs.cellRight} ${tabs.cellDim}`}>
              {formatRelative(u.lastActiveMs)}
            </div>
          </div>
        ))}
      </div>
      <p className={tabs.cellDim} style={{ fontSize: 12, marginTop: 10 }}>
        &quot;Last active&quot; is the account&apos;s most recent auth-token refresh — an
        open app refreshes at least hourly, so this is reliable to about an hour,
        not to the minute. Home city is the user&apos;s self-reported profile field;
        no per-user login location is collected.
      </p>
    </div>
  );
}
