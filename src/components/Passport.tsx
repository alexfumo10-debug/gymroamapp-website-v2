"use client";

/**
 * Passport feature showcase. Marketing section on the homepage that
 * teases the upcoming Passport feature: every gym you train at becomes
 * a stamp; end of year, you get a shareable.
 *
 * Three share formats showcased: Year in Roam, Trip Recap, Milestone
 * Stamp — all 1080×1080.
 *
 * Animation strategy:
 *   - IntersectionObserver triggers `.in-view` on the section once it's
 *     visible. CSS handles all the movement from there (no per-frame JS).
 *   - Stamps stagger-fade-in with a subtle rotate.
 *   - Counter (47 stamps) counts up from 0 once visible.
 *   - Share cards gently float forever.
 */

import { useEffect, useRef, useState } from "react";
import styles from "./Passport.module.css";

const STAMPS = [
  { num: "001", city: "Miami", date: "OCT 24, '26", flag: "🇺🇸" },
  { num: "002", city: "London", date: "NOV 03, '26", flag: "🇬🇧" },
  { num: "003", city: "Paris", date: "NOV 18, '26", flag: "🇫🇷" },
  { num: "004", city: "Tokyo", date: "DEC 02, '26", flag: "🇯🇵" },
  { num: "005", city: "Dubai", date: "DEC 14, '26", flag: "🇦🇪" },
  { num: "006", city: "Bali", date: "DEC 27, '26", flag: "🇮🇩" },
];

export default function Passport() {
  const sectionRef = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);
  const [stampCount, setStampCount] = useState(0);
  const [cityCount, setCityCount] = useState(0);
  const [continentCount, setContinentCount] = useState(0);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setInView(true);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.25 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Counter animation — 47 stamps · 12 cities · 5 continents.
  useEffect(() => {
    if (!inView) return;
    const duration = 1600;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setStampCount(Math.round(eased * 47));
      setCityCount(Math.round(eased * 12));
      setContinentCount(Math.round(eased * 5));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView]);

  return (
    <section
      ref={sectionRef}
      className={`${styles.section} ${inView ? styles.inView : ""}`}
      id="passport"
    >
      <div className={styles.grain} />

      <div className={styles.inner}>
        <div className={styles.headerRow}>
          <div className={styles.eyebrow}>
            <span className={styles.eyebrowDot} />
            Coming at launch
          </div>
          <h2>
            Every gym becomes a <span className={styles.italic}>stamp.</span>
          </h2>
          <p>
            Train in Tokyo. Stamp it. Train in Lisbon. Stamp it.
            End of year, you&apos;ve got a story worth sharing.
          </p>
        </div>

        <div className={styles.stage}>
          {/* Left: Passport book */}
          <div className={styles.passportWrap}>
            <div className={styles.passport}>
              <div className={styles.passportEdge} />

              <div className={styles.passportHeader}>
                <div className={styles.passportSeal}>
                  <div className={styles.sealOuter}>
                    <div className={styles.sealCenter}>GR</div>
                  </div>
                </div>
                <div className={styles.passportMeta}>
                  <div className={styles.passportLabel}>GymRoam Passport</div>
                  <div className={styles.passportNo}>№ 0114-2026</div>
                </div>
                <div className={styles.passportClass}>
                  <div className={styles.classLabel}>Class</div>
                  <div className={styles.classValue}>Frequent</div>
                </div>
              </div>

              <div className={styles.statsRow}>
                <div className={styles.stat}>
                  <div className={styles.statNum}>{stampCount}</div>
                  <div className={styles.statLabel}>Stamps</div>
                </div>
                <div className={styles.statDiv} />
                <div className={styles.stat}>
                  <div className={styles.statNum}>{cityCount}</div>
                  <div className={styles.statLabel}>Cities</div>
                </div>
                <div className={styles.statDiv} />
                <div className={styles.stat}>
                  <div className={styles.statNum}>{continentCount}</div>
                  <div className={styles.statLabel}>Continents</div>
                </div>
              </div>

              <div className={styles.stampsHeader}>
                <span>Recent stamps</span>
                <span className={styles.stampsCount}>2026 · 6 of {stampCount}</span>
              </div>

              <div className={styles.stampsGrid}>
                {STAMPS.map((s, i) => (
                  <div
                    key={s.num}
                    className={styles.stamp}
                    style={{ animationDelay: `${0.4 + i * 0.12}s` }}
                  >
                    <div className={styles.stampInner}>
                      <div className={styles.stampFlag}>{s.flag}</div>
                      <div className={styles.stampCity}>{s.city}</div>
                      <div className={styles.stampMeta}>
                        № {s.num} · {s.date}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className={styles.passportFooter}>
                <span className={styles.mrz}>
                  P&lt;USA&lt;ROAMER&lt;ALEX&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;
                </span>
              </div>
            </div>

            {/* Floating "new stamp earned" toast */}
            <div className={styles.newStampToast}>
              <div className={styles.toastDot} />
              <div className={styles.toastText}>
                <div className={styles.toastTitle}>New stamp earned</div>
                <div className={styles.toastSub}>Bali · № 006</div>
              </div>
            </div>
          </div>

          {/* Right: Share cards */}
          <div className={styles.cardsWrap}>
            <div className={styles.cardsHeader}>
              <div className={styles.cardsLabel}>Auto-generated shareables</div>
              <div className={styles.cardsHint}>Tap to share to Instagram</div>
            </div>

            <div className={styles.cards}>
              {/* Year in Roam — flagship */}
              <div className={`${styles.shareCard} ${styles.cardYear}`}>
                <div className={styles.cardEyebrow}>
                  <span className={styles.cardDot} /> Year in Roam · 2026
                </div>
                <div className={styles.cardHero}>
                  <div className={styles.cardHeroNumber}>47</div>
                  <div className={styles.cardHeroLabel}>stamps earned</div>
                </div>
                <div className={styles.cardSplit}>
                  <div>
                    <div className={styles.cardSplitNum}>12</div>
                    <div className={styles.cardSplitLabel}>cities</div>
                  </div>
                  <div>
                    <div className={styles.cardSplitNum}>5</div>
                    <div className={styles.cardSplitLabel}>continents</div>
                  </div>
                </div>
                <div className={styles.cardFooter}>@gymroamapp</div>
              </div>

              {/* Trip Recap */}
              <div className={`${styles.shareCard} ${styles.cardTrip}`}>
                <div className={styles.cardEyebrow}>
                  <span className={styles.cardDot} /> Trip Recap
                </div>
                <div className={styles.cardCity}>Tokyo</div>
                <div className={styles.cardSub}>
                  6 sessions · 4 gyms · 5 days
                </div>
                <div className={styles.cardSplit}>
                  <div>
                    <div className={styles.cardSplitNum}>3</div>
                    <div className={styles.cardSplitLabel}>lifting</div>
                  </div>
                  <div>
                    <div className={styles.cardSplitNum}>2</div>
                    <div className={styles.cardSplitLabel}>hyrox</div>
                  </div>
                  <div>
                    <div className={styles.cardSplitNum}>1</div>
                    <div className={styles.cardSplitLabel}>yoga</div>
                  </div>
                </div>
                <div className={styles.cardFooter}>Stamp № 042–047</div>
              </div>

              {/* Milestone Stamp */}
              <div className={`${styles.shareCard} ${styles.cardMilestone}`}>
                <div className={styles.cardEyebrow}>
                  <span className={styles.cardDot} /> Milestone
                </div>
                <div className={styles.cardMilestoneTag}>50<span>th</span></div>
                <div className={styles.cardSub}>gym stamped</div>
                <div className={styles.cardMilestoneCity}>
                  Bali · GR Athletic Co.
                </div>
                <div className={styles.cardFooter}>March 2027</div>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.featuresRow}>
          <div className={styles.feature}>
            <div className={styles.featureIcon}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z" />
              </svg>
            </div>
            <div>
              <div className={styles.featureTitle}>Auto-stamped</div>
              <div className={styles.featureDesc}>
                Every gym check-in becomes a stamp. No extra tapping.
              </div>
            </div>
          </div>
          <div className={styles.feature}>
            <div className={styles.featureIcon}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
              </svg>
            </div>
            <div>
              <div className={styles.featureTitle}>Anywhere</div>
              <div className={styles.featureDesc}>
                Train in any city. Every continent gets its own page.
              </div>
            </div>
          </div>
          <div className={styles.feature}>
            <div className={styles.featureIcon}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM12 17c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
              </svg>
            </div>
            <div>
              <div className={styles.featureTitle}>Yours forever</div>
              <div className={styles.featureDesc}>
                Your passport stays even if you stop using the app.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
