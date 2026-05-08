"use client";

import { useState, useEffect, useRef } from "react";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Toast from "@/components/Toast";
import { db } from "@/lib/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
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
      "Live in or visit Miami often",
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
    pitch: "Capture and cut the visual story of GymRoam — Miami fitness, on the road.",
    duties: [
      "Film on-location at gyms, run clubs, and wellness studios across Miami",
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
      "Live in or visit Miami often",
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

  // Hide-on-revisit if they already applied
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("gymroam_careers_applied") === "true") {
      setSubmitted(true);
    }
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
              We&apos;re a small Miami-based team building the way travelers
              find a place to train anywhere in the world. Two openings to
              start. Real ownership, real shipping, real launch.
            </p>
            <div className={styles.heroFacts}>
              <div className={styles.fact}>
                <div className={styles.factValue}>Hybrid</div>
                <div className={styles.factLabel}>Miami + remote</div>
              </div>
              <div className={styles.factDiv} />
              <div className={styles.fact}>
                <div className={styles.factValue}>1–3 months</div>
                <div className={styles.factLabel}>Flexible hours</div>
              </div>
              <div className={styles.factDiv} />
              <div className={styles.fact}>
                <div className={styles.factValue}>Unpaid</div>
                <div className={styles.factLabel}>Pre-launch · transparent</div>
              </div>
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
                <div className={styles.roleCardTop}>
                  <div className={styles.roleIcon}>
                    {role.id === "marketing-intern" ? (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M3 11v2h4l5 4V7L7 11H3zm13.5 1c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 4.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                      </svg>
                    ) : (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
                      </svg>
                    )}
                  </div>
                  <div className={styles.roleHeading}>
                    <h3>{role.title}</h3>
                    <div className={styles.roleMeta}>
                      Hybrid · 1–3 months · Unpaid
                    </div>
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

        {/* The deal — transparent about pay */}
        <section className={styles.deal}>
          <div className={`${styles.dealInner} fade-up`}>
            <div className={styles.dealTag}>The deal</div>
            <h2>
              Unpaid for now. <span className={styles.accent}>Worth it anyway.</span>
            </h2>
            <p>
              We&apos;re pre-launch and pre-revenue, so we can&apos;t pay yet —
              we&apos;re not going to dress that up. What we can offer:
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
                  path to a paid spot if we raise and you&apos;re a fit.
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
