"use client";

/**
 * /creator — the affiliate's own dashboard.
 *
 * Sign-in is Firebase Auth email/password; the account is provisioned
 * when an admin approves the application, and the welcome email carries
 * a set-your-password link.
 *
 * All data comes from /api/affiliate/me, which scopes every read to the
 * verified ID token. This page never queries Firestore directly — a
 * creator can only ever see their own numbers, and that holds no matter
 * what the Firestore rules say.
 */

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import Footer from "@/components/Footer";
import { COMMISSION_TIERS, CLEARING_DAYS, MIN_PAYOUT_USD } from "@/lib/affiliate";
import styles from "./page.module.css";

/* Mirrors the /api/affiliate/me response. */
interface Dashboard {
  profile: {
    fullName: string;
    email: string;
    paymentMethod: string;
    approvedAt: number | null;
  };
  code: string;
  trackingLink: string;
  funnel: {
    clicks: number;
    installs: number;
    signups: number;
    proConversions: number;
    conversionRate: number;
  };
  tier: {
    rollingSignups: number;
    currentRate: number;
    currentLabel: string;
    toNextTier: number | null;
    nextLabel: string | null;
  };
  commission: {
    accruedUsd: number;
    clearedUsd: number;
    paidUsd: number;
    clawbackUsd: number;
    payableUsd: number;
    belowMinimum: boolean;
    nextPayoutDate: string;
  };
  readiness: {
    clicks: "live" | "pending";
    referrals: "live" | "pending";
    transactions: "live" | "pending";
  };
  payments: {
    amountUsd: number;
    paidAt: number | null;
    method: string;
    reference: string;
  }[];
}

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export default function CreatorPage() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState("");
  const [resetSent, setResetSent] = useState(false);

  const [data, setData] = useState<Dashboard | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setReady(true);
    });
    return () => unsub();
  }, []);

  const load = useCallback(async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    setLoadError("");
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("/api/affiliate/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) {
        setLoadError(
          res.status === 403
            ? "This account isn't an approved creator yet."
            : json?.error || "Couldn't load your dashboard."
        );
        setData(null);
        return;
      }
      setData(json);
    } catch (e) {
      setLoadError((e as Error).message || "Couldn't load your dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  async function handleSignIn() {
    setSigningIn(true);
    setAuthError("");
    try {
      await signInWithEmailAndPassword(
        auth,
        email.trim().toLowerCase(),
        password
      );
    } catch {
      setAuthError("Invalid email or password.");
    } finally {
      setSigningIn(false);
    }
  }

  async function handleReset() {
    const target = email.trim().toLowerCase();
    if (!target) {
      setAuthError("Enter your email first, then tap this again.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, target);
    } catch {
      // Deliberately silent on failure: telling the visitor whether an
      // address exists would leak which creators we've approved.
    }
    setResetSent(true);
    setAuthError("");
  }

  function copy(kind: "code" | "link", value: string) {
    navigator.clipboard.writeText(value);
    setCopied(kind);
    setTimeout(() => setCopied(null), 1600);
  }

  /* ── Boot ── */
  if (!ready) {
    return (
      <div className={styles.boot}>
        <span className={styles.spinner} aria-hidden="true" />
      </div>
    );
  }

  /* ── Signed out ── */
  if (!user) {
    return (
      <div className={styles.loginScreen}>
        <div className={styles.loginCard}>
          <div className={styles.logoMark}>G</div>
          <h1 className={styles.loginTitle}>Creator Dashboard</h1>
          <p className={styles.loginSub}>
            Sign in to see your code, your funnel, and what you&apos;ve earned.
          </p>

          <input
            className={styles.loginInput}
            type="email"
            placeholder="Email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSignIn()}
          />
          <input
            className={styles.loginInput}
            type="password"
            placeholder="Password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSignIn()}
          />

          {authError && <div className={styles.loginError}>{authError}</div>}
          {resetSent && (
            <div className={styles.loginOk}>
              If that email belongs to an approved creator, a reset link is on
              its way.
            </div>
          )}

          <button
            className={styles.loginBtn}
            onClick={handleSignIn}
            disabled={signingIn}
          >
            {signingIn ? "Signing in…" : "Sign In"}
          </button>

          <button className={styles.linkBtn} onClick={handleReset}>
            Forgot password?
          </button>

          <p className={styles.loginFoot}>
            Not a creator yet? <Link href="/affiliates">Apply to the program</Link>
          </p>
        </div>
      </div>
    );
  }

  /* ── Signed in ── */
  return (
    <>
      <header className={styles.header}>
        <Link href="/" className={styles.headerLogo}>
          <span className={styles.logoMarkSm}>G</span>
          <span>GymRoam</span>
        </Link>
        <div className={styles.headerRight}>
          <span className={styles.headerName}>
            {data?.profile.fullName || user.email}
          </span>
          <button className={styles.signOut} onClick={() => signOut(auth)}>
            Sign Out
          </button>
        </div>
      </header>

      <main className={styles.main}>
        {loading && !data && <div className={styles.loading}>Loading…</div>}

        {loadError && (
          <div className={styles.errorCard}>
            {loadError}
            {loadError.includes("approved") && (
              <>
                {" "}
                <Link href="/affiliates">Apply here</Link> if you haven&apos;t yet.
              </>
            )}
          </div>
        )}

        {data && (
          <>
            {/* ── Code + link ── */}
            <section className={styles.codeSection}>
              <div className={styles.codeBlock}>
                <span className={styles.codeLabel}>Your code</span>
                <div className={styles.codeValueRow}>
                  <span className={styles.codeValue}>{data.code}</span>
                  <button
                    className={styles.copyBtn}
                    onClick={() => copy("code", data.code)}
                  >
                    {copied === "code" ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
              <div className={styles.codeBlock}>
                <span className={styles.codeLabel}>Your tracking link</span>
                <div className={styles.codeValueRow}>
                  <span className={styles.linkValue}>{data.trackingLink}</span>
                  <button
                    className={styles.copyBtn}
                    onClick={() => copy("link", data.trackingLink)}
                  >
                    {copied === "link" ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
            </section>

            {/* ── Funnel ── */}
            <h2 className={styles.sectionTitle}>Your funnel</h2>
            <div className={styles.statGrid}>
              <Stat label="Link clicks" value={data.funnel.clicks} />
              <Stat
                label="Installs"
                value={data.funnel.installs}
                pending={data.readiness.referrals === "pending"}
              />
              <Stat
                label="Signups"
                value={data.funnel.signups}
                pending={data.readiness.referrals === "pending"}
              />
              <Stat
                label="Pro conversions"
                value={data.funnel.proConversions}
                pending={data.readiness.referrals === "pending"}
                accent
              />
            </div>
            {data.readiness.referrals === "pending" ? (
              <p className={styles.note}>
                Install and conversion tracking switches on with the next
                GymRoam app release. Your clicks are counting now.
              </p>
            ) : (
              <p className={styles.note}>
                {data.funnel.conversionRate.toFixed(1)}% of your clicks become
                Pro subscribers.
              </p>
            )}

            {/* ── Tier ── */}
            <h2 className={styles.sectionTitle}>Your tier</h2>
            <div className={styles.tierCard}>
              <div className={styles.tierTop}>
                <span className={styles.tierRate}>{data.tier.currentLabel}</span>
                <span className={styles.tierMeta}>
                  {data.tier.rollingSignups} Pro signup
                  {data.tier.rollingSignups === 1 ? "" : "s"} in the last 12
                  months
                </span>
              </div>
              <div className={styles.tierTrack}>
                {COMMISSION_TIERS.map((t) => {
                  const reached = data.tier.rollingSignups >= t.minSignups;
                  return (
                    <div
                      key={t.label}
                      className={`${styles.tierStep} ${reached ? styles.tierStepOn : ""}`}
                    >
                      <span className={styles.tierStepRate}>{t.label}</span>
                      <span className={styles.tierStepReq}>
                        {t.maxSignups === null
                          ? `${t.minSignups}+`
                          : `${t.minSignups}–${t.maxSignups}`}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className={styles.tierFoot}>
                {data.tier.toNextTier === null
                  ? "You're at the top tier."
                  : `${data.tier.toNextTier} more Pro signup${data.tier.toNextTier === 1 ? "" : "s"} to reach ${data.tier.nextLabel}. New rates apply going forward — earlier commission isn't re-rated.`}
              </p>
            </div>

            {/* ── Commission ── */}
            <h2 className={styles.sectionTitle}>Your commission</h2>
            <div className={styles.statGrid}>
              <Stat
                label="Accruing"
                value={money(data.commission.accruedUsd)}
                pending={data.readiness.transactions === "pending"}
                sub={`clears after ${CLEARING_DAYS} days`}
              />
              <Stat
                label="Cleared"
                value={money(data.commission.clearedUsd)}
                pending={data.readiness.transactions === "pending"}
              />
              <Stat
                label="Paid out"
                value={money(data.commission.paidUsd)}
                pending={data.readiness.transactions === "pending"}
              />
              <Stat
                label="Next payout"
                value={money(data.commission.payableUsd)}
                pending={data.readiness.transactions === "pending"}
                accent
                sub={
                  data.commission.belowMinimum
                    ? `under ${money(MIN_PAYOUT_USD)} — rolls forward`
                    : data.commission.nextPayoutDate
                }
              />
            </div>
            {data.readiness.transactions === "pending" && (
              <p className={styles.note}>
                Commission reporting turns on once subscription tracking ships.
                Anything you earn before then is backdated — nothing is lost.
              </p>
            )}

            {/* ── Payments ── */}
            {data.payments.length > 0 && (
              <>
                <h2 className={styles.sectionTitle}>Payment history</h2>
                <div className={styles.payTable}>
                  {data.payments.map((p, i) => (
                    <div key={i} className={styles.payRow}>
                      <span className={styles.payAmount}>
                        {money(p.amountUsd)}
                      </span>
                      <span className={styles.payMeta}>{p.method || "—"}</span>
                      <span className={styles.payMeta}>
                        {p.paidAt
                          ? new Date(p.paidAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "—"}
                      </span>
                      <span className={styles.payRef}>{p.reference || ""}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ── Resources ── */}
            <h2 className={styles.sectionTitle}>Content resources</h2>
            <div className={styles.resources}>
              <div className={styles.resourceCard}>
                <h3>Brand assets</h3>
                <p>Logo, app icon, and screenshots you can drop into a post.</p>
                <a href="/GymRoam-G-Icon.png" download className={styles.resourceLink}>
                  Download logo &rarr;
                </a>
              </div>
              <div className={styles.resourceCard}>
                <h3>Hooks that work</h3>
                <ul>
                  <li>&ldquo;POV: you&apos;re in a new city and need a gym in 30 seconds&rdquo;</li>
                  <li>&ldquo;Hotel gym or real gym? Here&apos;s how I decide&rdquo;</li>
                  <li>&ldquo;I never skip a workout when I travel — here&apos;s the app&rdquo;</li>
                </ul>
              </div>
              <div className={styles.resourceCard}>
                <h3>Ground rules</h3>
                <ul>
                  <li>Disclose the partnership — #ad or #partner</li>
                  <li>No coupon or deal-aggregator sites</li>
                  <li>Don&apos;t bid on &ldquo;GymRoam&rdquo; in paid search</li>
                </ul>
              </div>
            </div>
          </>
        )}
      </main>

      <Footer />
    </>
  );
}

/* ── Stat tile ──
   `pending` renders an em dash instead of a zero. A creator seeing "0
   conversions" when tracking simply isn't live yet would reasonably
   conclude the program is broken. */
function Stat({
  label,
  value,
  sub,
  accent = false,
  pending = false,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  accent?: boolean;
  pending?: boolean;
}) {
  return (
    <div className={`${styles.stat} ${accent ? styles.statAccent : ""}`}>
      <span className={styles.statLabel}>{label}</span>
      <span className={`${styles.statValue} ${pending ? styles.statPending : ""}`}>
        {pending ? "—" : value}
      </span>
      <span className={styles.statSub}>
        {pending ? "not tracking yet" : sub || ""}
      </span>
    </div>
  );
}
