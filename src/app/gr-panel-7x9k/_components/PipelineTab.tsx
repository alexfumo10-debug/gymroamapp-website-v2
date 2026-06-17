/**
 * Pipeline tab — gym, trainer & career applications (read view).
 *
 * Three sub-views over the three Firestore application collections.
 * Read-only for now (counts, search, status filter); the approve /
 * reject / passcode-email write flows from the live panel will be
 * ported once the rebuild is approved, to avoid forking that logic.
 */

"use client";

import { useMemo, useState } from "react";
import { useCollection } from "../_lib/useAdminData";
import { formatDate } from "../_lib/format";
import type {
  GymApplication,
  TrainerApplication,
  CareerApplication,
} from "../_lib/types";
import { StatTile, Loading, Badge } from "./ui";
import tabs from "./tabs.module.css";

type SubTab = "gym" | "trainer" | "career";

export function PipelineTab() {
  const gym = useCollection<GymApplication>("gymPartnerApplications");
  const trainer = useCollection<TrainerApplication>("trainerApplications");
  const career = useCollection<CareerApplication>("careersApplications");
  const [sub, setSub] = useState<SubTab>("gym");
  const [search, setSearch] = useState("");

  const pendingGym = gym.data.filter((g) => g.status === "pending").length;
  const pendingTrainer = trainer.data.filter((t) => t.status === "pending").length;
  const pendingCareer = career.data.filter((c) => c.status === "pending").length;

  const loading =
    gym.state === "loading" ||
    trainer.state === "loading" ||
    career.state === "loading";

  const q = search.trim().toLowerCase();
  const gymRows = useMemo(
    () =>
      gym.data.filter(
        (g) =>
          !q ||
          g.gymName?.toLowerCase().includes(q) ||
          g.ownerEmail?.toLowerCase().includes(q) ||
          g.gymCity?.toLowerCase().includes(q)
      ),
    [gym.data, q]
  );
  const trainerRows = useMemo(
    () =>
      trainer.data.filter(
        (t) =>
          !q ||
          t.fullName?.toLowerCase().includes(q) ||
          t.email?.toLowerCase().includes(q) ||
          t.instagramHandle?.toLowerCase().includes(q)
      ),
    [trainer.data, q]
  );
  const careerRows = useMemo(
    () =>
      career.data.filter(
        (c) =>
          !q ||
          c.fullName?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.roleTitle?.toLowerCase().includes(q)
      ),
    [career.data, q]
  );

  if (loading) return <Loading label="Loading pipeline…" />;

  const statusTone = (s: string) =>
    s === "approved"
      ? "green"
      : s === "rejected"
      ? "red"
      : s === "reviewed"
      ? "blue"
      : "orange";

  return (
    <div>
      <div className={tabs.kpiGrid}>
        <StatTile accent label="Pending Gyms" value={pendingGym} sub={`${gym.data.length} total`} />
        <StatTile label="Pending Trainers" value={pendingTrainer} sub={`${trainer.data.length} total`} />
        <StatTile label="Pending Careers" value={pendingCareer} sub={`${career.data.length} total`} />
      </div>

      <div className={tabs.toolbar}>
        <div className={tabs.filterChips}>
          {([
            { k: "gym", label: "Gym", n: pendingGym },
            { k: "trainer", label: "Trainer", n: pendingTrainer },
            { k: "career", label: "Career", n: pendingCareer },
          ] as const).map(({ k, label, n }) => (
            <button
              key={k}
              className={`${tabs.chip} ${sub === k ? tabs.chipActive : ""}`}
              onClick={() => setSub(k)}
            >
              {label}
              {n > 0 && ` · ${n}`}
            </button>
          ))}
        </div>
        <input
          className={tabs.search}
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Gym applications */}
      {sub === "gym" && (
        <div className={tabs.table}>
          <div
            className={`${tabs.row} ${tabs.rowHeader}`}
            style={{ gridTemplateColumns: "1.4fr 1.6fr 1fr 110px 100px" }}
          >
            <span>Gym</span>
            <span>Owner</span>
            <span>City</span>
            <span>Applied</span>
            <span className={tabs.cellRight}>Status</span>
          </div>
          {gymRows.map((g) => (
            <div
              key={g.id}
              className={tabs.row}
              style={{ gridTemplateColumns: "1.4fr 1.6fr 1fr 110px 100px" }}
            >
              <div className={tabs.cellStack}>
                <span className={tabs.cellPrimary}>{g.gymName || "—"}</span>
                <span className={tabs.cellSecondary}>{g.gymType || ""}</span>
              </div>
              <div className={tabs.cellMuted}>
                {g.ownerEmail ? (
                  <a href={`mailto:${g.ownerEmail}`} className={tabs.link}>
                    {g.ownerName || g.ownerEmail}
                  </a>
                ) : (
                  g.ownerName || "—"
                )}
              </div>
              <div className={tabs.cellMuted}>
                {[g.gymCity, g.gymState].filter(Boolean).join(", ") || "—"}
              </div>
              <div className={tabs.cellDim}>
                {formatDate(g.createdAt, { month: "short", day: "numeric" })}
              </div>
              <div className={tabs.cellRight}>
                <Badge tone={statusTone(g.status)}>{g.status}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Trainer applications */}
      {sub === "trainer" && (
        <div className={tabs.table}>
          <div
            className={`${tabs.row} ${tabs.rowHeader}`}
            style={{ gridTemplateColumns: "1.4fr 1.4fr 1fr 110px 100px" }}
          >
            <span>Name</span>
            <span>Instagram</span>
            <span>Specialty</span>
            <span>Applied</span>
            <span className={tabs.cellRight}>Status</span>
          </div>
          {trainerRows.map((t) => (
            <div
              key={t.id}
              className={tabs.row}
              style={{ gridTemplateColumns: "1.4fr 1.4fr 1fr 110px 100px" }}
            >
              <div className={tabs.cellStack}>
                <span className={tabs.cellPrimary}>{t.fullName || "—"}</span>
                <span className={tabs.cellSecondary}>{t.email}</span>
              </div>
              <div className={tabs.cellMuted}>
                {t.instagramHandle ? `@${t.instagramHandle.replace(/^@/, "")}` : "—"}
                {t.followerCount ? ` · ${t.followerCount.toLocaleString()}` : ""}
              </div>
              <div className={tabs.cellMuted}>{t.specialty || "—"}</div>
              <div className={tabs.cellDim}>
                {formatDate(t.createdAt, { month: "short", day: "numeric" })}
              </div>
              <div className={tabs.cellRight}>
                <Badge tone={statusTone(t.status)}>{t.status}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Career applications */}
      {sub === "career" && (
        <div className={tabs.table}>
          <div
            className={`${tabs.row} ${tabs.rowHeader}`}
            style={{ gridTemplateColumns: "1.4fr 1.6fr 1fr 110px 100px" }}
          >
            <span>Name</span>
            <span>Role</span>
            <span>City</span>
            <span>Applied</span>
            <span className={tabs.cellRight}>Status</span>
          </div>
          {careerRows.map((c) => (
            <div
              key={c.id}
              className={tabs.row}
              style={{ gridTemplateColumns: "1.4fr 1.6fr 1fr 110px 100px" }}
            >
              <div className={tabs.cellStack}>
                <span className={tabs.cellPrimary}>{c.fullName || "—"}</span>
                <span className={tabs.cellSecondary}>{c.email}</span>
              </div>
              <div className={tabs.cellMuted}>{c.roleTitle || "—"}</div>
              <div className={tabs.cellMuted}>{c.city || "—"}</div>
              <div className={tabs.cellDim}>
                {formatDate(c.createdAt, { month: "short", day: "numeric" })}
              </div>
              <div className={tabs.cellRight}>
                <Badge tone={statusTone(c.status)}>{c.status}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
