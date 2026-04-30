"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { MIAMI_GYMS } from "./mapData";
import styles from "./MapPreview.module.css";

// Leaflet imports `window` at module load — defer to client only.
const MapPreviewInner = dynamic(() => import("./MapPreviewInner"), {
  ssr: false,
  loading: () => <div className={styles.mapLoading}>Loading map…</div>,
});

// Activity types in the order we want chips to appear.
const ACTIVITY_ORDER = [
  "Lifting",
  "Pilates",
  "Yoga",
  "CrossFit",
  "HIIT",
  "Cycling",
  "Run Club",
  "Boxing",
  "Climbing",
];

export default function MapPreview() {
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  // Count of pins per activity for the badge on each chip.
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    MIAMI_GYMS.forEach((g) => {
      c[g.type] = (c[g.type] || 0) + 1;
    });
    return c;
  }, []);

  const visibleCount = activeFilter
    ? counts[activeFilter] || 0
    : MIAMI_GYMS.length;

  return (
    <section className={styles.section} id="map-preview">
      <div className={styles.inner}>
        <div className={styles.headerRow}>
          <div className={styles.tag}>Live preview</div>
          <h2 className="fade-up">See what&apos;s nearby in Miami</h2>
          <p className="fade-up">
            A taste of what you&apos;ll see when you open GymRoam.
            Filter by activity or tap a pin to explore.
          </p>
        </div>

        {/* Activity filter chips */}
        <div className={`${styles.filterRow} fade-up`}>
          <button
            className={`${styles.chip} ${activeFilter === null ? styles.chipActive : ""}`}
            onClick={() => setActiveFilter(null)}
          >
            All
            <span className={styles.chipCount}>{MIAMI_GYMS.length}</span>
          </button>
          {ACTIVITY_ORDER.filter((a) => counts[a]).map((activity) => {
            const isActive = activeFilter === activity;
            return (
              <button
                key={activity}
                className={`${styles.chip} ${isActive ? styles.chipActive : ""}`}
                onClick={() => setActiveFilter(isActive ? null : activity)}
              >
                {activity}
                <span className={styles.chipCount}>{counts[activity]}</span>
              </button>
            );
          })}
        </div>

        <div className={`${styles.mapShell} fade-up`}>
          <MapPreviewInner activeFilter={activeFilter} />
          <div className={styles.mapHint}>
            {activeFilter ? `${visibleCount} ${activeFilter} gym${visibleCount === 1 ? "" : "s"}` : `${MIAMI_GYMS.length} sample gyms`} · Miami
          </div>
        </div>
      </div>
    </section>
  );
}
