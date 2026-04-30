"use client";

import dynamic from "next/dynamic";
import styles from "./MapPreview.module.css";

// Leaflet imports `window` at module load — defer to client only.
const MapPreviewInner = dynamic(() => import("./MapPreviewInner"), {
  ssr: false,
  loading: () => <div className={styles.mapLoading}>Loading map…</div>,
});

export default function MapPreview() {
  return (
    <section className={styles.section} id="map-preview">
      <div className={styles.inner}>
        <div className={styles.headerRow}>
          <div className={styles.tag}>Live preview</div>
          <h2 className="fade-up">See what&apos;s nearby in Miami</h2>
          <p className="fade-up">
            A taste of what you&apos;ll see when you open GymRoam.
            Tap a pin to explore.
          </p>
        </div>

        <div className={`${styles.mapShell} fade-up`}>
          <MapPreviewInner />
          <div className={styles.mapHint}>10 sample gyms · Miami</div>
        </div>
      </div>
    </section>
  );
}
