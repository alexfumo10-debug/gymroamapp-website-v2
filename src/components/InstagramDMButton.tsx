"use client";

/**
 * Hubtown-inspired floating "Chat with us" button — adapted for
 * GymRoam's brand. Bottom-right, yellow circular, IG icon, pulsing
 * dot, hover-expanding label. Tap → opens @gymroamapp DMs.
 */

import { useState } from "react";
import styles from "./InstagramDMButton.module.css";

export default function InstagramDMButton() {
  const [hovered, setHovered] = useState(false);

  return (
    <a
      href="https://instagram.com/gymroamapp"
      target="_blank"
      rel="noopener noreferrer"
      className={styles.fab}
      aria-label="Message GymRoam on Instagram"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span
        className={`${styles.label} ${hovered ? styles.labelOpen : ""}`}
      >
        DM us @gymroamapp
      </span>
      <span className={styles.icon}>
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
          <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
        </svg>
        <span className={styles.dot} />
      </span>
    </a>
  );
}
