"use client";

/**
 * LoadingIntro v2 — Hubtown-inspired entrance loader, refined.
 *
 * Structure:
 *   [corner top-left:    GR/0001 · 2026]   [top-right: REC + date]
 *   (top hairline)
 *
 *                       GYM [▪] ROAM       ← wordmark with brand-mark dot
 *                  INDEXING DESTINATIONS   ← micro-caps mono tag
 *                  ▓▓▓▓▓▓▓▓░░░░░░         ← progress bar (1px)
 *                       068%               ← big counter
 *                       MIAMI              ← cycling city ticker
 *
 *   (bottom hairline)
 *   [corner bottom-left: © LEVE AI]        [bottom-right: INDEX/0.1.0]
 *                                          [Press ESC to skip]
 *
 * Behavior:
 *  - Once per browser session via sessionStorage flag
 *  - Locks body scroll while shown
 *  - Click anywhere OR press Esc to skip
 *  - Wordmark fades in from blur (200ms), then bar fills (1.8s,
 *    ease-out cubic), then everything lifts 12px and fades (450ms)
 *  - City ticker cycles ~6 cities during the fill duration
 */

import { useEffect, useRef, useState } from "react";
import styles from "./LoadingIntro.module.css";

const SESSION_KEY = "gr_intro_seen_v2";
const ENTRANCE_MS = 250;
const FILL_MS = 1800;
const FADE_MS = 450;

const CITIES = [
  "MIAMI",
  "ATLANTA",
  "TOKYO",
  "BERLIN",
  "LISBON",
  "BALI",
  "SEOUL",
  "CAPE TOWN",
];

function todayStamp(): string {
  // YYYY.MM.DD with leading zeros — used in the REC corner
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd}`;
}

export default function LoadingIntro() {
  const [show, setShow] = useState(false);
  const [pct, setPct] = useState(0);
  const [phase, setPhase] = useState<"entering" | "running" | "fading">(
    "entering"
  );
  const [cityIdx, setCityIdx] = useState(0);
  const stamp = useRef<string>(todayStamp());
  const skipped = useRef<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(SESSION_KEY)) return;

    setShow(true);
    document.documentElement.style.overflow = "hidden";

    // Skip handlers — Esc key or click anywhere
    const skip = () => {
      if (skipped.current) return;
      skipped.current = true;
      setPct(100);
      setPhase("fading");
      sessionStorage.setItem(SESSION_KEY, "1");
      setTimeout(() => {
        setShow(false);
        document.documentElement.style.overflow = "";
      }, FADE_MS);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") skip();
    };
    window.addEventListener("keydown", onKey);

    // Entrance phase — wordmark fades in from blur, then bar starts
    const entranceTimer = setTimeout(() => {
      setPhase("running");
    }, ENTRANCE_MS);

    // Bar fill driven by RAF, easing-out cubic
    const start = performance.now() + ENTRANCE_MS;
    let frame = 0;
    const tick = (now: number) => {
      if (skipped.current) return;
      const elapsed = now - start;
      if (elapsed < 0) {
        frame = requestAnimationFrame(tick);
        return;
      }
      const t = Math.min(elapsed / FILL_MS, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setPct(Math.round(eased * 100));

      // Cycle city based on progress (ratio across all cities)
      const idx = Math.min(
        Math.floor(eased * CITIES.length),
        CITIES.length - 1
      );
      setCityIdx(idx);

      if (t < 1) frame = requestAnimationFrame(tick);
      else {
        setPhase("fading");
        sessionStorage.setItem(SESSION_KEY, "1");
        setTimeout(() => {
          setShow(false);
          document.documentElement.style.overflow = "";
        }, FADE_MS);
      }
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(entranceTimer);
      window.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
    };
  }, []);

  if (!show) return null;

  return (
    <div
      className={`${styles.intro} ${
        phase === "entering"
          ? styles.entering
          : phase === "fading"
          ? styles.fading
          : ""
      }`}
      aria-hidden="true"
      onClick={() => {
        if (skipped.current) return;
        skipped.current = true;
        setPct(100);
        setPhase("fading");
        sessionStorage.setItem(SESSION_KEY, "1");
        setTimeout(() => {
          setShow(false);
          document.documentElement.style.overflow = "";
        }, FADE_MS);
      }}
    >
      {/* Top hairline + corner labels */}
      <div className={styles.frameTop} />
      <div className={styles.cornerTL}>GR/0001 &middot; 2026</div>
      <div className={styles.cornerTR}>
        <span className={styles.recDot} />
        REC &nbsp;·&nbsp; {stamp.current}
      </div>

      {/* Centerpiece */}
      <div className={styles.center}>
        <div className={styles.wordmark}>
          <span>GYM</span>
          <span className={styles.brandDot} aria-hidden="true" />
          <span>ROAM</span>
        </div>

        <div className={styles.tagline}>INDEXING DESTINATIONS</div>

        <div className={styles.barTrack}>
          <div className={styles.barFill} style={{ width: `${pct}%` }} />
        </div>

        <div className={styles.counter}>
          <span className={styles.counterNum}>
            {String(pct).padStart(3, "0")}
          </span>
          <span className={styles.counterPct}>%</span>
        </div>

        {/* City ticker — cycles via key change which retriggers the
            in-animation each step. */}
        <div className={styles.tickerRow}>
          <span className={styles.tickerCaret}>▸</span>
          <span key={cityIdx} className={styles.tickerCity}>
            {CITIES[cityIdx]}
          </span>
        </div>
      </div>

      {/* Bottom hairline + corner labels */}
      <div className={styles.frameBottom} />
      <div className={styles.cornerBL}>© LEVE AI STUDIOS LLC</div>
      <div className={styles.cornerBR}>
        INDEX/0.1.0
        <span className={styles.skipHint}>Press ESC to skip</span>
      </div>
    </div>
  );
}
