/**
 * Affiliates tab — creator referral applications, review and approval.
 *
 * This is the tab that replaces running the program out of an inbox:
 * every application lands here, you open one, adjust the code if you
 * want, and approve or reject.
 *
 * Reads go through /api/admin/affiliates (Admin SDK, admin-gated) because
 * these applications hold applicant PII and must not be client-readable.
 * WRITES go through /api/admin/affiliates rather than the client SDK,
 * because issuing a code has to be atomic against the affiliateCodes
 * uniqueness lock — see that route for why.
 */

"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { formatDate, formatCompact } from "../_lib/format";
import type { AffiliateApplication } from "../_lib/types";
import {
  normalizeCode,
  validateCodeFormat,
  CODE_REJECTION_MESSAGES,
  CODE_MAX_LENGTH,
  trackingLink,
} from "@/lib/affiliate";
import { StatTile, Loading, Badge, ErrorState, EmptyHint } from "./ui";
import { AffiliatePerformance } from "./AffiliatePerformance";
import tabs from "./tabs.module.css";
import styles from "./AffiliatesTab.module.css";

type Filter = "pending" | "approved" | "rejected" | "all";
type View = "applications" | "performance";

interface Props {
  auth: { getIdToken: () => Promise<string | null> };
}

/**
 * Two jobs, two views: reviewing who gets in (Applications) and
 * watching what they produce (Performance). Splitting them keeps the
 * approval queue uncluttered once the roster grows.
 */
export function AffiliatesTab({ auth }: Props) {
  const [view, setView] = useState<View>("applications");

  return (
    <div>
      <div className={styles.viewSwitch}>
        {([
          { k: "applications", label: "Applications" },
          { k: "performance", label: "Performance" },
        ] as const).map(({ k, label }) => (
          <button
            key={k}
            className={`${styles.viewBtn} ${view === k ? styles.viewBtnActive : ""}`}
            onClick={() => setView(k)}
          >
            {label}
          </button>
        ))}
      </div>

      {view === "applications" ? (
        <ApplicationsView auth={auth} />
      ) : (
        <AffiliatePerformance auth={auth} />
      )}
    </div>
  );
}

/**
 * Applications, loaded through the admin API instead of the client SDK.
 *
 * These documents carry applicant PII (name, email, phone, payment
 * preference), so `affiliateApplications` has no client read rule and never
 * should — reading it from the browser fails with "Missing or insufficient
 * permissions". The server route verifies the admin token and reads with the
 * Admin SDK. Shape matches useCollection so the view below is unchanged.
 */
function useAffiliateApplications(getIdToken: () => Promise<string | null>) {
  const [data, setData] = useState<AffiliateApplication[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setState("loading");
      try {
        const token = await getIdToken();
        if (!token) throw new Error("not signed in");
        const res = await fetch("/api/admin/affiliates", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (!res.ok || !json.ok) throw new Error(json?.error || `HTTP ${res.status}`);
        if (cancelled) return;
        setData((json.applications || []) as AffiliateApplication[]);
        setState("ready");
      } catch (e) {
        if (cancelled) return;
        setError((e as Error).message);
        setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  return { data, state, error, reload };
}

function ApplicationsView({ auth }: Props) {
  const apps = useAffiliateApplications(auth.getIdToken);

  const [filter, setFilter] = useState<Filter>("pending");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, rejected: 0 };
    for (const a of apps.data) {
      if (a.status === "pending") c.pending++;
      else if (a.status === "approved") c.approved++;
      else if (a.status === "rejected") c.rejected++;
    }
    return c;
  }, [apps.data]);

  /** Combined claimed reach across approved creators — a rough sense of
   *  distribution, not a verified number. Labeled as claimed in the UI. */
  const approvedReach = useMemo(
    () =>
      apps.data
        .filter((a) => a.status === "approved")
        .reduce(
          (sum, a) =>
            sum + (a.instagramFollowers || 0) + (a.tiktokFollowers || 0),
          0
        ),
    [apps.data]
  );

  const q = search.trim().toLowerCase();
  const rows = useMemo(
    () =>
      apps.data
        .filter((a) => filter === "all" || a.status === filter)
        .filter(
          (a) =>
            !q ||
            a.fullName?.toLowerCase().includes(q) ||
            a.email?.toLowerCase().includes(q) ||
            a.instagramHandle?.toLowerCase().includes(q) ||
            a.tiktokHandle?.toLowerCase().includes(q) ||
            a.requestedCode?.toLowerCase().includes(q) ||
            (a.issuedCode || "").toLowerCase().includes(q)
        ),
    [apps.data, filter, q]
  );

  const open = openId ? apps.data.find((a) => a.id === openId) || null : null;

  if (apps.state === "loading") return <Loading label="Loading affiliates…" />;
  if (apps.state === "error") return <ErrorState message={apps.error} />;

  const GRID = "1.5fr 1.4fr 1fr 0.9fr 110px 100px";

  return (
    <div>
      <div className={tabs.kpiGrid}>
        <StatTile accent label="Pending Review" value={counts.pending} sub={`${apps.data.length} total`} />
        <StatTile label="Approved" value={counts.approved} />
        <StatTile label="Rejected" value={counts.rejected} />
        <StatTile
          label="Approved Reach"
          value={formatCompact(approvedReach)}
          sub="claimed, unverified"
        />
      </div>

      <div className={tabs.toolbar}>
        <div className={tabs.filterChips}>
          {([
            { k: "pending", label: "Pending", n: counts.pending },
            { k: "approved", label: "Approved", n: counts.approved },
            { k: "rejected", label: "Rejected", n: counts.rejected },
            { k: "all", label: "All", n: apps.data.length },
          ] as const).map(({ k, label, n }) => (
            <button
              key={k}
              className={`${tabs.chip} ${filter === k ? tabs.chipActive : ""}`}
              onClick={() => setFilter(k)}
            >
              {label}
              {n > 0 && ` · ${n}`}
            </button>
          ))}
        </div>
        <input
          className={tabs.search}
          placeholder="Search name, email, handle, code…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyHint>
          {filter === "pending"
            ? "No applications waiting on you."
            : "Nothing here yet."}
        </EmptyHint>
      ) : (
        <div className={tabs.table}>
          <div
            className={`${tabs.row} ${tabs.rowHeader}`}
            style={{ gridTemplateColumns: GRID }}
          >
            <span>Creator</span>
            <span>Platforms</span>
            <span>Niche</span>
            <span>Code</span>
            <span>Applied</span>
            <span className={tabs.cellRight}>Status</span>
          </div>

          {rows.map((a) => (
            <div
              key={a.id}
              className={`${tabs.row} ${tabs.rowClickable}`}
              style={{ gridTemplateColumns: GRID }}
              onClick={() => setOpenId(a.id)}
            >
              <div className={tabs.cellStack}>
                <span className={tabs.cellPrimary}>{a.fullName || "—"}</span>
                <span className={tabs.cellSecondary}>{a.email}</span>
              </div>
              <div className={tabs.cellStack}>
                <span className={tabs.cellMuted}>
                  {a.instagramHandle || "—"}
                  {a.instagramFollowers
                    ? ` · ${formatCompact(a.instagramFollowers)}`
                    : ""}
                </span>
                <span className={tabs.cellSecondary}>
                  {a.tiktokHandle || "—"}
                  {a.tiktokFollowers
                    ? ` · ${formatCompact(a.tiktokFollowers)}`
                    : ""}
                </span>
              </div>
              <div className={tabs.cellMuted}>{a.niche || "—"}</div>
              <div className={styles.codeCell}>
                {a.issuedCode || a.requestedCode || "—"}
                {!a.issuedCode && a.requestedCode && (
                  <span className={styles.codeCellPending}>requested</span>
                )}
              </div>
              <div className={tabs.cellDim}>
                {formatDate(a.createdAt, { month: "short", day: "numeric" })}
              </div>
              <div className={tabs.cellRight}>
                <Badge
                  tone={
                    a.status === "approved"
                      ? "green"
                      : a.status === "rejected"
                      ? "red"
                      : "orange"
                  }
                >
                  {a.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <ReviewModal
          application={open}
          getIdToken={auth.getIdToken}
          onClose={() => setOpenId(null)}
          onDone={() => {
            setOpenId(null);
            apps.reload();
          }}
        />
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Review modal — the whole application, plus the decision.
   ──────────────────────────────────────────────────────────── */

function ReviewModal({
  application,
  getIdToken,
  onClose,
  onDone,
}: {
  application: AffiliateApplication;
  getIdToken: () => Promise<string | null>;
  onClose: () => void;
  onDone: () => void;
}) {
  const a = application;
  const isApproved = a.status === "approved";

  const [code, setCode] = useState(
    normalizeCode(a.issuedCode || a.requestedCode || "")
  );
  const [reviewNote, setReviewNote] = useState(a.reviewNote || "");
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const formatIssue = code ? validateCodeFormat(code) : "empty";
  const codeError = formatIssue ? CODE_REJECTION_MESSAGES[formatIssue] : "";
  const changedCode = normalizeCode(a.issuedCode || "") !== code;

  const post = useCallback(
    async (action: "approve" | "reject" | "recode") => {
      setBusy(action === "reject" ? "reject" : "approve");
      setError("");
      try {
        const token = await getIdToken();
        if (!token) throw new Error("Not signed in");
        const res = await fetch("/api/admin/affiliates", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            applicationId: a.id,
            action,
            code,
            reviewNote,
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          setError(json?.error || `Failed (${res.status})`);
          return;
        }
        if (json?.warning) {
          // Code issued but email didn't queue — worth seeing, not a failure.
          setError(json.warning);
          return;
        }
        onDone();
      } catch (e) {
        setError((e as Error).message || "Something went wrong");
      } finally {
        setBusy(null);
      }
    },
    [a.id, code, reviewNote, getIdToken, onDone]
  );

  const link = code && !formatIssue ? trackingLink(code) : "";

  function copyLink() {
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  const detail = (label: string, value: React.ReactNode) => (
    <div className={tabs.detailRow}>
      <span className={tabs.detailKey}>{label}</span>
      <span className={tabs.detailVal}>{value || "—"}</span>
    </div>
  );

  return (
    <div className={tabs.modalOverlay} onClick={onClose}>
      <div className={tabs.modal} onClick={(e) => e.stopPropagation()}>
        <div className={tabs.modalHead}>
          <div className={tabs.cellStack}>
            <span className={tabs.modalTitle}>{a.fullName}</span>
            <span className={tabs.cellSecondary}>
              {a.email} · applied {formatDate(a.createdAt)}
            </span>
          </div>
          <button className={tabs.modalClose} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className={tabs.modalBody}>
          <div className={tabs.detailSectionTitle}>Platforms</div>
          <div className={tabs.detailGrid}>
            {detail(
              "Instagram",
              a.instagramHandle && (
                <a
                  className={tabs.link}
                  href={`https://instagram.com/${a.instagramHandle.replace(/^@/, "")}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {a.instagramHandle} · {(a.instagramFollowers || 0).toLocaleString()}
                </a>
              )
            )}
            {detail(
              "TikTok",
              a.tiktokHandle && (
                <a
                  className={tabs.link}
                  href={`https://tiktok.com/@${a.tiktokHandle.replace(/^@/, "")}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {a.tiktokHandle} · {(a.tiktokFollowers || 0).toLocaleString()}
                </a>
              )
            )}
            {detail("Other", a.otherPlatform)}
            {detail("Niche", a.niche)}
            {detail("Audience", a.audienceLocation)}
          </div>

          <div className={tabs.detailSectionTitle}>Contact &amp; payment</div>
          <div className={tabs.detailGrid}>
            {detail("Phone", a.phone)}
            {detail(
              "Location",
              [a.stateRegion, a.country].filter(Boolean).join(", ")
            )}
            {detail("Payment preference", a.paymentMethod)}
            {detail("Heard about us", a.heardAbout)}
            {detail("Notes", a.notes)}
          </div>

          <div className={tabs.detailSectionTitle}>
            {isApproved ? "Issued code" : "Decision"}
          </div>

          <div className={styles.decision}>
            <label className={styles.codeLabel} htmlFor="issueCode">
              Referral code
              {a.requestedCode && (
                <span className={styles.requestedHint}>
                  requested: {a.requestedCode}
                </span>
              )}
            </label>
            <input
              id="issueCode"
              className={styles.codeField}
              value={code}
              maxLength={CODE_MAX_LENGTH}
              autoCapitalize="characters"
              spellCheck={false}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
            {codeError ? (
              <div className={styles.codeError}>{codeError}</div>
            ) : (
              <div className={styles.linkRow}>
                <code className={styles.link}>{link}</code>
                <button className={styles.copyBtn} onClick={copyLink}>
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            )}

            {!isApproved && (
              <>
                <label className={styles.codeLabel} htmlFor="reviewNote">
                  Internal note (shown only to us)
                </label>
                <textarea
                  id="reviewNote"
                  className={styles.noteField}
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="Why approved or rejected…"
                />
              </>
            )}

            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.actions}>
              {isApproved ? (
                <button
                  className={styles.approveBtn}
                  disabled={!!formatIssue || !changedCode || busy !== null}
                  onClick={() => post("recode")}
                >
                  {busy === "approve"
                    ? "Saving…"
                    : changedCode
                    ? "Change code"
                    : "Code unchanged"}
                </button>
              ) : (
                <>
                  <button
                    className={styles.rejectBtn}
                    disabled={busy !== null}
                    onClick={() => post("reject")}
                  >
                    {busy === "reject" ? "Rejecting…" : "Reject"}
                  </button>
                  <button
                    className={styles.approveBtn}
                    disabled={!!formatIssue || busy !== null}
                    onClick={() => post("approve")}
                  >
                    {busy === "approve" ? "Approving…" : `Approve & issue ${code}`}
                  </button>
                </>
              )}
            </div>

            {!isApproved && (
              <p className={styles.actionNote}>
                Approving issues the code, emails their welcome pack with the
                tracking link, and reminds them not to use Sign in with Apple.
                Sending the agreement and switching on their free Pro are still
                manual.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
