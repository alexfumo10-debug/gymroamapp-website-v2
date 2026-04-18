"use client";

import { useEffect, useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import emailjs from "@emailjs/browser";
import { db } from "@/lib/firebase";
import { EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY } from "@/lib/emailjs";
import Link from "next/link";
import Toast from "@/components/Toast";
import styles from "./page.module.css";

const USER_TYPES = ["Gym Goer", "Trainer", "Gym Owner", "Influencer"];
const FEATURES = ["Any City, Worldwide", "Reviews & Ratings", "Gyms, Yoga, Pilates & More"];

export default function JoinPage() {
  const [selectedType, setSelectedType] = useState("Gym Goer");
  const [email, setEmail] = useState("");
  const [joined, setJoined] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "" });

  useEffect(() => {
    if (localStorage.getItem("gymroam_waitlist_joined") === "true") setJoined(true);
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
        source: "instagram",
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
      <div className={styles.glow} />
      <main className={styles.main}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}>G</div>
          <span className={styles.logoText}>GYMROAM</span>
        </div>

        <div className={styles.badge}>
          <span className={styles.badgeDot} />
          Launching Soon
        </div>

        <h1 className={styles.heading}>Find Your Sweat.<br /><span className={styles.accent}>Anywhere.</span></h1>
        <p className={styles.tagline}>Search any city. Get directions. Never miss a workout when you travel.</p>

        {!joined ? (
          <div className={styles.waitlist}>
            <div className={styles.typeRow}>
              {USER_TYPES.map((type) => (
                <button key={type} className={`${styles.typeBtn} ${selectedType === type ? styles.active : ""}`} onClick={() => setSelectedType(type)}>{type}</button>
              ))}
            </div>
            <div className={styles.inputRow}>
              <input type="email" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleJoin()} />
              <button onClick={handleJoin} disabled={loading}>{loading ? "Joining..." : "Join Waitlist"}</button>
            </div>
            <p className={styles.note}>Be the first to know when GymRoam launches. No spam.</p>
          </div>
        ) : (
          <div className={styles.success}>
            <div className={styles.successCheck}>&#10003;</div>
            <div className={styles.successTitle}>You&apos;re on the list</div>
            <div className={styles.successSub}>
              We&apos;ll email you the moment GymRoam launches. Follow{" "}
              <a href="https://instagram.com/gymroamapp" target="_blank" rel="noopener noreferrer">@gymroamapp</a> for updates.
            </div>
          </div>
        )}

        <div className={styles.features}>
          {FEATURES.map((f) => (
            <div key={f} className={styles.feature}>
              <span className={styles.featureDot} />
              {f}
            </div>
          ))}
        </div>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerLinks}>
          <Link href="/">Home</Link>
          <a href="https://instagram.com/gymroamapp" target="_blank" rel="noopener noreferrer">Instagram</a>
          <a href="mailto:gymroamapp@gmail.com">Contact</a>
        </div>
        <span>&copy; 2026 GymRoam — A <a href="https://levestudios.com" target="_blank" rel="noopener noreferrer">Leve AI Studios</a> Company</span>
      </footer>

      <Toast message={toast.message} show={toast.show} onHide={() => setToast({ ...toast, show: false })} />
    </>
  );
}
