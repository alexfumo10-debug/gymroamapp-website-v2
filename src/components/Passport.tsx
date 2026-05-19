"use client";

/**
 * Passport feature showcase — editorial / document aesthetic.
 *
 * Cream-on-black, Fraunces serif for emotional moments, JetBrains Mono
 * for chrome (passport № / MRZ / dates). One iPhone mockup as the hero,
 * one purposeful animation: the latest stamp materializes with rotation
 * + an ink-impression effect when the section scrolls into view.
 */

import { useEffect, useRef, useState } from "react";
import { CellSignalFull } from "@phosphor-icons/react/dist/ssr";
import styles from "./Passport.module.css";

export default function Passport() {
  const sectionRef = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);
  const [stampCount, setStampCount] = useState(0);
  const [cityCount, setCityCount] = useState(0);
  const [countryCount, setCountryCount] = useState(0);

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
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!inView) return;
    const duration = 1800;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setStampCount(Math.round(eased * 47));
      setCityCount(Math.round(eased * 12));
      setCountryCount(Math.round(eased * 5));
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

      {/* Editorial header */}
      <div className={styles.pageHeader}>
        <div className={styles.kicker}>GymRoam · Passport</div>
        <h2>
          Document, <em>not dashboard.</em>
        </h2>
        <p>
          Every gym you train at becomes a stamp. Every city, a page.
          Every year wraps into a shareable. Cream on black, serif moments,
          real passport chrome — built to feel issued, not generated.
        </p>
      </div>

      <div className={styles.sectionDivider}>
        <span className={styles.dividerNum}>I.</span>
        <span className={styles.dividerTitle}>The Passport</span>
        <span className={styles.dividerRule} />
      </div>

      {/* iPhone mockup — single hero */}
      <div className={styles.frameWrapper}>
        <div className={styles.frameLabel}>In rotation — 47 stamps in 12 cities</div>
        <div className={styles.iphone}>
          <div className={styles.notch} />
          <div className={styles.statusBar}>
            <span>9:41</span>
            <div className={styles.statusIcons}>
              <CellSignalFull size={14} weight="fill" />
              <span style={{ fontSize: 11 }}>100%</span>
            </div>
          </div>

          <div className={styles.screen}>
            {/* Document header */}
            <div className={styles.docHeader}>
              <div className={styles.idRow}>
                <span className={styles.seal}>PASSPORT · GR</span>
                <span className={styles.passportNum}>№ 0114-2026</span>
              </div>
              <h1>
                Issued to a <span className={styles.accent}><em>roamer</em></span>
              </h1>
              <div className={styles.metaLine}>
                <div className={styles.metaItem}>
                  <span className={styles.metaV}>Jul · 2025</span>
                  <span className={styles.metaL}>Issued</span>
                </div>
                <span className={styles.metaSep} />
                <div className={styles.metaItem}>
                  <span className={styles.metaV}>Frequent</span>
                  <span className={styles.metaL}>Class</span>
                </div>
                <span className={styles.metaSep} />
                <div className={styles.metaItem}>
                  <span className={styles.metaV}>5 / 7</span>
                  <span className={styles.metaL}>Continents</span>
                </div>
              </div>
            </div>
            <div className={styles.rule} />

            {/* Totals */}
            <div className={styles.totals}>
              <div className={styles.totalsCol}>
                <div className={styles.totalsNum}>{stampCount}</div>
                <div className={styles.totalsLabel}>Gyms</div>
              </div>
              <div className={styles.totalsCol}>
                <div className={styles.totalsNum}>{cityCount}</div>
                <div className={styles.totalsLabel}>Cities</div>
              </div>
              <div className={styles.totalsCol}>
                <div className={styles.totalsNum}>{countryCount}</div>
                <div className={styles.totalsLabel}>Countries</div>
              </div>
            </div>
            <div className={styles.rule} />

            {/* Hero stamp — animates in */}
            <div className={styles.heroWrap}>
              <div className={styles.heroLabel}>
                <span>Latest Stamp</span>
                <span className={styles.heroLabelRight}>12 · 04 · 2026</span>
              </div>
              <div className={styles.heroStamp}>
                <div className={styles.heroTop}>
                  <div>
                    <div className={styles.heroCity}>Miami</div>
                    <div className={styles.heroCountry}>USA · MIA</div>
                  </div>
                  <div className={styles.heroSealMark}>
                    GR<br />SEAL
                  </div>
                </div>
                <div className={styles.heroGym}>Anatomy Miami Beach — Lifting</div>
                <div className={styles.heroBottom}>
                  <span>STAMP № 047</span>
                  <span>STAY 2H 14M</span>
                </div>
              </div>
            </div>

            {/* Older stamps row */}
            <div className={styles.heroWrap} style={{ paddingTop: 0 }}>
              <div className={styles.heroLabel}>
                <span>Earlier This Month</span>
                <span className={styles.heroLabelRight}>04 · 2026</span>
              </div>
            </div>
            <div className={styles.stampsRow}>
              <div className={`${styles.stamp} ${styles.stampOld} ${styles.r2}`}>
                <div>
                  <div className={styles.stampCity}>Bangkok</div>
                  <div className={styles.stampCountry}>THA · BKK</div>
                  <div className={styles.stampGym}>Fitness 1st Asoke</div>
                </div>
                <div className={styles.stampDate}>28 · 03 · 2026</div>
              </div>
              <div className={`${styles.stamp} ${styles.stampOld} ${styles.r3}`}>
                <div>
                  <div className={styles.stampCity}>Seoul</div>
                  <div className={styles.stampCountry}>KOR · ICN</div>
                  <div className={styles.stampGym}>Heat Yoga Itaewon</div>
                </div>
                <div className={styles.stampDate}>15 · 03 · 2026</div>
              </div>
              <div className={`${styles.stamp} ${styles.stampOld} ${styles.r4}`}>
                <div>
                  <div className={styles.stampCity}>Tokyo</div>
                  <div className={styles.stampCountry}>JPN · NRT</div>
                  <div className={styles.stampGym}>Gold&apos;s Gym Shibuya</div>
                </div>
                <div className={styles.stampDate}>02 · 03 · 2026</div>
              </div>
              <div className={`${styles.stamp} ${styles.stampOld} ${styles.r5}`}>
                <div>
                  <div className={styles.stampCity}>Lisbon</div>
                  <div className={styles.stampCountry}>PRT · LIS</div>
                  <div className={styles.stampGym}>CrossFit Belém</div>
                </div>
                <div className={styles.stampDate}>14 · 02 · 2026</div>
              </div>
            </div>

            {/* Curator note */}
            <div className={styles.curatorNote}>
              <div className={styles.curatorLabel}>Note from the desk</div>
              <div className={styles.curatorBody}>
                &ldquo;One country away from a fifth continent.{" "}
                <strong>Africa is open.</strong>&rdquo;
              </div>
            </div>

            {/* MRZ footer */}
            <div className={styles.mrz}>
              <div className={styles.mrzLine}>
                P&lt;USAROAMER&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;
              </div>
              <div className={styles.mrzLine}>
                A0114202612USA0008300047&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;
              </div>
            </div>
          </div>

          {/* Phone bezel reflection */}
          <div className={styles.iphoneGloss} />
        </div>
      </div>
    </section>
  );
}
