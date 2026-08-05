/**
 * Users tab — every app user as a dense, searchable table.
 *
 * Cross-references Firestore /users against Firebase Auth (via the
 * existing /api/admin/users-auth route) so the email shown is the
 * canonical Auth email, and UIDs with no Auth account are flagged as
 * orphans (leftover/test docs).
 */

"use client";

import { useMemo, useState } from "react";
import {
  useCollection,
  useAuthUsers,
  type useAdminAuth,
} from "../_lib/useAdminData";
import {
  formatDate,
  formatDateTime,
  formatCompact,
  withinDays,
  tsToMillis,
} from "../_lib/format";
import type { AppUser, AuthUserInfo, FirestoreTimestamp } from "../_lib/types";
import { EMAIL_TEMPLATE_OPTIONS } from "@/lib/email-templates";
import { StatTile, Loading, ErrorState, Badge, Card, SectionHeading } from "./ui";
import tabs from "./tabs.module.css";

// Onboarding attribution values — mirror AcquisitionSource in the iOS app
// (feature/onboarding-attribution). Unknown values fall back to Title Case.
const SOURCE_LABELS: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  creator: "A creator / influencer",
  google: "Google",
  appstore: "App Store search",
  other: "Other / not sure",
};
function sourceLabel(s: string): string {
  return (
    SOURCE_LABELS[s] ||
    s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

type Auth = ReturnType<typeof useAdminAuth>;
// uid is always resolved to a string in `enriched` (doc id), so the
// detail modal can index authMap.map[selected.uid] without a guard.
type EnrichedUser = AppUser & { uid: string; canonicalEmail: string; isOrphan: boolean };

// Some user docs store the username already prefixed with "@"; strip any
// leading @(s) and re-add exactly one so it never renders as "@@handle".
function atHandle(username?: string): string {
  if (!username) return "no handle";
  return `@${username.replace(/^@+/, "")}`;
}

// Render any user-doc value readably: timestamps, booleans, nested
// objects, epoch numbers — so the detail modal can show the FULL doc.
function formatValue(key: string, val: unknown): string {
  if (val === null || val === undefined || val === "") return "—";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (typeof val === "object") {
    if ("seconds" in (val as Record<string, unknown>)) {
      return formatDateTime(val as { seconds: number; nanoseconds: number });
    }
    return JSON.stringify(val);
  }
  if ((key === "createdAt" || key === "updatedAt") && typeof val === "number") {
    return formatDateTime(val);
  }
  return String(val);
}

export function UsersTab({ auth }: { auth: Auth }) {
  const users = useCollection<AppUser>("users");
  const authMap = useAuthUsers(auth.getIdToken, true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "verified" | "orphan">("all");
  const [selected, setSelected] = useState<EnrichedUser | null>(null);

  const enriched = useMemo(() => {
    return users.data.map((u) => {
      // The auth cross-ref map is keyed by Firebase Auth uid = the
      // Firestore doc ID. useCollection exposes that as `id`; the doc
      // itself has no `uid` field (iOS never writes one), so resolve the
      // key from `id` first. Normalizing `uid` here also fixes the detail
      // modal, which looks up authMap.map[selected.uid].
      const uid = u.uid || u.id || "";
      const authInfo = authMap.map[uid];
      const canonicalEmail = authInfo?.email || u.email || "";
      const isOrphan = authMap.state === "ready" && !authInfo;
      return { ...u, uid, canonicalEmail, isOrphan };
    });
  }, [users.data, authMap.map, authMap.state]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const result = enriched.filter((u) => {
      if (filter === "verified" && !u.isVerifiedCreator) return false;
      if (filter === "orphan" && !u.isOrphan) return false;
      if (!q) return true;
      return (
        (u.displayName || "").toLowerCase().includes(q) ||
        (u.username || "").toLowerCase().includes(q) ||
        (u.canonicalEmail || "").toLowerCase().includes(q) ||
        (u.homeCity || "").toLowerCase().includes(q)
      );
    });
    // Always newest-first by signup time (createdAt, else updatedAt).
    // Undated docs sort to the bottom.
    return result.sort(
      (a, b) =>
        (tsToMillis(b.createdAt ?? b.updatedAt) ?? 0) -
        (tsToMillis(a.createdAt ?? a.updatedAt) ?? 0)
    );
  }, [enriched, search, filter]);

  const verifiedCount = enriched.filter((u) => u.isVerifiedCreator).length;
  const newThisWeek = enriched.filter((u) =>
    withinDays(u.createdAt ?? u.updatedAt, 7)
  ).length;
  const orphanCount = enriched.filter((u) => u.isOrphan).length;

  // Acquisition breakdown from the onboarding "Where did you hear about us?"
  // step. Reads users/{uid}.acquisition.{source,creatorCode}. Users who
  // predate the step (or are on a build without it) land in `unknown`.
  const acquisition = useMemo(() => {
    const counts: Record<string, number> = {};
    const creators: Record<string, number> = {};
    let unknown = 0;
    for (const u of enriched) {
      const s = (u.acquisition?.source || "").toString().trim().toLowerCase();
      if (!s) {
        unknown++;
        continue;
      }
      counts[s] = (counts[s] || 0) + 1;
      const code = (u.acquisition?.creatorCode || "").toString().trim().toLowerCase();
      if (code) creators[code] = (creators[code] || 0) + 1;
    }
    const known = Object.values(counts).reduce((a, b) => a + b, 0);
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const topCreators = Object.entries(creators).sort((a, b) => b[1] - a[1]);
    return { sorted, topCreators, unknown, known };
  }, [enriched]);

  if (users.state === "loading") return <Loading label="Loading users…" />;
  if (users.state === "error") return <ErrorState message={users.error} />;

  return (
    <div>
      {/* KPIs */}
      <div className={tabs.kpiGrid}>
        <StatTile accent label="Total Users" value={formatCompact(enriched.length)} />
        <StatTile label="New This Week" value={newThisWeek} sub="signed up" />
        <StatTile label="Verified Creators" value={verifiedCount} />
        <StatTile
          label="Orphan Docs"
          value={orphanCount}
          sub={authMap.state === "ready" ? "no Auth account" : "checking…"}
          invertDelta
        />
      </div>

      {/* Acquisition sources — "How did you hear about us?" (iOS 2.4+) */}
      <SectionHeading
        title="Where users come from"
        meta={acquisition.known > 0 ? `${acquisition.known} answered` : undefined}
      />
      <Card>
        {acquisition.known === 0 ? (
          <p className={tabs.chartSub} style={{ margin: 0, lineHeight: 1.6 }}>
            No attribution data yet. The onboarding{" "}
            <strong>&quot;Where did you hear about us?&quot;</strong> step is built
            (<code>feature/onboarding-attribution</code>) but isn&apos;t in the
            live App Store build — this fills in once a build with it ships and
            users go through onboarding. Then you&apos;ll see the Instagram vs
            TikTok split (and which creators drove signups).
            {acquisition.unknown > 0 &&
              ` (${acquisition.unknown} current users predate the step.)`}
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {acquisition.sorted.map(([src, count]) => {
              const pct = Math.round((count / acquisition.known) * 100);
              return (
                <div
                  key={src}
                  style={{ display: "flex", alignItems: "center", gap: 12 }}
                >
                  <span style={{ width: 150, fontSize: 13, color: "var(--text)" }}>
                    {sourceLabel(src)}
                  </span>
                  <div
                    style={{
                      flex: 1,
                      height: 8,
                      background: "var(--surface2)",
                      borderRadius: 4,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${pct}%`,
                        height: "100%",
                        background: "var(--accent)",
                      }}
                    />
                  </div>
                  <span
                    style={{
                      width: 74,
                      textAlign: "right",
                      fontSize: 12,
                      color: "var(--muted)",
                    }}
                  >
                    {count} · {pct}%
                  </span>
                </div>
              );
            })}
            {acquisition.topCreators.length > 0 && (
              <div style={{ marginTop: 6, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
                <div className={tabs.cellDim} style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
                  Signups by creator code
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {acquisition.topCreators.map(([code, count]) => (
                    <CreatorCodeRow
                      key={code}
                      code={code}
                      count={count}
                      getIdToken={auth.getIdToken}
                      onGranted={() => users.reload()}
                    />
                  ))}
                </div>
              </div>
            )}
            {acquisition.unknown > 0 && (
              <p className={tabs.cellDim} style={{ fontSize: 12, margin: "2px 0 0" }}>
                {acquisition.unknown} users predate the step (no source recorded).
              </p>
            )}
          </div>
        )}
      </Card>


      {/* Toolbar */}
      <div className={tabs.toolbar}>
        <input
          className={tabs.search}
          placeholder="Search name, email, handle, city…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className={tabs.filterChips}>
          {(["all", "verified", "orphan"] as const).map((f) => (
            <button
              key={f}
              className={`${tabs.chip} ${filter === f ? tabs.chipActive : ""}`}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "All" : f === "verified" ? "Verified" : "Orphans"}
              {f === "verified" && verifiedCount > 0 && ` · ${verifiedCount}`}
              {f === "orphan" && orphanCount > 0 && ` · ${orphanCount}`}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className={tabs.table}>
        <div
          className={`${tabs.row} ${tabs.rowHeader}`}
          style={{ gridTemplateColumns: "34px 1.4fr 1.6fr 1fr 110px 120px" }}
        >
          <span />
          <span>Name</span>
          <span>Email</span>
          <span>City</span>
          <span>Joined</span>
          <span className={tabs.cellRight}>Status</span>
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--dim)" }}>
            {enriched.length === 0
              ? "No app users yet."
              : "No users match your search."}
          </div>
        ) : (
          filtered.map((u) => {
            const name = u.displayName || u.username || u.canonicalEmail || u.uid;
            const initial = (
              u.displayName?.[0] ||
              u.username?.[0] ||
              u.canonicalEmail?.[0] ||
              "?"
            ).toUpperCase();
            return (
              <div
                key={u.uid}
                className={`${tabs.row} ${tabs.rowClickable}`}
                style={{ gridTemplateColumns: "34px 1.4fr 1.6fr 1fr 110px 120px" }}
                title="Click for full details"
                onClick={() => setSelected(u)}
              >
                <div className={tabs.avatar}>{initial}</div>
                <div className={tabs.cellStack}>
                  <span className={tabs.cellPrimary}>{name}</span>
                  <span className={tabs.cellSecondary}>
                    {atHandle(u.username)}
                  </span>
                </div>
                <div className={tabs.cellMuted}>
                  {u.canonicalEmail ? (
                    <a href={`mailto:${u.canonicalEmail}`} className={tabs.link}>
                      {u.canonicalEmail}
                    </a>
                  ) : (
                    "—"
                  )}
                </div>
                <div className={tabs.cellMuted}>{u.homeCity || "—"}</div>
                <div className={tabs.cellDim}>
                  {formatDate(u.createdAt ?? u.updatedAt, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </div>
                <div className={tabs.cellRight}>
                  {u.isOrphan ? (
                    <Badge tone="red">orphan</Badge>
                  ) : u.isVerifiedCreator ? (
                    <Badge tone="green">✓ verified</Badge>
                  ) : (
                    <span className={tabs.cellDim}>standard</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {selected && (
        <UserDetailModal
          user={selected}
          authInfo={authMap.map[selected.uid]}
          getIdToken={auth.getIdToken}
          onMutated={() => users.reload()}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   One creator code + a bulk "grant bonus Pro" action.

   Rewards everyone who signed up with that creator's code (e.g. @chloe)
   with extra Pro days, via /api/admin/creator-grant. Idempotent server-
   side: re-running only grants NEW signups, so it's safe to click again
   as the creator's numbers grow.
   ──────────────────────────────────────────────────────────── */
function CreatorCodeRow({
  code,
  count,
  getIdToken,
  onGranted,
}: {
  code: string;
  count: number;
  getIdToken: () => Promise<string | null>;
  onGranted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const [err, setErr] = useState("");

  async function grant() {
    setBusy(true);
    setErr("");
    setResult("");
    try {
      const token = await getIdToken();
      if (!token) throw new Error("Not signed in.");
      const res = await fetch("/api/admin/creator-grant", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code, days: 7 }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setResult(
        json.granted > 0
          ? `+7 days to ${json.granted} user${json.granted === 1 ? "" : "s"}`
          : `nothing new (${json.skippedAlreadyGranted} already had it)`
      );
      onGranted();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <Badge tone="accent">
        @{code} · {count}
      </Badge>
      <button
        type="button"
        className={tabs.proBtn}
        onClick={grant}
        disabled={busy}
        style={{ fontSize: 12, padding: "6px 12px" }}
        title="Give everyone who used this code +7 days of Pro (only new signups on repeat runs)"
      >
        {busy ? "Granting…" : "Grant +1 week Pro"}
      </button>
      {result && <span style={{ fontSize: 12, color: "var(--green)" }}>{result}</span>}
      {err && <span style={{ fontSize: 12, color: "#ff7a7a" }}>⚠ {err}</span>}
    </div>
  );
}

/** Full-detail modal — shows every field on the user doc + Auth identity. */
function UserDetailModal({
  user,
  authInfo,
  getIdToken,
  onMutated,
  onClose,
}: {
  user: EnrichedUser;
  authInfo?: AuthUserInfo;
  getIdToken: () => Promise<string | null>;
  onMutated: () => void;
  onClose: () => void;
}) {
  const name = user.displayName || user.username || user.canonicalEmail || user.uid;
  // All doc fields except the two derived helpers we added in code.
  const docEntries = Object.entries(user).filter(
    ([k]) => k !== "canonicalEmail" && k !== "isOrphan"
  );

  return (
    <div className={tabs.modalOverlay} onClick={onClose}>
      <div className={tabs.modal} onClick={(e) => e.stopPropagation()}>
        <div className={tabs.modalHead}>
          <div className={tabs.cellStack}>
            <span className={tabs.modalTitle}>{name}</span>
            <span className={tabs.cellSecondary}>
              {atHandle(user.username)} · {user.uid}
            </span>
          </div>
          <button className={tabs.modalClose} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className={tabs.modalBody}>
          <ProGrantSection
            uid={user.uid}
            initial={user.proAccessUntil}
            getIdToken={getIdToken}
            onMutated={onMutated}
          />

          <SendEmailSection
            uid={user.uid}
            email={user.canonicalEmail}
            getIdToken={getIdToken}
          />

          <div className={tabs.detailSectionTitle}>Profile</div>
          <div className={tabs.detailGrid}>
            {docEntries.map(([k, v]) => (
              <div className={tabs.detailRow} key={k}>
                <span className={tabs.detailKey}>{k}</span>
                <span className={tabs.detailVal}>{formatValue(k, v)}</span>
              </div>
            ))}
          </div>

          <div className={tabs.detailSectionTitle}>Firebase Auth</div>
          {authInfo ? (
            <div className={tabs.detailGrid}>
              <div className={tabs.detailRow}>
                <span className={tabs.detailKey}>email (canonical)</span>
                <span className={tabs.detailVal}>{authInfo.email || "—"}</span>
              </div>
              <div className={tabs.detailRow}>
                <span className={tabs.detailKey}>emailVerified</span>
                <span className={tabs.detailVal}>{authInfo.emailVerified ? "Yes" : "No"}</span>
              </div>
              <div className={tabs.detailRow}>
                <span className={tabs.detailKey}>providers</span>
                <span className={tabs.detailVal}>{authInfo.providers.join(", ") || "—"}</span>
              </div>
              <div className={tabs.detailRow}>
                <span className={tabs.detailKey}>lastSignIn</span>
                <span className={tabs.detailVal}>{authInfo.lastSignIn || "—"}</span>
              </div>
              <div className={tabs.detailRow}>
                <span className={tabs.detailKey}>created</span>
                <span className={tabs.detailVal}>{authInfo.createdAt || "—"}</span>
              </div>
              <div className={tabs.detailRow}>
                <span className={tabs.detailKey}>disabled</span>
                <span className={tabs.detailVal}>{authInfo.disabled ? "Yes" : "No"}</span>
              </div>
            </div>
          ) : (
            <p className={tabs.cellDim} style={{ padding: "4px 0" }}>
              No matching Firebase Auth account (orphan doc).
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   GymRoam Pro comp — grant/revoke a server-side entitlement.

   Writes `proAccessUntil` to the user doc via /api/admin/pro-grant
   (Admin SDK). iOS 2.3+ reads it into UserStore.isProMember, so a grant
   unlocks every Pro feature with no App Store update. Used to comp
   influencers/testers without touching StoreKit.
   ──────────────────────────────────────────────────────────── */

const DURATIONS: { label: string; value: number | "permanent" }[] = [
  { label: "1 week", value: 7 },
  { label: "1 month", value: 30 },
  { label: "3 months", value: 90 },
  { label: "1 year", value: 365 },
  { label: "Permanent", value: "permanent" },
];

// Any expiry past this reads as a "permanent" comp in the UI (the route
// stores permanent grants as a year-2999 date).
const PERMANENT_THRESHOLD_MS = Date.parse("2900-01-01T00:00:00Z");

function ProGrantSection({
  uid,
  initial,
  getIdToken,
  onMutated,
}: {
  uid: string;
  initial?: FirestoreTimestamp | null;
  getIdToken: () => Promise<string | null>;
  onMutated: () => void;
}) {
  const [untilMs, setUntilMs] = useState<number | null>(
    initial ? tsToMillis(initial) : null
  );
  const [duration, setDuration] = useState<number | "permanent">(365);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const now = Date.now();
  const isActive = untilMs != null && untilMs > now;
  const isPermanent = untilMs != null && untilMs > PERMANENT_THRESHOLD_MS;
  const isExpired = untilMs != null && untilMs <= now;

  async function submit(action: "grant" | "revoke") {
    setBusy(true);
    setErr("");
    try {
      const token = await getIdToken();
      if (!token) throw new Error("Not signed in.");
      const res = await fetch("/api/admin/pro-grant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(
          action === "grant"
            ? { uid, action, durationDays: duration, reason: reason.trim() }
            : { uid, action }
        ),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setUntilMs(action === "revoke" ? null : Date.parse(json.proAccessUntil));
      if (action === "revoke") setReason("");
      onMutated();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className={tabs.detailSectionTitle}>GymRoam Pro</div>
      <div className={tabs.proBox}>
        <div className={tabs.proStatusRow}>
          <span
            className={`${tabs.proDot} ${isActive ? tabs.proDotOn : ""}`}
            aria-hidden="true"
          />
          <span className={tabs.proStatusText}>
            {isActive ? (
              isPermanent ? (
                <>
                  Pro comp active · <strong>permanent</strong>
                </>
              ) : (
                <>
                  Pro comp active · until{" "}
                  <strong>
                    {formatDate(untilMs!, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </strong>
                </>
              )
            ) : isExpired ? (
              "Pro comp expired — not active"
            ) : (
              "No Pro comp — standard entitlement"
            )}
          </span>
        </div>

        {!isActive && (
          <>
            <div className={tabs.proChips}>
              {DURATIONS.map((d) => (
                <button
                  key={d.label}
                  type="button"
                  className={`${tabs.chip} ${
                    duration === d.value ? tabs.chipActive : ""
                  }`}
                  onClick={() => setDuration(d.value)}
                  disabled={busy}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <input
              className={tabs.proReason}
              placeholder='Note (optional), e.g. "Pro on us for a week"'
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={busy}
              maxLength={200}
            />
            <button
              type="button"
              className={tabs.proBtn}
              onClick={() => submit("grant")}
              disabled={busy}
            >
              {busy ? "Granting…" : "Grant Pro"}
            </button>
          </>
        )}

        {isActive && (
          <button
            type="button"
            className={tabs.proBtnDanger}
            onClick={() => submit("revoke")}
            disabled={busy}
          >
            {busy ? "Revoking…" : "Revoke Pro"}
          </button>
        )}

        {err && <div className={tabs.proErr}>⚠ {err}</div>}
        <p className={tabs.proHint}>
          Server-side comp. Takes effect in-app on next launch/refresh — no App
          Store update. Requires the iOS <code>proAccessUntil</code> read (2.3+).
        </p>
      </div>
    </>
  );
}

/* ────────────────────────────────────────────────────────────
   Send a transactional 1:1 email to this user.

   Renders a code-defined template (src/lib/email-templates.ts) and POSTs
   to /api/admin/send-email, which sends via Resend and logs to
   adminEmailLog. Transactional only — no bulk, no marketing.
   ──────────────────────────────────────────────────────────── */

function SendEmailSection({
  uid,
  email,
  getIdToken,
}: {
  uid: string;
  email: string;
  getIdToken: () => Promise<string | null>;
}) {
  const [templateId, setTemplateId] = useState(EMAIL_TEMPLATE_OPTIONS[0].id);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const tmpl =
    EMAIL_TEMPLATE_OPTIONS.find((t) => t.id === templateId) ??
    EMAIL_TEMPLATE_OPTIONS[0];
  const noEmail = !email;
  const isPrivateRelay = email.endsWith("@privaterelay.appleid.com");

  async function send() {
    setBusy(true);
    setResult(null);
    try {
      const token = await getIdToken();
      if (!token) throw new Error("Not signed in.");
      const res = await fetch("/api/admin/send-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          uid,
          templateId,
          ...(tmpl.editable ? { subject, body: message } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setResult({ ok: true, text: `Sent “${json.subject}” to ${json.to}.` });
      if (tmpl.editable) {
        setSubject("");
        setMessage("");
      }
    } catch (e) {
      setResult({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className={tabs.detailSectionTitle}>Send Email</div>
      <div className={tabs.proBox}>
        <div className={tabs.emailTo}>
          To:{" "}
          {noEmail ? (
            <em>no email on file</em>
          ) : (
            <strong>{email}</strong>
          )}
        </div>
        {isPrivateRelay && (
          <div className={tabs.emailWarn}>
            Apple private-relay address — delivery requires your send domain to
            be registered under Apple Developer → Sign in with Apple → Email
            Sources, or it will bounce.
          </div>
        )}

        <select
          className={tabs.emailSelect}
          value={templateId}
          onChange={(e) => {
            setTemplateId(e.target.value);
            setResult(null);
          }}
          disabled={busy || noEmail}
        >
          {EMAIL_TEMPLATE_OPTIONS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <p className={tabs.emailDesc}>{tmpl.description}</p>

        {tmpl.editable && (
          <>
            <input
              className={tabs.proReason}
              placeholder="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={busy || noEmail}
              maxLength={140}
            />
            <textarea
              className={tabs.emailBody}
              placeholder="Your message…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={busy || noEmail}
              rows={5}
            />
          </>
        )}

        <button
          type="button"
          className={tabs.proBtn}
          onClick={send}
          disabled={busy || noEmail || (tmpl.editable && !message.trim())}
        >
          {busy ? "Sending…" : "Send email"}
        </button>

        {result && (
          <div className={result.ok ? tabs.emailOk : tabs.proErr}>
            {result.ok ? "✓ " : "⚠ "}
            {result.text}
          </div>
        )}
        <p className={tabs.proHint}>
          Transactional 1:1 only — sends via Resend, logged to{" "}
          <code>adminEmailLog</code>. Dormant until <code>RESEND_API_KEY</code>{" "}
          + <code>EMAIL_FROM</code> are set.
        </p>
      </div>
    </>
  );
}
