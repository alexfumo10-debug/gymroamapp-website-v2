"use client";

import { useState, useEffect, useRef } from "react";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Toast from "@/components/Toast";
import { db } from "@/lib/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import emailjs from "@emailjs/browser";
import {
  EMAILJS_SERVICE_ID,
  EMAILJS_CAREERS_TEMPLATE_ID,
  EMAILJS_PUBLIC_KEY,
} from "@/lib/emailjs";
import styles from "./page.module.css";

interface Role {
  id: string;
  title: string;
  pitch: string;
  duties: string[];
  requirements: string[];
  /** label shown on the application form when this role is selected */
  formLabel: string;
}

const ROLES: Role[] = [
  {
    id: "marketing-intern",
    title: "Marketing Intern",
    formLabel: "Marketing Intern",
    pitch: "Help build the audience that meets GymRoam at launch.",
    duties: [
      "Plan and ship Instagram content — Reels, carousels, stories",
      "Manage our community across DMs, comments, and replies",
      "Reach out to gyms, trainers, and creators for partnerships",
      "Write and send email campaigns to our growing waitlist",
      "Use AI tools (ChatGPT, Claude, etc.) to ship faster",
    ],
    requirements: [
      "Based in Miami or Atlanta (or visit often)",
      "Deep on Instagram, TikTok, or both",
      "Shipped your own content or run someone else's account",
      "Comfortable using AI tools for research, drafting, ideation",
      "Want to learn how a startup goes from 0 to 10K users",
    ],
  },
  {
    id: "videographer",
    title: "Videographer / Editor",
    formLabel: "Videographer / Editor",
    pitch: "Capture and cut the visual story of GymRoam — fitness on the road.",
    duties: [
      "Film on-location at gyms, run clubs, and wellness studios in your city",
      "Edit short-form content for Reels and TikTok — the kind that stops the scroll",
      "Build a b-roll library for partners and ad creatives",
      "Use AI tools (CapCut AI, ElevenLabs, Runway) to speed up production",
      "Collaborate with the marketing intern on launch-week assets",
    ],
    requirements: [
      "Have a reel of recent work — even messy, even iPhone-shot",
      "Own your own gear (camera or iPhone + gimbal, mic, editing software)",
      "Comfortable on-site and meeting strangers",
      "Use AI editing tools — or eager to learn them",
      "Based in Miami or Atlanta (or visit often)",
    ],
  },
];

export default function CareersPage() {
  const [selectedRole, setSelectedRole] = useState<string>("marketing-intern");
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    city: "",
    why: "",
    instagramHandle: "",
    portfolioLink: "",
    aiTools: "",
    startDate: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "" });
  const formRef = useRef<HTMLDivElement>(null);

  // Scroll-into-view helper for "Apply" buttons on role cards
  const scrollToForm = (roleId: string) => {
    setSelectedRole(roleId);
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  };

  // Hide-on-revisit if they already applied + wire fade-up observer
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("gymroam_careers_applied") === "true") {
      setSubmitted(true);
    }

    // .fade-up elements start at opacity 0; add .visible when they
    // scroll into view. Same pattern the homepage uses.
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

  const submit = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!form.fullName.trim()) {
      setToast({ show: true, message: "Please enter your full name" });
      return;
    }
    if (!emailRegex.test(form.email.trim())) {
      setToast({ show: true, message: "Please enter a valid email" });
      return;
    }
    if (!form.why.trim()) {
      setToast({ show: true, message: "Tell us why you want to join, even briefly" });
      return;
    }
    if (selectedRole === "videographer" && !form.portfolioLink.trim()) {
      setToast({ show: true, message: "Videographers need to share a reel or portfolio link" });
      return;
    }
    setSubmitting(true);
    try {
      const roleObj = ROLES.find((r) => r.id === selectedRole);
      await addDoc(collection(db, "careersApplications"), {
        status: "pending",
        roleId: selectedRole,
        roleTitle: roleObj?.formLabel || selectedRole,
        fullName: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        city: form.city.trim(),
        why: form.why.trim(),
        instagramHandle: form.instagramHandle.trim().replace(/^@/, ""),
        portfolioLink: form.portfolioLink.trim(),
        aiTools: form.aiTools.trim(),
        startDate: form.startDate.trim(),
        createdAt: serverTimestamp(),
      });

      /**
       * Email notification to gymroamapp@gmail.com via EmailJS.
       * Silent-fails so a flaky email service can't break the submit.
       *
       * Setup (one-time): create an EmailJS template that sends to
       * gymroamapp@gmail.com and uses these variable names — then
       * paste the new template ID into EMAILJS_CAREERS_TEMPLATE_ID
       * in src/lib/emailjs.ts.
       *
       * Variables used: applicant_name, applicant_email, role_title,
       *   city, start_date, instagram_handle, portfolio_link,
       *   ai_tools, why, to_email
       */
      try {
        if (
          EMAILJS_CAREERS_TEMPLATE_ID &&
          !EMAILJS_CAREERS_TEMPLATE_ID.includes("REPLACE_ME")
        ) {
          await emailjs.send(
            EMAILJS_SERVICE_ID,
            EMAILJS_CAREERS_TEMPLATE_ID,
            {
              to_email: "gymroamapp@gmail.com",
              applicant_name: form.fullName.trim(),
              applicant_email: form.email.trim().toLowerCase(),
              role_title: roleObj?.formLabel || selectedRole,
              city: form.city.trim() || "—",
              start_date: form.startDate.trim() || "—",
              instagram_handle: form.instagramHandle.trim().replace(/^@/, "") || "—",
              portfolio_link: form.portfolioLink.trim() || "—",
              ai_tools: form.aiTools.trim() || "—",
              why: form.why.trim(),
            },
            EMAILJS_PUBLIC_KEY
          );
        }
      } catch {
        /* email notification is best-effort; Firestore write is the source of truth */
      }

      localStorage.setItem("gymroam_careers_applied", "true");
      setSubmitted(true);
    } catch {
      setToast({ show: true, message: "Something went wrong. Try again." });
    }
    setSubmitting(false);
  };

  const currentRole = ROLES.find((r) => r.id === selectedRole) || ROLES[0];

  return (
    <>
      <Nav />
      <main className={styles.page}>
        {/* Hero */}
        <section className={styles.hero}>
          <div className={`${styles.heroInner} fade-up`}>
            <div className={styles.eyebrow}>
              <span className={styles.eyebrowDot} />
              We&apos;re hiring
            </div>
            <h1>
              Build GymRoam <span className={styles.accent}>with us.</span>
            </h1>
            <p>
              We&apos;re a small team building the way travelers find a place
              to train anywhere in the world. Two openings to start. Real
              ownership, real shipping, real launch.
            </p>
            <div className={styles.heroFacts}>
              <div className={styles.fact}>
                <div className={styles.factValue}>Hybrid</div>
                <div className={styles.factLabel}>Multi-city + remote</div>
              </div>
              <div className={styles.factDiv} />
              <div className={styles.fact}>
                <div className={styles.factValue}>1–3 months</div>
                <div className={styles.factLabel}>Flexible hours</div>
              </div>
              <div className={styles.factDiv} />
              <div className={styles.fact}>
                <div className={styles.factValue}>Pre-launch</div>
                <div className={styles.factLabel}>Real ownership · real ship</div>
              </div>
            </div>
          </div>
        </section>

        <div className={styles.divider} />

        {/* Manifesto / creative filler */}
        <section className={styles.manifesto}>
          <div className={styles.manifestoGrain} />
          <div className={`${styles.manifestoInner} fade-up`}>
            <div className={styles.manifestoSmall}>A short note</div>
            <h2 className={styles.manifestoLine}>
              We&apos;re not hiring résumés.
            </h2>
            <h2 className={styles.manifestoLine}>
              We&apos;re hiring people who{" "}
              <span className={styles.accent}>ship.</span>
            </h2>
            <p className={styles.manifestoBody}>
              If you&apos;ve been waiting for permission to make the thing —
              this is it. Pick up a camera. Open a doc. Send the DM. We&apos;ll
              hand you the keys, point at the city, and meet you back here at
              launch.
            </p>
          </div>

          {/* Kinetic value marquee */}
          <div className={styles.marquee}>
            <div className={styles.marqueeTrack}>
              {/* Duplicated content so the loop seams are invisible */}
              {[0, 1].map((i) => (
                <div className={styles.marqueeRow} key={i}>
                  <span>SHIP</span>
                  <span className={styles.marqueeDot}>●</span>
                  <span>STORY</span>
                  <span className={styles.marqueeDot}>●</span>
                  <span>STAMPS</span>
                  <span className={styles.marqueeDot}>●</span>
                  <span>COMMUNITY</span>
                  <span className={styles.marqueeDot}>●</span>
                  <span>CONTENT</span>
                  <span className={styles.marqueeDot}>●</span>
                  <span>FOUNDERSHIP</span>
                  <span className={styles.marqueeDot}>●</span>
                  <span>AI&#8209;NATIVE</span>
                  <span className={styles.marqueeDot}>●</span>
                  <span>ON&#8209;THE&#8209;ROAD</span>
                  <span className={styles.marqueeDot}>●</span>
                  <span>HONEST</span>
                  <span className={styles.marqueeDot}>●</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className={styles.divider} />

        {/* Roles */}
        <section className={styles.roles}>
          <div className={styles.rolesHeader}>
            <div className={styles.rolesTag}>Open roles · 2</div>
            <h2>Pick the lane that fits.</h2>
          </div>

          <div className={styles.rolesGrid}>
            {ROLES.map((role) => (
              <article key={role.id} className={styles.roleCard}>
                <div className={styles.roleHeading}>
                  <h3>{role.title}</h3>
                  <div className={styles.roleMeta}>
                    Hybrid · 1–3 months
                  </div>
                </div>

                <p className={styles.rolePitch}>{role.pitch}</p>

                <div className={styles.roleSection}>
                  <h4>What you&apos;ll do</h4>
                  <ul>
                    {role.duties.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                </div>

                <div className={styles.roleSection}>
                  <h4>You probably</h4>
                  <ul>
                    {role.requirements.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>

                <button
                  className={styles.applyBtn}
                  onClick={() => scrollToForm(role.id)}
                >
                  Apply for {role.title} &rarr;
                </button>
              </article>
            ))}
          </div>
        </section>

        <div className={styles.divider} />

        {/* What you get */}
        <section className={styles.deal}>
          <div className={`${styles.dealInner} fade-up`}>
            <div className={styles.dealTag}>What you get</div>
            <h2>
              Why this is <span className={styles.accent}>worth it.</span>
            </h2>
            <p>
              You&apos;ll be in the room while a fitness app gets built from the
              ground up. That experience is rare. Here&apos;s what comes with it:
            </p>
            <div className={styles.dealGrid}>
              <div className={styles.dealCard}>
                <div className={styles.dealNum}>01</div>
                <h4>Real ownership</h4>
                <p>
                  Your work ships. You&apos;ll see your Reels in the launch
                  campaign and your DMs in the comments.
                </p>
              </div>
              <div className={styles.dealCard}>
                <div className={styles.dealNum}>02</div>
                <h4>Founder mentorship</h4>
                <p>
                  Work directly with us. You&apos;ll see how a startup gets
                  built — strategy, execution, decisions, all of it.
                </p>
              </div>
              <div className={styles.dealCard}>
                <div className={styles.dealNum}>03</div>
                <h4>Reference + path forward</h4>
                <p>
                  A strong reference from us for your next role. And a clear
                  path to staying on the team as GymRoam grows.
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className={styles.divider} />

        {/* Application form */}
        <section className={styles.applySection} ref={formRef} id="apply">
          <div className={styles.applyInner}>
            {submitted ? (
              <div className={styles.success}>
                <div className={styles.successCheck}>&#10003;</div>
                <div>
                  <div className={styles.successTitle}>Application received</div>
                  <div className={styles.successSub}>
                    We read every one. Expect to hear back within a week.
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className={styles.applyHeader}>
                  <div className={styles.applyTag}>Apply</div>
                  <h2>Send us your shot.</h2>
                  <p>One short form. We read every application.</p>
                </div>

                <div className={styles.roleToggle}>
                  {ROLES.map((r) => (
                    <button
                      key={r.id}
                      className={`${styles.roleToggleBtn} ${selectedRole === r.id ? styles.roleToggleActive : ""}`}
                      onClick={() => setSelectedRole(r.id)}
                    >
                      {r.title}
                    </button>
                  ))}
                </div>

                <div className={styles.formGrid}>
                  <label className={styles.field}>
                    <span>Full name *</span>
                    <input
                      type="text"
                      value={form.fullName}
                      onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                      placeholder="Alex Roamer"
                    />
                  </label>
                  <label className={styles.field}>
                    <span>Email *</span>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="you@email.com"
                    />
                  </label>
                  <label className={styles.field}>
                    <span>City</span>
                    <input
                      type="text"
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      placeholder="Miami, FL"
                    />
                  </label>
                  <label className={styles.field}>
                    <span>Earliest start date</span>
                    <input
                      type="text"
                      value={form.startDate}
                      onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                      placeholder="ASAP / a few weeks / specific date"
                    />
                  </label>
                  <label className={`${styles.field} ${styles.fieldFull}`}>
                    <span>Instagram or TikTok handle</span>
                    <input
                      type="text"
                      value={form.instagramHandle}
                      onChange={(e) => setForm({ ...form, instagramHandle: e.target.value })}
                      placeholder="@yourhandle (works without the @)"
                    />
                  </label>
                  <label className={`${styles.field} ${styles.fieldFull}`}>
                    <span>
                      {currentRole.id === "videographer"
                        ? "Reel / portfolio link *"
                        : "Portfolio / past work link"}
                    </span>
                    <input
                      type="text"
                      value={form.portfolioLink}
                      onChange={(e) => setForm({ ...form, portfolioLink: e.target.value })}
                      placeholder={
                        currentRole.id === "videographer"
                          ? "Vimeo, YouTube, IG Reels, Drive — anything"
                          : "Notion, Drive, Substack, content account"
                      }
                    />
                  </label>
                  <label className={`${styles.field} ${styles.fieldFull}`}>
                    <span>AI tools you use (or want to)</span>
                    <input
                      type="text"
                      value={form.aiTools}
                      onChange={(e) => setForm({ ...form, aiTools: e.target.value })}
                      placeholder={
                        currentRole.id === "videographer"
                          ? "CapCut AI, Runway, ElevenLabs, Descript…"
                          : "ChatGPT, Claude, Notion AI, Perplexity…"
                      }
                    />
                  </label>
                  <label className={`${styles.field} ${styles.fieldFull}`}>
                    <span>Why GymRoam? *</span>
                    <textarea
                      rows={4}
                      value={form.why}
                      onChange={(e) => setForm({ ...form, why: e.target.value })}
                      placeholder="What pulls you to this — even a few sentences. We don't need a cover letter."
                    />
                  </label>
                </div>

                <button
                  className={styles.submitBtn}
                  onClick={submit}
                  disabled={submitting}
                >
                  {submitting ? "Sending…" : "Submit Application"}
                </button>
                <p className={styles.formNote}>
                  We respect your time. No filler steps, no follow-up survey.
                </p>
              </>
            )}
          </div>
        </section>
      </main>
      <Footer />
      <Toast
        message={toast.message}
        show={toast.show}
        onHide={() => setToast({ ...toast, show: false })}
      />
    </>
  );
}
