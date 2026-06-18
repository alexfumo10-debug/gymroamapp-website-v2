/**
 * Brand-themed Recharts wrappers.
 *
 * Thin wrappers so tabs never touch raw Recharts config — they pass
 * data + a color and get a chart that matches the GymRoam dark +
 * brand-yellow system (custom tooltip, muted gridlines, no chart
 * junk). Keeps every visualization visually consistent.
 */

"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import type { SeriesPoint } from "../_lib/types";
import styles from "./charts.module.css";

export const CHART_COLORS = {
  accent: "#E8FF3C",
  blue: "#4A9EFF",
  green: "#4ECDC4",
  red: "#FF4D6D",
  orange: "#FF8C42",
  muted: "#8A8A99",
};

/** Donut/segment palette, ordered for good adjacent contrast. */
export const SEGMENT_PALETTE = [
  CHART_COLORS.accent,
  CHART_COLORS.blue,
  CHART_COLORS.green,
  CHART_COLORS.orange,
  CHART_COLORS.red,
  CHART_COLORS.muted,
];

const AXIS_PROPS = {
  stroke: "#55555F",
  tick: { fill: "#8A8A99", fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;

/* Custom tooltip — matches the card surface, not Recharts' default.
   Props are injected by Recharts at runtime; typed locally with a
   permissive shape because Recharts 3's exported TooltipProps churns
   between minor versions. */
interface TipProps {
  active?: boolean;
  label?: string | number;
  payload?: Array<{ name?: string; value?: number | string; color?: string }>;
}

function ThemedTooltip({ active, payload, label }: TipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className={styles.tooltip}>
      {label != null && <div className={styles.tooltipLabel}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className={styles.tooltipRow}>
          <span
            className={styles.tooltipDot}
            style={{ background: (p.color as string) || CHART_COLORS.accent }}
          />
          <span className={styles.tooltipName}>{p.name}</span>
          <span className={styles.tooltipValue}>
            {typeof p.value === "number" ? p.value.toLocaleString() : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Area trend chart for time series. */
export function TrendArea({
  data,
  color = CHART_COLORS.accent,
  height = 220,
  name = "Count",
}: {
  data: SeriesPoint[];
  color?: string;
  height?: number;
  name?: string;
}) {
  const gradId = `grad_${name.replace(/\W/g, "")}_${color.slice(1)}`;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#1F1F26" vertical={false} />
        <XAxis dataKey="label" {...AXIS_PROPS} minTickGap={24} />
        <YAxis {...AXIS_PROPS} allowDecimals={false} width={40} />
        <Tooltip content={<ThemedTooltip />} cursor={{ stroke: "#2A2A33" }} />
        <Area
          type="monotone"
          dataKey="value"
          name={name}
          stroke={color}
          strokeWidth={2}
          fill={`url(#${gradId})`}
          dot={false}
          activeDot={{ r: 4, fill: color }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Vertical bar chart. */
export function MiniBar({
  data,
  color = CHART_COLORS.blue,
  height = 220,
  name = "Count",
}: {
  data: SeriesPoint[];
  color?: string;
  height?: number;
  name?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid stroke="#1F1F26" vertical={false} />
        <XAxis dataKey="label" {...AXIS_PROPS} minTickGap={16} />
        <YAxis {...AXIS_PROPS} allowDecimals={false} width={40} />
        <Tooltip content={<ThemedTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
        <Bar dataKey="value" name={name} fill={color} radius={[4, 4, 0, 0]} maxBarSize={48} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Donut chart for categorical breakdowns. */
export function Donut({
  data,
  height = 220,
}: {
  data: SeriesPoint[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="label"
          innerRadius="58%"
          outerRadius="82%"
          paddingAngle={2}
          stroke="none"
        >
          {data.map((_, i) => (
            <Cell key={i} fill={SEGMENT_PALETTE[i % SEGMENT_PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip content={<ThemedTooltip />} />
      </PieChart>
    </ResponsiveContainer>
  );
}

/** Legend chips for a donut/segmented chart (Recharts legend is ugly). */
export function ChartLegend({ data }: { data: SeriesPoint[] }) {
  const total = data.reduce((a, d) => a + d.value, 0) || 1;
  return (
    <div className={styles.legend}>
      {data.map((d, i) => (
        <div key={d.label} className={styles.legendItem}>
          <span
            className={styles.legendDot}
            style={{ background: SEGMENT_PALETTE[i % SEGMENT_PALETTE.length] }}
          />
          <span className={styles.legendLabel}>{d.label}</span>
          <span className={styles.legendValue}>
            {d.value.toLocaleString()} ({Math.round((d.value / total) * 100)}%)
          </span>
        </div>
      ))}
    </div>
  );
}
