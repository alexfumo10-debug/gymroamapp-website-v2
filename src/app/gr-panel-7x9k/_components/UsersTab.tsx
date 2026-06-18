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
import type { AppUser, AuthUserInfo } from "../_lib/types";
import { StatTile, Loading, ErrorState, Badge } from "./ui";
import tabs from "./tabs.module.css";

type Auth = ReturnType<typeof useAdminAuth>;
type EnrichedUser = AppUser & { canonicalEmail: string; isOrphan: boolean };

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
      const authInfo = authMap.map[u.uid];
      const canonicalEmail = authInfo?.email || u.email || "";
      const isOrphan = authMap.state === "ready" && !authInfo;
      return { ...u, canonicalEmail, isOrphan };
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
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

/** Full-detail modal — shows every field on the user doc + Auth identity. */
function UserDetailModal({
  user,
  authInfo,
  onClose,
}: {
  user: EnrichedUser;
  authInfo?: AuthUserInfo;
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
