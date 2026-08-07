/**
 * v2 admin dashboard — PREVIEW.
 *
 * Built in parallel with the live page.tsx so it can be reviewed
 * behind the same obscured admin URL (/gr-panel-7x9k/v2) without
 * disturbing the production panel. When approved, this becomes the
 * main page.
 *
 * The shell owns: auth gate, header, tab nav, and routing to the
 * per-tab components. Each tab loads its own data via the hooks in
 * ../_lib so no single god-component re-renders everything.
 */

"use client";

import { useState } from "react";
import { useAdminAuth } from "../_lib/useAdminData";
import { DATA_SOURCES } from "../_lib/sources";
import { OverviewTab } from "../_components/OverviewTab";
import { UsersTab } from "../_components/UsersTab";
import { TrafficTab } from "../_components/TrafficTab";
import { PipelineTab } from "../_components/PipelineTab";
import { AffiliatesTab } from "../_components/AffiliatesTab";
import { FeedbackTab } from "../_components/FeedbackTab";
import { SubscriptionsTab } from "../_components/SubscriptionsTab";
import { ReviewsTab } from "../_components/ReviewsTab";
import { AdsTab } from "../_components/AdsTab";
import { SocialTab } from "../_components/SocialTab";
import { ConnectTab } from "../_components/ConnectTab";
import styles from "./page.module.css";

type TabKey =
  | "overview"
  | "users"
  | "traffic"
  | "pipeline"
  | "affiliates"
  | "feedback"
  | "subscriptions"
  | "ads"
  | "reviews"
  | "social"
  | "crashes";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "users", label: "Users" },
  { key: "traffic", label: "Traffic" },
  { key: "pipeline", label: "Pipeline" },
  { key: "affiliates", label: "Affiliates" },
  { key: "feedback", label: "Feedback" },
  { key: "subscriptions", label: "Subscriptions" },
  { key: "ads", label: "Ad Stats" },
  { key: "reviews", label: "Reviews" },
  { key: "social", label: "Social" },
  { key: "crashes", label: "Crashes" },
];

export default function DashboardV2() {
  const auth = useAdminAuth();
  const [tab, setTab] = useState<TabKey>("overview");

  // ── Login form local state ──
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Auth still resolving — avoid a login-screen flash.
  if (!auth.ready) {
    return (
      <div className={styles.bootScreen}>
        <span className={styles.bootSpinner} aria-hidden="true" />
      </div>
    );
  }

  // Not signed in (or not an admin) — show the sign-in card.
  if (!auth.isAdmin) {
    return (
      <div className={styles.loginScreen}>
        <div className={styles.loginCard}>
          <div className={styles.loginBadge}>GymRoam Admin</div>
          <h1 className={styles.loginTitle}>Sign in</h1>
          <p className={styles.loginSub}>Admin access only.</p>
          <input
            className={styles.loginInput}
            type="email"
            placeholder="Email"
            value={email}
            autoComplete="username"
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" && auth.signInWithPassword(email, password)
            }
          />
          <input
            className={styles.loginInput}
            type="password"
            placeholder="Password"
            value={password}
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" && auth.signInWithPassword(email, password)
            }
          />
          {auth.signInError && (
            <div className={styles.loginError}>{auth.signInError}</div>
          )}
          <button
            className={styles.loginBtn}
            onClick={() => auth.signInWithPassword(email, password)}
            disabled={auth.signingIn}
          >
            {auth.signingIn ? "Signing in…" : "Sign In"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.logo}>GymRoam</span>
          <span className={styles.previewTag}>Dashboard v2 · Preview</span>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.adminName}>{auth.name}</span>
          <button className={styles.signOut} onClick={auth.doSignOut}>
            Sign Out
          </button>
        </div>
      </header>

      {/* Tab nav */}
      <nav className={styles.nav}>
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`${styles.navTab} ${tab === t.key ? styles.navTabActive : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* Active tab */}
      <main className={styles.main}>
        {tab === "overview" && <OverviewTab />}
        {tab === "users" && <UsersTab auth={auth} />}
        {tab === "traffic" && <TrafficTab auth={auth} />}
        {tab === "pipeline" && <PipelineTab />}
        {tab === "affiliates" && <AffiliatesTab auth={auth} />}
        {tab === "feedback" && <FeedbackTab />}
        {tab === "subscriptions" && <SubscriptionsTab auth={auth} />}
        {tab === "ads" && <AdsTab auth={auth} />}
        {tab === "reviews" && <ReviewsTab auth={auth} />}
        {tab === "social" && <SocialTab auth={auth} />}
        {tab === "crashes" && <ConnectTab source={DATA_SOURCES.crashes} />}
      </main>
    </div>
  );
}
