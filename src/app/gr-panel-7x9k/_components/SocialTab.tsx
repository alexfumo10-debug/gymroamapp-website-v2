/**
 * Social tab — Instagram follower analytics.
 * (TikTok and X were removed; Instagram is the only tracked platform.)
 */

"use client";

import { useAdminApi, type useAdminAuth } from "../_lib/useAdminData";
import { formatCompact } from "../_lib/format";
import type { SocialStat } from "../_lib/types";
import { StatTile, Loading, ErrorState, SectionHeading, Card, Badge } from "./ui";
import tabs from "./tabs.module.css";

type Auth = ReturnType<typeof useAdminAuth>;

interface SocialResponse {
  stats: SocialStat[];
  platforms: { instagram: boolean };
  errors?: Record<string, string>;
}

export function SocialTab({ auth }: { auth: Auth }) {
  const { data, state } = useAdminApi<SocialResponse>(
    "/api/admin/social",
    auth.getIdToken,
    true
  );

  if (state === "loading") return <Loading label="Loading social…" />;
  if (state === "error" && !data) {
    return <ErrorState message="Failed to load social analytics" />;
  }

  const ig = (data?.stats || []).find((s) => s.platform === "instagram");
  const connected = !!data?.platforms?.instagram;
  const igError = data?.errors?.instagram;

  return (
    <div>
      <SectionHeading
        title="Instagram"
        meta={connected ? "@gymroamapp · Graph API" : "not connected"}
      />

      {!connected ? (
        <Card>
          <div className={tabs.tierTop}>
            <span className={tabs.tierName}>Instagram</span>
            <Badge tone="orange">not connected</Badge>
          </div>
          <p className={tabs.chartSub} style={{ margin: "8px 0 0" }}>
            Needs a Business/Creator account linked to the GymRoam Facebook
            Page + the Instagram env vars (INSTAGRAM_ACCESS_TOKEN,
            INSTAGRAM_IG_USER_ID).
          </p>
        </Card>
      ) : igError ? (
        <ErrorState message={igError} />
      ) : ig ? (
        <>
          <div className={tabs.kpiGrid}>
            <StatTile accent label="Followers" value={formatCompact(ig.followers)} />
            <StatTile label="Posts" value={formatCompact(ig.posts)} />
            <StatTile
              label="New This Week"
              value={`${ig.followingDelta7d >= 0 ? "+" : ""}${ig.followingDelta7d}`}
              sub="net followers"
            />
            {typeof ig.engagementRate === "number" && (
              <StatTile label="Engagement" value={`${ig.engagementRate.toFixed(1)}%`} />
            )}
          </div>
        </>
      ) : (
        <p className={tabs.chartSub}>No Instagram data returned.</p>
      )}
    </div>
  );
}
