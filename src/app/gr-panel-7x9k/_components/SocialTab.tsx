/**
 * Social tab — follower analytics across Instagram, TikTok, X.
 * Live cards for connected platforms; connect-ready notes for the rest.
 */

"use client";

import { useMemo } from "react";
import { useAdminApi, type useAdminAuth } from "../_lib/useAdminData";
import { formatCompact } from "../_lib/format";
import type { SocialStat } from "../_lib/types";
import { StatTile, Loading, ErrorState, SectionHeading, Card, Badge } from "./ui";
import tabs from "./tabs.module.css";

type Auth = ReturnType<typeof useAdminAuth>;
type Platform = "instagram" | "tiktok" | "x";

interface SocialResponse {
  stats: SocialStat[];
  platforms: Record<Platform, boolean>;
  errors?: Record<string, string>;
}

const META: Record<Platform, { label: string; handle: string; hint: string }> = {
  instagram: {
    label: "Instagram",
    handle: "@gymroamapp",
    hint: "Business/Creator account linked to a Facebook Page + a Page token (instagram_basic).",
  },
  tiktok: {
    label: "TikTok",
    handle: "@gymroamapp",
    hint: "TikTok Display API — needs a developer app + one-time OAuth authorization.",
  },
  x: {
    label: "X",
    handle: "@gymroamapp",
    hint: "X API v2 — requires a paid plan + bearer token.",
  },
};

function LiveCard({ s }: { s: SocialStat }) {
  const m = META[s.platform];
  return (
    <Card>
      <div className={tabs.tierTop}>
        <span className={tabs.tierName}>{m.label}</span>
        <Badge tone="green">connected</Badge>
      </div>
      <div className={tabs.tierActive}>{formatCompact(s.followers)}</div>
      <div className={tabs.tierLabel}>followers</div>
      <div className={tabs.tierFooter}>
        <span style={{ color: s.followingDelta7d >= 0 ? "var(--green)" : "var(--red)" }}>
          {s.followingDelta7d >= 0 ? "+" : ""}
          {s.followingDelta7d} this week
        </span>
        <span className={tabs.cellDim}>{formatCompact(s.posts)} posts</span>
        {typeof s.engagementRate === "number" && (
          <span className={tabs.cellDim}>{s.engagementRate.toFixed(1)}% eng.</span>
        )}
      </div>
    </Card>
  );
}

function ConnectCard({ platform }: { platform: Platform }) {
  const m = META[platform];
  return (
    <Card>
      <div className={tabs.tierTop}>
        <span className={tabs.tierName}>{m.label}</span>
        <Badge tone="orange">not connected</Badge>
      </div>
      <p className={tabs.chartSub} style={{ margin: "8px 0 0" }}>{m.hint}</p>
    </Card>
  );
}

export function SocialTab({ auth }: { auth: Auth }) {
  const { data, state } = useAdminApi<SocialResponse>(
    "/api/admin/social",
    auth.getIdToken,
    true
  );

  const statByPlatform = useMemo(() => {
    const map = new Map<Platform, SocialStat>();
    (data?.stats || []).forEach((s) => map.set(s.platform, s));
    return map;
  }, [data]);

  const totalFollowers = useMemo(
    () => (data?.stats || []).reduce((sum, s) => sum + s.followers, 0),
    [data]
  );

  if (state === "loading") return <Loading label="Loading social…" />;
  if (state === "error" && !data) {
    return <ErrorState message="Failed to load social analytics" />;
  }

  const platforms: Platform[] = ["instagram", "tiktok", "x"];
  const connectedCount = platforms.filter((p) => data?.platforms?.[p]).length;

  return (
    <div>
      <div className={tabs.kpiGrid}>
        <StatTile accent label="Total Followers" value={formatCompact(totalFollowers)} sub={`${connectedCount}/3 platforms connected`} />
        {platforms.map((p) => {
          const s = statByPlatform.get(p);
          return (
            <StatTile
              key={p}
              label={META[p].label}
              value={s ? formatCompact(s.followers) : "—"}
              sub={s ? `${s.followingDelta7d >= 0 ? "+" : ""}${s.followingDelta7d} this wk` : "not connected"}
            />
          );
        })}
      </div>

      <SectionHeading title="Platforms" />
      <div className={tabs.chartGrid}>
        {platforms.map((p) => {
          const s = statByPlatform.get(p);
          return s ? <LiveCard key={p} s={s} /> : <ConnectCard key={p} platform={p} />;
        })}
      </div>

      {data?.errors && Object.keys(data.errors).length > 0 && (
        <div className={tabs.connectNotes}>
          {Object.entries(data.errors).map(([p, msg]) => (
            <div key={p} className={tabs.connectNote}>
              <Badge tone="red">{META[p as Platform]?.label || p}</Badge>
              <span>{msg}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
