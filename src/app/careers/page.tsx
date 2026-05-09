"use client";

/**
 * Careers page — FLSA-compliant unpaid internship listings.
 *
 * Copy mirrors the compliance doc at:
 *   ~/Desktop/Donna/Compliance/Internship Listings - FLSA-Compliant Copy.md
 *
 * Closes three Primary Beneficiary Test gaps the original listings had:
 *   1. Explicit unpaid disclosure + non-monetary compensation framing
 *   2. Academic credit requirement
 *   3. Responsibilities reframed as learning outcomes with mentorship
 *
 * Also includes EEO statement and tightened duration ("one academic
 * semester · 10–15 hrs/week") to satisfy FLSA Factors 4 and 5.
 */

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
  formLabel: string;
  pitch: string;
  /** "What you'll learn" bullets — framed as learning outcomes */
  learning: string[];
  /** "Required qualifications" — incl. academic credit eligibility */
  requirements: string[];
  /** "Mentorship & supervision" structure */
  mentorship: string[];
}

const ROLES: Role[] = [
  {
    id: "marketing-intern",
    title: "Marketing Intern",
    formLabel: "Marketing Intern",
    pitch: "Help us grow the community finding GymRoam every day.",
    learning: [
      "Social-first content marketing. You'll create Instagram Reels, carousels, and Stories with founder mentorship.",
      "Community engagement. You'll manage DMs, comments, and replies with weekly review and feedback.",
      "B2B partnership outreach. You'll draft and send pitches to gyms, trainers, and creators with founder oversight.",
      "Email campaign design. You'll compose and distribute newsletters to the GymRoam community.",
      "AI-augmented marketing workflows. You'll integrate tools like Claude and ChatGPT into research, drafting, and analysis.",
    ],
    requirements: [
      "Currently enrolled in a college or university program (Marketing, Business, Communications, Digital Media, or related field)",
      "Eligible to receive academic credit for this internship through your school",
      "Based in Miami or Atlanta (or a frequent visitor)",
      "Active on Instagram and/or TikTok",
      "Some prior experience creating content or managing accounts (personal or professional)",
      "Familiarity with AI tools like ChatGPT or Claude",
      "Genuine curiosity about startups, brand-building, and travel-fitness culture",
    ],
    mentorship: [
      "Direct weekly 1:1 mentorship sessions with the founder",
      "Designated site supervisor: Founder, Leve AI Studios LLC",
      "Bi-quarterly performance reviews to track growth and feedback (satisfies your school's internship-office requirements)",
      "Real participation in founder-level decisions on growth strategy, brand direction, and partner selection",
    ],
  },
  {
    id: "videographer",
    title: "Videographer / Editor Intern",
    formLabel: "Videographer / Editor Intern",
    pitch: "Capture and cut the visual story of GymRoam. Fitness on the road.",
    learning: [
      "Brand-led video production. You'll film founder content and gym B-roll on-location around Miami under creative direction.",
      "Short-form social editing. You'll cut Reels, TikToks, and Story-format video against an established brand kit.",
      "B-roll library development. You'll capture reusable footage for future ads, partner content, and campaigns.",
      "AI-augmented post-production. You'll integrate AI editing tools (Descript, Runway, CapCut AI features) into your workflow.",
      "Campaign-led production. You'll collaborate on visual content rollouts for partner and growth campaigns.",
    ],
    requirements: [
      "Currently enrolled in a college or university program (Film, Video Production, Digital Media, Cinema, Communications, or related field; MDC's School of Entertainment & Design Technology is a great fit)",
      "Eligible to receive academic credit for this internship through your school",
      "Portfolio of recent video work (link in your application)",
      "Own equipment: camera or iPhone with stabilization, lighting accessories, and editing software (Premiere, DaVinci, Final Cut, or CapCut Pro)",
      "Comfortable working on-location at gyms and fitness venues, sometimes with new people",
      "Experience with AI editing tools, or willingness to learn",
      "Based in Miami or Atlanta (or a frequent visitor)",
    ],
    mentorship: [
      "Direct weekly 1:1 creative reviews with the founder",
      "Designated site supervisor: Founder, Leve AI Studios LLC",
      "Bi-quarterly performance reviews (satisfies your school's internship-office requirements)",
      "Full creative input. Your voice and edit choices shape the brand's visual story.",
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
    schoolName: "",
    coordinatorName: "",
    semester: "",
    creditEligible: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "" });
  const formRef = useRef<HTMLDivElement>(null);

  const scrollToForm = (roleId: string) => {
    setSelectedRole(roleId);
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  };

  // Hide-on-revisit + wire fade-up observer
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("gymroam_careers_applied") === "true") {
      setSubmitted(true);
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
    if (!form.schoolName.trim()) {
      setToast({ show: true, message: "Please enter the name of your school" });
      return;
    }
    if (!form.creditEligible) {
      setToast({
        show: true,
        message:
          "Academic credit eligibility is required. Confirm with your school's internship office before applying.",
      });
      return;
    }
    if (!form.why.trim()) {
      setToast({ show: true, message: "Tell us why you want to join, even briefly" });
      return;
    }
    if (selectedRole === "videographer" && !form.portfolioLink.trim()) {
      setToast({
        show: true,
        message: "Videographers need to share a reel or portfolio link",
      });
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
        schoolName: form.schoolName.trim(),
        coordinatorName: form.coordinatorName.trim(),
        semester: form.semester.trim(),
        creditEligible: form.creditEligible,
        createdAt: serverTimestamp(),
      });

      // Best-effort email notification — silent-fails so flaky email
      // service can't break the submit. Source of truth = Firestore.
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
              school_name: form.schoolName.trim() || "—",
              coordinator_name: form.coordinatorName.trim() || "—",
              semester: form.semester.trim() || "—",
              credit_eligible: form.creditEligible ? "Yes" : "No",
              instagram_handle:
                form.instagramHandle.trim().replace(/^@/, "") || "—",
              portfolio_link: form.portfolioLink.trim() || "—",
              ai_tools: form.aiTools.trim() || "—",
              why: form.why.trim(),
            },
            EMAILJS_PUBLIC_KEY
          );
        }
      } catch {
        /* email best-effort */
      }

      localStorage.setItem("gymroam_careers_applied", "true");
      setSubmitted(true);
    } catch (e: unknown) {
      // Log so we can debug from the browser console
      console.error("Career application submit failed:", e);
      const err = e as { code?: string; message?: string };
      let message = "Something went wrong. Try again.";
      if (err.code === "permission-denied") {
        message =
          "We couldn't save your application right now. Please try again or email gymroamapp@gmail.com directly.";
      } else if (err.code === "unavailable") {
        message =
          "Connection issue — please check your network and try again.";
      } else if (err.message?.toLowerCase().includes("network")) {
        message =
          "Network issue. Make sure you're online and try again.";
      }
      setToast({ show: true, message });
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
            <div className={styles.heroFacts}>
              <div className={styles.fact}>
                <div className={styles.factValue}>Hybrid</div>
                <div className={styles.factLabel}>Miami + Atlanta</div>
              </div>
              <div className={styles.factDiv} />
              <div className={styles.fact}>
                <div className={styles.factValue}>10–15 hrs/wk</div>
                <div className={styles.factLabel}>One academic semester</div>
              </div>
              <div className={styles.factDiv} />
              <div className={styles.fact}>
                <div className={styles.factValue}>Unpaid</div>
                <div className={styles.factLabel}>Academic credit eligible</div>
              </div>
            </div>
          </div>
        </section>

        <div className={styles.divider} />

        {/* Kinetic value marquee */}
        <section className={styles.manifesto}>
          <div className={styles.manifestoGrain} />
          <div className={styles.marquee}>
            <div className={styles.marqueeTrack}>
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
                    Hybrid · 10–15 hrs/week · One semester
                  </div>
                </div>

                <p className={styles.rolePitch}>{role.pitch}</p>

                {/* COMPENSATION DISCLOSURE — required for FLSA Factor 1 */}
                <div className={styles.compBanner}>
                  <div className={styles.compTitle}>This is an unpaid internship.</div>
                  <p>
                    Compensation is in the form of professional experience,
                    portfolio building, direct founder mentorship, and (where
                    applicable) <strong>academic credit</strong> through your
                    college or university.
                  </p>
                </div>

                <div className={styles.roleFacts}>
                  <div className={styles.roleFactRow}>
                    <span className={styles.roleFactLabel}>Reports to</span>
                    <span className={styles.roleFactValue}>
                      Founder &amp; Managing Member, Leve AI Studios LLC
                    </span>
                  </div>
                  <div className={styles.roleFactRow}>
                    <span className={styles.roleFactLabel}>Available semesters</span>
                    <span className={styles.roleFactValue}>
                      Summer 2026 · Fall 2026 · Spring 2027
                    </span>
                  </div>
                  <div className={styles.roleFactRow}>
                    <span className={styles.roleFactLabel}>Location</span>
                    <span className={styles.roleFactValue}>
                      Hybrid. Miami or Atlanta preferred, with some
                      on-location activity in Miami.
                    </span>
                  </div>
                </div>

                <div className={styles.roleSection}>
                  <h4>What you&apos;ll learn</h4>
                  <p className={styles.roleSectionLead}>
                    Real exposure to how an early-stage consumer brand grows from
                    zero. You&apos;ll graduate from this internship with hands-on
                    experience in:
                  </p>
                  <ul>
                    {role.learning.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                </div>

                <div className={styles.roleSection}>
                  <h4>Required qualifications</h4>
                  <ul>
                    {role.requirements.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>

                <div className={styles.roleSection}>
                  <h4>Mentorship &amp; supervision</h4>
                  <ul>
                    {role.mentorship.map((m) => (
                      <li key={m}>{m}</li>
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

        {/* What you get — non-monetary value (still valuable) */}
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
                  Your work ships. You&apos;ll see your Reels live and your DMs
                  in the comments.
                </p>
              </div>
              <div className={styles.dealCard}>
                <div className={styles.dealNum}>02</div>
                <h4>Founder mentorship</h4>
                <p>
                  Work directly with us. Weekly 1:1 sessions, bi-quarterly
                  reviews, and a real seat at the table.
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
                    <span>School *</span>
                    <input
                      type="text"
                      value={form.schoolName}
                      onChange={(e) => setForm({ ...form, schoolName: e.target.value })}
                      placeholder="University of Miami, MDC, FAMU…"
                    />
                  </label>
                  <label className={styles.field}>
                    <span>School internship coordinator</span>
                    <input
                      type="text"
                      value={form.coordinatorName}
                      onChange={(e) => setForm({ ...form, coordinatorName: e.target.value })}
                      placeholder="Name + email if known"
                    />
                  </label>

                  <label className={styles.field}>
                    <span>Anticipated semester *</span>
                    <select
                      value={form.semester}
                      onChange={(e) => setForm({ ...form, semester: e.target.value })}
                    >
                      <option value="">Select…</option>
                      <option value="Summer 2026">Summer 2026</option>
                      <option value="Fall 2026">Fall 2026</option>
                      <option value="Spring 2027">Spring 2027</option>
                    </select>
                  </label>
                  <label className={styles.field}>
                    <span>City</span>
                    <input
                      type="text"
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      placeholder="Miami / Atlanta / other"
                    />
                  </label>

                  <label className={`${styles.creditField} ${styles.fieldFull}`}>
                    <input
                      type="checkbox"
                      checked={form.creditEligible}
                      onChange={(e) =>
                        setForm({ ...form, creditEligible: e.target.checked })
                      }
                    />
                    <span>
                      I confirm I am currently enrolled and eligible to receive
                      academic credit for this internship through my school. *
                    </span>
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
                          ? "Vimeo, YouTube, IG Reels, Drive…"
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
                      placeholder="What pulls you to this. A few sentences is plenty. No cover letter needed."
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

        {/* EEO statement — required to round out the listings */}
        <section className={styles.eeo}>
          <div className={styles.eeoInner}>
            <div className={styles.eeoTag}>Equal Opportunity</div>
            <p>
              <strong>Leve AI Studios LLC is an equal-opportunity employer.</strong>{" "}
              We welcome applicants of all backgrounds, identities, abilities, and
              experience levels. Internships are awarded based on demonstrated
              interest, fit with the role&apos;s learning objectives, and ability
              to commit to the agreed schedule.
            </p>
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
