"use client";

import { useEffect, useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import emailjs from "@emailjs/browser";
import { db } from "@/lib/firebase";
import { EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY } from "@/lib/emailjs";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Toast from "@/components/Toast";
import Globe from "@/components/Globe";
import Image from "next/image";
import styles from "./page.module.css";

const FEATURES = [
  { num: "01", title: "Search any city", desc: "Type a city name or let GPS do the work. Gyms, studios, and wellness centers populate automatically within your radius." },
  { num: "02", title: "Contact info at a glance", desc: "See phone numbers, websites, and addresses. Call the gym or get directions with one tap." },
  { num: "03", title: "Filter by what you do", desc: "Lifting, yoga, pilates, cycling, CrossFit, run clubs, HIIT, wellness. Find exactly what fits your routine." },
  { num: "04", title: "Save and compare", desc: "Shortlist gyms, mark the ones you've visited, and let AI rank your options based on how you train." },
  { num: "05", title: "Train with friends", desc: "See where your friends work out across the world. Like their activity. Track your own cities and achievements." },
];

const TRAINER_POINTS = [
  "Post promotions and drop-in offers",
  "Share your class schedule and pricing",
  "Public profile with bio, photos, and Instagram",
  "Receive and respond to messages from interested clients",
];

const GROW_CARDS = [
  { title: "Get listed", desc: "Your gym shows up for every traveler searching nearby" },
  { title: "Showcase", desc: "Photos, schedule, and pricing right in the app" },
  { title: "Connect", desc: "Receive messages from travelers looking for drop-ins" },
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
      <section className={styles.hero} id="top">
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
                  <input type="email" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleJoin()} />
                  <button onClick={handleJoin} disabled={loading}>{loading ? "Joining..." : "Join the Waitlist"}</button>
                </div>
                <p className={styles.note}>Be the first to know when GymRoam launches. No spam.</p>
              </div>
            ) : (
              <div className={styles.success}>
                <div className={styles.successCheck}>&#10003;</div>
                <div>
                  <div className={styles.successTitle}>You&apos;re on the list</div>
                  <div className={styles.successSub}>We&apos;ll email you when GymRoam launches.</div>
                </div>
              </div>
            )}
          </div>
          <div className={`${styles.heroPhones} fade-up`}>
            <div className={styles.phoneGlow} />
            <div className={`${styles.phone} ${styles.phone3}`}>
              <Image src="/screen-list.png" alt="GymRoam gym list" fill sizes="240px" style={{ objectFit: "cover" }} />
            </div>
            <div className={`${styles.phone} ${styles.phone1}`}>
              <Image src="/screen-map.png" alt="GymRoam map view" fill sizes="240px" style={{ objectFit: "cover" }} />
            </div>
            <div className={`${styles.phone} ${styles.phone2}`}>
              <Image src="/screen-discover.png" alt="GymRoam discover" fill sizes="240px" style={{ objectFit: "cover" }} />
            </div>
          </div>
        </div>
      </section>

      <div className={styles.divider} />

      <section className={styles.features} id="features">
        <div className={styles.featuresList}>
          {FEATURES.map((f) => (
            <div key={f.num} className={`${styles.featureRow} fade-up`}>
              <span className={styles.featureNum}>{f.num}</span>
              <div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <Globe />

      <div className={styles.divider} />

      <section className={styles.trainers} id="trainers">
        <div className={styles.trainersInner}>
          <h2 className="fade-up">For trainers and coaches</h2>
          <p className="fade-up">Get discovered by travelers visiting your city.</p>
          <div className={`${styles.trainerPoints} fade-up`}>
            {TRAINER_POINTS.map((point) => (
              <div key={point} className={styles.trainerPoint}>
                <div className={styles.check}>&#10003;</div>
                <span>{point}</span>
              </div>
            ))}
          </div>
          <a href="/trainer" className={styles.btn}>Apply now</a>
          <p className={styles.priceLine}>Trainer Pro $24.99/month &middot; billed through Apple</p>
        </div>
      </section>

      <section className={styles.growCta} id="grow">
        <div className={`${styles.growInner} fade-up`}>
          <div className={styles.growTag}>For Gym Owners</div>
          <h2>Grow your gym with<br /><span className={styles.accent}>GymRoam</span></h2>
          <p>Get your gym in front of thousands of traveling fitness enthusiasts. List your space, attract drop-in visitors, and fill empty class spots.</p>
          <div className={styles.growGrid}>
            {GROW_CARDS.map((card) => (
              <div key={card.title} className={styles.growCard}>
                <h4>{card.title}</h4>
                <p>{card.desc}</p>
              </div>
            ))}
          </div>
          <a href="/grow" className={styles.btnOutline}>Apply now</a>
          <p className={styles.priceLine}>Gym Partner $99/month &middot; cancel anytime</p>
        </div>
      </section>

      <Footer />
      <Toast message={toast.message} show={toast.show} onHide={() => setToast({ ...toast, show: false })} />
    </>
  );
}
