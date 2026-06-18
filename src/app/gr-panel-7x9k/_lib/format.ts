/**
 * Formatting + time-bucketing helpers for the v2 dashboard.
 *
 * Centralized so every tab renders dates, numbers, and currency the
 * same way, and so the chart components share one "group timestamps
 * into a daily series" routine instead of each reinventing it.
 */

import type { FirestoreTimestamp, SeriesPoint } from "./types";

/** Firestore Timestamp → epoch milliseconds (or null if absent). */
export function tsToMillis(
  ts: FirestoreTimestamp | number | undefined | null
): number | null {
  if (ts == null) return null;
  if (typeof ts === "number") {
    // iOS writes epoch SECONDS; JS Date wants ms. Heuristic: anything
    // below ~10^12 is seconds (year ~2001 in ms would be 10^12).
    return ts < 1e12 ? ts * 1000 : ts;
  }
  if (typeof ts.seconds === "number") return ts.seconds * 1000;
  return null;
}

export function formatDate(
  ts: FirestoreTimestamp | number | undefined | null,
  options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  }
): string {
  const ms = tsToMillis(ts);
  if (ms == null) return "—";
  return new Date(ms).toLocaleDateString("en-US", options);
}

export function formatDateTime(
  ts: FirestoreTimestamp | number | undefined | null
): string {
  const ms = tsToMillis(ts);
  if (ms == null) return "—";
  return new Date(ms).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "3d ago", "2h ago", "just now". */
export function formatRelative(
  ts: FirestoreTimestamp | number | undefined | null
): string {
  const ms = tsToMillis(ts);
  if (ms == null) return "—";
  const diff = Date.now() - ms;
  const sec = Math.round(diff / 1000);
  const min = Math.round(sec / 60);
  const hr = Math.round(min / 60);
  const day = Math.round(hr / 24);
  if (sec < 60) return "just now";
  if (min < 60) return `${min}m ago`;
  if (hr < 24) return `${hr}h ago`;
  if (day < 30) return `${day}d ago`;
  return formatDate(ts, { month: "short", day: "numeric" });
}

/** 1234 → "1.2k", 1200000 → "1.2M". */
export function formatCompact(n: number): string {
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return String(n);
}

export function formatCurrency(n: number, compact = false): string {
  if (compact && Math.abs(n) >= 1000) return `$${formatCompact(n)}`;
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: n % 1 === 0 ? 0 : 2,
  });
}

export function formatPercent(n: number, digits = 1): string {
  return `${n.toFixed(digits)}%`;
}

/** True if the timestamp falls within the last `days` days. */
export function withinDays(
  ts: FirestoreTimestamp | number | undefined | null,
  days: number
): boolean {
  const ms = tsToMillis(ts);
  if (ms == null) return false;
  return Date.now() - ms <= days * 24 * 60 * 60 * 1000;
}

/**
 * Bucket a list of items into a daily count series over the last
 * `days` days (inclusive of today), oldest → newest. Items with no
 * resolvable timestamp are skipped. Returns one SeriesPoint per day
 * even when the count is zero, so charts render a continuous x-axis.
 */
export function buildDailySeries<T>(
  items: T[],
  getTimestamp: (item: T) => FirestoreTimestamp | number | undefined | null,
  days = 30
): SeriesPoint[] {
  const dayMs = 24 * 60 * 60 * 1000;
  const now = new Date();
  // Normalize "today" to local midnight so bucketing is stable.
  const todayMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();

  const buckets: SeriesPoint[] = [];
  const indexByDay = new Map<number, number>();
  for (let i = days - 1; i >= 0; i--) {
    const dayStart = todayMidnight - i * dayMs;
    const d = new Date(dayStart);
    buckets.push({
      label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: 0,
      date: d.toISOString().slice(0, 10),
    });
    indexByDay.set(dayStart, buckets.length - 1);
  }

  for (const item of items) {
    const ms = tsToMillis(getTimestamp(item));
    if (ms == null) continue;
    const d = new Date(ms);
    const dayStart = new Date(
      d.getFullYear(),
      d.getMonth(),
      d.getDate()
    ).getTime();
    const idx = indexByDay.get(dayStart);
    if (idx !== undefined) buckets[idx].value += 1;
  }

  return buckets;
}

/** Sum a numeric field across items. */
export function sumBy<T>(items: T[], get: (t: T) => number): number {
  return items.reduce((acc, t) => acc + (get(t) || 0), 0);
}

/**
 * Percent change between two numbers, guarding divide-by-zero.
 * Returns null when there's no prior baseline to compare against.
 */
export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}
