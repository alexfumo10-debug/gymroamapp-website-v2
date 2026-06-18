/**
 * Shared UI primitives for the v2 dashboard.
 *
 * Small, composable building blocks themed to the GymRoam dark +
 * brand-yellow system. Every tab is built out of these so the look
 * stays consistent and a restyle is a one-file change.
 */

"use client";

import type { ReactNode } from "react";
import type { DataSource } from "../_lib/sources";
import styles from "./ui.module.css";

/* ── Card: generic elevated surface ── */
export function Card({
  children,
  className = "",
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={`${styles.card} ${padded ? styles.cardPadded : ""} ${className}`}
    >
      {children}
    </div>
  );
}

/* ── SectionHeading: h2 + optional right-aligned meta/action ── */
export function SectionHeading({
  title,
  meta,
  action,
}: {
  title: string;
  meta?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={styles.sectionHeading}>
      <h2>{title}</h2>
      {meta && <span className={styles.sectionMeta}>{meta}</span>}
      {action && <div className={styles.sectionAction}>{action}</div>}
    </div>
  );
}

/* ── Badge: small count/status pill ── */
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "green" | "red" | "blue" | "orange";
}) {
  return <span className={`${styles.badge} ${styles[`badge_${tone}`]}`}>{children}</span>;
}

/* ── StatTile: the KPI hero element ──
   Big number, label, and an optional delta vs. a prior period. The
   delta auto-colors: positive = green, negative = red, unless
   `invertDelta` (e.g. cancellations, crashes — up is bad). */
export function StatTile({
  label,
  value,
  delta,
  deltaSuffix = "",
  sub,
  invertDelta = false,
  accent = false,
}: {
  label: string;
  value: ReactNode;
  delta?: number | null;
  deltaSuffix?: string;
  sub?: ReactNode;
  invertDelta?: boolean;
  accent?: boolean;
}) {
  const hasDelta = delta !== undefined && delta !== null;
  const good = hasDelta ? (invertDelta ? delta! < 0 : delta! > 0) : false;
  const bad = hasDelta ? (invertDelta ? delta! > 0 : delta! < 0) : false;
  return (
    <div className={`${styles.statTile} ${accent ? styles.statTileAccent : ""}`}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue}>{value}</div>
      <div className={styles.statFooter}>
        {hasDelta && (
          <span
            className={`${styles.statDelta} ${
              good ? styles.deltaGood : bad ? styles.deltaBad : styles.deltaFlat
            }`}
          >
            {delta! > 0 ? "▲" : delta! < 0 ? "▼" : "—"}{" "}
            {Math.abs(delta!).toFixed(delta! % 1 === 0 ? 0 : 1)}
            {deltaSuffix}
          </span>
        )}
        {sub && <span className={styles.statSub}>{sub}</span>}
      </div>
    </div>
  );
}

/* ── EmptyState: the honest "connect-ready" panel ──
   Shown on tabs whose source isn't wired yet. Tells the admin exactly
   what's needed to turn it on — no fake data masquerading as real. */
export function ConnectReadyState({ source }: { source: DataSource }) {
  return (
    <div className={styles.connectState}>
      <div className={styles.connectIcon} aria-hidden="true">
        ⚡
      </div>
      <div className={styles.connectTitle}>
        {source.label} — not connected yet
      </div>
      <p className={styles.connectSummary}>{source.summary}</p>

      {source.provider && (
        <div className={styles.connectMetaRow}>
          <span className={styles.connectMetaLabel}>Provider</span>
          <span>{source.provider}</span>
        </div>
      )}
      {source.envVars && source.envVars.length > 0 && (
        <div className={styles.connectMetaRow}>
          <span className={styles.connectMetaLabel}>Needs</span>
          <span className={styles.connectEnv}>
            {source.envVars.map((v) => (
              <code key={v}>{v}</code>
            ))}
          </span>
        </div>
      )}
      {source.setupHint && (
        <p className={styles.connectHint}>{source.setupHint}</p>
      )}
      <p className={styles.connectFootnote}>
        The UI below is fully built. It switches to live data the moment
        this integration is wired — see <code>docs/admin-integrations.md</code>.
      </p>
    </div>
  );
}

/* ── Loading + error inline states ── */
export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className={styles.loading}>
      <span className={styles.spinner} aria-hidden="true" />
      {label}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return <div className={styles.errorState}>Couldn&apos;t load: {message}</div>;
}

export function EmptyHint({ children }: { children: ReactNode }) {
  return <div className={styles.emptyHint}>{children}</div>;
}
