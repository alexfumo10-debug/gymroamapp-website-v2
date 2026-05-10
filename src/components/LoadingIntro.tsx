"use client";

/**
 * Hubtown-inspired entrance loader. 0% → 100% progress bar with the
 * GYMROAM wordmark. Shows once per session (localStorage flag) so
 * returning visitors never see it slow them down.
 *
 * Total duration ~1.8s (fill) + 0.4s (fade out) = ~2.2s.
 */

import { useEffect, useState } from "react";
import styles from "./LoadingIntro.module.css";

const SESSION_KEY = "gr_intro_seen_v1";
const FILL_MS = 1800;
const FADE_MS = 400;

export default function LoadingIntro() {
  const [show, setShow] = useState(false);
  const [pct, setPct] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(SESSION_KEY)) return;

    setShow(true);
    document.documentElement.style.overflow = "hidden";

    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const t = Math.min((now - start) / FILL_MS, 1);
      // ease-out cubic — fast first, slow finish (feels intentional)
      const eased = 1 - Math.pow(1 - t, 3);
      setPct(Math.round(eased * 100));
      if (t < 1) frame = requestAnimationFrame(tick);
      else {
        setFading(true);
        sessionStorage.setItem(SESSION_KEY, "1");
        setTimeout(() => {
          setShow(false);
          document.documentElement.style.overflow = "";
        }, FADE_MS);
      }
    });

    return () => {
      cancelAnimationFrame(frame);
      document.documentElement.style.overflow = "";
    };
  }, []);

  if (!show) return null;

  return (
    <div
      className={`${styles.intro} ${fading ? styles.introFading : ""}`}
      aria-hidden="true"
    >
      <div className={styles.inner}>
        <div className={styles.wordmark}>
          GYM<span className={styles.dot}>·</span>ROAM
        </div>
        <div className={styles.tag}>Travel-fitness, anywhere</div>
        <div className={styles.barTrack}>
          <div
            className={styles.barFill}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className={styles.pct}>
          <span>{String(pct).padStart(3, "0")}</span>
          <span className={styles.pctSuffix}>%</span>
        </div>
      </div>
      <div className={styles.cornerTop}>GR · 2026</div>
      <div className={styles.cornerBottom}>Loading destinations</div>
    </div>
  );
}
