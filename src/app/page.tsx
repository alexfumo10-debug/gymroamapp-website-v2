"use client";

import { useEffect, useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import emailjs from "@emailjs/browser";
import {
  Airplane,
  Check,
  Compass,
  ListBullets,
  MapPin,
  Sparkle,
  Stamp,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import Image from "next/image";
import { db } from "@/lib/firebase";
import { EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY } from "@/lib/emailjs";
import { LIQUID_GLASS_DISPLACEMENT_MAP } from "@/lib/liquid-glass-map";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Toast from "@/components/Toast";
import Globe from "@/components/Globe";
import CardTopo from "@/components/CardTopo";
import HeroTopo from "@/components/HeroTopo";
import PhoneCarousel from "@/components/ui/phone-carousel";
import { GlowCard } from "@/components/ui/spotlight-card";
import styles from "./page.module.css";

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

const USER_TYPES = ["Gym Goer", "Trainer", "Gym Owner", "Influencer"];

export default function Home() {
  const [selectedType, setSelectedType] = useState("Gym Goer");
  const [email, setEmail] = useState("");
  const [joined, setJoined] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "" });

  useEffect(() => {
    if (localStorage.getItem("gymroam_waitlist_joined") === "true") {
      setJoined(true);
    }

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

  const handleJoin = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setToast({ show: true, message: "Please enter a valid email" });
      return;
    }
    setLoading(true);
    try {
      await addDoc(collection(db, "waitlist"), {
        email: email.trim().toLowerCase(),
        type: selectedType,
        source: "website",
        createdAt: serverTimestamp(),
      });
      try {
        await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, { to_email: email.trim().toLowerCase() }, EMAILJS_PUBLIC_KEY);
      } catch { /* skip */ }
      localStorage.setItem("gymroam_waitlist_joined", "true");
      setJoined(true);
    } catch {
      setToast({ show: true, message: "Something went wrong. Try again." });
    }
    setLoading(false);
  };

  return (
    <>
      <Nav />
      {/* Liquid glass SVG filter — referenced by the waitlist email
          tile's backdrop-filter. Defined once for the whole page.
          primitiveUnits="objectBoundingBox" lets the 1x1 displacement
          map stretch to any element size without JS calculation. */}
      <svg
        aria-hidden="true"
        style={{ position: "absolute", width: 0, height: 0, overflow: "hidden", pointerEvents: "none" }}
      >
        <filter id="liquid-glass-waitlist" primitiveUnits="objectBoundingBox">
          <feImage
            result="map"
            width="100%"
            height="100%"
            x="0"
            y="0"
            href={LIQUID_GLASS_DISPLACEMENT_MAP}
            preserveAspectRatio="none"
          />
          <feGaussianBlur in="SourceGraphic" stdDeviation="0.01" result="blur" />
          {/* Low displacement scale — refraction reads as a faint warp,
              not a fishbowl. Higher values look cartoonish on a wide
              input tile. */}
          <feDisplacementMap
            in="blur"
            in2="map"
            scale="0.12"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </svg>
      <section className={styles.hero} id="top">
        <HeroTopo />
        <div className={styles.heroInner}>
          <div className={`${styles.heroText} fade-up`}>
            <div className={styles.badge}>
              <span className={styles.badgeDot} />
              Coming Soon to iOS
            </div>
            <h1>Find Your Sweat.<br /><span className={styles.accent}>Anywhere.</span></h1>
            <p>Search any city. Get directions. Never miss a workout.</p>
            {!joined ? (
              <div className={styles.waitlist}>
                <div className={styles.typeRow}>
                  {USER_TYPES.map((type) => (
                    <button key={type} className={`${styles.typeBtn} ${selectedType === type ? styles.active : ""}`} onClick={() => setSelectedType(type)}>{type}</button>
                  ))}
                </div>
                <div className={styles.inputRow}>
                  {/* Empty "lens" layer — carries the backdrop-filter +
                      box-shadow stack. Must stay completely empty so
                      Chrome's backdrop-filter only samples the page
                      behind the tile (no text-ghosting). Lives behind
                      the input/button via z-index. */}
                  <span
                    className={styles.inputRowLens}
                    aria-hidden="true"
                    style={{
                      backdropFilter: "blur(14px) url(#liquid-glass-waitlist) saturate(140%)",
                      WebkitBackdropFilter: "blur(14px) saturate(140%)",
                    }}
                  />
                  <input type="email" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleJoin()} />
                  <button onClick={handleJoin} disabled={loading}>{loading ? "Joining..." : "Join the Waitlist"}</button>
                </div>
                <p className={styles.note}>Be the first to know when GymRoam launches. No spam.</p>
                <a href="/search" className={styles.previewLink}>
                  Or preview the app experience &rarr;
                </a>
              </div>
            ) : (
              <div className={styles.success}>
                <div className={styles.successCheck}>
                  <Check size={18} weight="bold" />
                </div>
                <div>
                  <div className={styles.successTitle}>You&apos;re on the list</div>
                  <div className={styles.successSub}>We&apos;ll email you when GymRoam launches.</div>
                </div>
              </div>
            )}
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

      <Footer />
      <Toast message={toast.message} show={toast.show} onHide={() => setToast({ ...toast, show: false })} />
    </>
  );
}
