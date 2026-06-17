/**
 * Connect-ready tab — the finished state for any data source whose
 * integration isn't wired yet. Renders the honest "needs [credential]"
 * panel. Becomes a real data view once its /api/admin/<key> route +
 * env vars exist (and the shell swaps this for the real tab).
 */

"use client";

import type { DataSource } from "../_lib/sources";
import { SectionHeading, ConnectReadyState } from "./ui";

export function ConnectTab({ source }: { source: DataSource }) {
  return (
    <div>
      <SectionHeading
        title={source.label}
        meta="Connect-ready"
      />
      <ConnectReadyState source={source} />
    </div>
  );
}
