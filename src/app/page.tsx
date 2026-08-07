"use client";

import { useEffect } from "react";
import {
  Airplane,
  Compass,
  ListBullets,
  MapPin,
  Sparkle,
  Stamp,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import Image from "next/image";
import { APP_STORE_URL } from "@/lib/app-store";
import { AFFILIATE_DISCOUNT_USD } from "@/lib/affiliate";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Globe from "@/components/Globe";
import CardTopo from "@/components/CardTopo";
import HeroTopo from "@/components/HeroTopo";
import PhoneCarousel from "@/components/ui/phone-carousel";
import { GlowCard } from "@/components/ui/spotlight-card";
import styles from "./page.module.css";

/** The three things a creator wants to know before applying.
 *  Deliberately NO commission rate here: exact percentages are commercial
 *  terms, shared with a creator once they're approved, not published to
 *  anyone browsing the site (or to competitors). */
const CREATOR_HIGHLIGHTS = [
  { value: "Tiered", label: "Rates climb as you refer more" },
  { value: "Recurring", label: "Paid on renewals, not just signup" },
  { value: "Free Pro", label: "On the house, once you're approved" },
];

/** Hero carousel — ordered for a natural product story:
 *  Discover the app → Browse map → Scan list → Ask Scout → Plan trip →
 *  Collect stamps. */
const HERO_SCREENS = [
  { src: "/app-screens/discover.png", alt: "GymRoam Discover screen — Hi GymRoam home with Ask Scout card and Trending Near You" },
  { src: "/app-screens/map.png", alt: "GymRoam Map screen — Miami gyms with category filters and yellow location pins" },
  { src: "/app-screens/list.png", alt: "GymRoam Trending Near You list — gym cards with directions buttons" },
  { src: "/app-screens/scout.png", alt: "GymRoam Scout AI travel guide — ask about gyms in any city" },
  { src: "/app-screens/trips.png", alt: "GymRoam Trips dossier — plan gym workouts around a trip itinerary" },
  { src: "/app-screens/passport.png", alt: "GymRoam Passport — roamer profile with collected city stamps" },
];

interface Feature {
  icon: PhosphorIcon;
  /** Path to the screenshot in /public/app-screens/. */
  screen: string;
  /** Alt text + secondary header label for the screen. */
  screenLabel: string;
  title: string;
  desc: string;
}

/** Six product screens, ordered as the user would naturally experience
 *  them: Discover (home) → Map (browse) → List (trending) →
 *  Scout (AI) → Trips (planning) → Passport (collecting). */
const FEATURES: Feature[] = [
  {
    icon: Compass,
    screen: "/app-screens/discover.png",
    screenLabel: "Discover",
    title: "Your daily home base",
    desc: "Open GymRoam and see what's near you — trending picks, run clubs this week, and Scout one tap away.",
  },
  {
    icon: MapPin,
    screen: "/app-screens/map.png",
    screenLabel: "Map",
    title: "Search any city",
    desc: "Every gym, studio, and wellness center on a single map. Filter by activity, tap a pin for details.",
  },
  {
    icon: ListBullets,
    screen: "/app-screens/list.png",
    screenLabel: "Trending",
    title: "All your options, one tap away",
    desc: "Trending gyms with ratings, distance, and one-tap directions. The list adapts to wherever you land.",
  },
  {
    icon: Sparkle,
    screen: "/app-screens/scout.png",
    screenLabel: "Scout",
    title: "Ask Scout, your AI travel guide",
    desc: "Drop a city, neighborhood, or hotel and Scout finds your gyms. Ask anything about how GymRoam works.",
  },
  {
    icon: Airplane,
    screen: "/app-screens/trips.png",
    screenLabel: "Trips",
    title: "Plan workouts around your trip",
    desc: "Pin your stay, light up nearby gyms, and build a trip dossier of where you'll train each day.",
  },
  {
    icon: Stamp,
    screen: "/app-screens/passport.png",
    screenLabel: "Passport",
    title: "Collect stamps as you go",
    desc: "Every gym you visit becomes a stamp. Track cities, countries, and continents — proof of every workout.",
  },
];

export default function Home() {
  // fade-up animation observer. Was previously co-located with the
  // waitlist localStorage hydration; now standalone since the waitlist
  // is gone.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("visible");
        });
      },
      { threshold: 0.15 }
    );
    document.querySelectorAll(".fade-up").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <Nav />
      <section className={styles.hero} id="top">
        <HeroTopo />
        <div className={styles.heroInner}>
          <div className={`${styles.heroText} fade-up`}>
            <div className={styles.badge}>
              <span className={styles.badgeDot} />
              Now on iOS
            </div>
            <h1>Find Your Sweat.<br /><span className={styles.accent}>Anywhere.</span></h1>
            <p>Search any city. Get directions.<br className={styles.mobileBreak} /> Never miss a workout.</p>
            {/* Primary CTA stack — official Apple App Store badge + the
                in-site "preview the app experience" secondary link. The
                previous email-collection waitlist form was removed
                once the app shipped on the App Store. */}
            <div className={styles.ctaRow}>
              <a
                href={APP_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.appStoreBadgeHero}
                aria-label="Download GymRoam on the App Store"
              >
                <Image
                  src="/app-store-badge.svg"
                  alt="Download on the App Store"
                  width={180}
                  height={60}
                  priority
                />
              </a>
              <a href="/search" className={styles.previewLink}>
                Or preview the app experience &rarr;
              </a>
            </div>
          </div>
          <div className={`${styles.heroPhones} fade-up`}>
            <div className={styles.phoneGlow} />
            <PhoneCarousel items={HERO_SCREENS} />
          </div>
        </div>
      </section>

      <div className={styles.divider} />

      <section className={styles.features} id="features">
        <div className={styles.featuresGrid}>
          {FEATURES.map(({ icon: Icon, screen, screenLabel, title, desc }) => (
            <GlowCard key={screen} className={`${styles.featureCard} fade-up`}>
              {/* Subtle topo backdrop inside each card. Stacks below the
                  content via z-index defined in page.module.css. */}
              <CardTopo />
              {/* Mini phone-frame mockup of the actual app screen, cropped
                  to the top so the card stays compact. The peek gradient
                  fades the bottom into the card surface. */}
              <div className={styles.featurePhone}>
                <Image
                  src={screen}
                  alt={`GymRoam ${screenLabel} screen`}
                  fill
                  sizes="220px"
                  style={{ objectFit: "cover", objectPosition: "top" }}
                />
                <span className={styles.featurePhonePeek} aria-hidden="true" />
              </div>
              <div className={styles.featureBody}>
                <div className={styles.featureLabelRow}>
                  <span className={styles.featureIcon}>
                    <Icon size={18} weight="regular" />
                  </span>
                  <span className={styles.featureLabel}>{screenLabel}</span>
                </div>
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
            </GlowCard>
          ))}
        </div>
      </section>

      <Globe />

      {/* CREATOR PROGRAM — recruitment band.
          Sits after the Globe so the page closes on a "you could be part
          of this" note rather than another product feature. Deliberately
          one screen tall and text-first: it's a qualifying filter, not a
          pitch, and the real detail lives on /affiliates. */}
      <section className={styles.creator} id="creators">
        <CardTopo />
        <div className={styles.creatorInner}>
          <span className={styles.creatorTag}>Creator Program</span>
          <h2>
            Got an audience that trains?{" "}
            <span className={styles.accent}>Get paid for it.</span>
          </h2>
          <p>
            Share GymRoam, your followers get {AFFILIATE_DISCOUNT_USD} dollars
            off annual Pro, and you earn recurring commission for as long as
            they stay subscribed.
          </p>

          <div className={styles.creatorStats}>
            {CREATOR_HIGHLIGHTS.map(({ value, label }) => (
              <div key={label} className={styles.creatorStat}>
                <span className={styles.creatorStatValue}>{value}</span>
                <span className={styles.creatorStatLabel}>{label}</span>
              </div>
            ))}
          </div>

          <div className={styles.creatorCtaRow}>
            <a href="/affiliates" className={styles.creatorCta}>
              Apply to the program
            </a>
            <a href="/creator" className={styles.creatorSignIn}>
              Already a creator? Sign in &rarr;
            </a>
          </div>

          <p className={styles.creatorNote}>
            Applications are reviewed by hand. We approve creators, not
            coupon sites.
          </p>
        </div>
      </section>

      <Footer />
    </>
  );
}
