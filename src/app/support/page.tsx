/**
 * /support — public support form.
 *
 * Shape: hero pill + headline → quick-help info card → name/email/subject/
 * message form → success state. Mirrors the /trainer page's visual rhythm
 * so it feels like part of the same site without us having to maintain a
 * second styling vocabulary.
 *
 * Delivery: EmailJS only (no Firestore writes). Submissions hit the
 * EMAILJS_SUPPORT_TEMPLATE_ID template and email support@gymroamapp.com.
 * If the template ID is still the `template_REPLACE_ME_SUPPORT`
 * placeholder, we BLOCK the submit and show an inline fallback panel
 * pointing the user at support@gymroamapp.com directly, so a forgotten
 * EmailJS setup never produces silently-lost messages.
 *
 * No Firestore here by design (per Kevin's decision when scoping this
 * page) — fewer moving parts, but the inline fallback is the safety net
 * if EmailJS itself fails for the user (rate limit, network, etc.).
 */

"use client";

import { useState } from "react";
import emailjs from "@emailjs/browser";
import { Check, LifebuoyIcon, EnvelopeSimple } from "@phosphor-icons/react/dist/ssr";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Toast from "@/components/Toast";
import {
  EMAILJS_SERVICE_ID,
  EMAILJS_PUBLIC_KEY,
  EMAILJS_SUPPORT_TEMPLATE_ID,
} from "@/lib/emailjs";
import styles from "./page.module.css";

const SUPPORT_EMAIL = "support@gymroamapp.com";

// True only when the EmailJS template is still a placeholder. We block
// submission in that case so messages don't silently drop into the void.
const TEMPLATE_CONFIGURED =
  EMAILJS_SUPPORT_TEMPLATE_ID &&
  !EMAILJS_SUPPORT_TEMPLATE_ID.includes("REPLACE_ME");

export default function SupportPage() {
  // ── form state ──
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  // ── ui state ──
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "" });

  function showToast(msg: string) {
    setToast({ show: true, message: msg });
  }

  async function handleSubmit() {
    if (loading) return;

    // Front-end validation. Keep these messages short — the Toast
    // component truncates at narrow widths.
    if (!name.trim() || !email.trim() || !subject.trim() || !message.trim()) {
      showToast("Please fill in all fields");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      showToast("Please enter a valid email");
      return;
    }
    if (message.trim().length < 10) {
      showToast("Please add a few more details to your message");
      return;
    }

    if (!TEMPLATE_CONFIGURED) {
      // Placeholder template still in place — refuse to submit so the
      // user doesn't think the message went through. The inline fallback
      // panel rendered below the form gives them the direct email.
      showToast("Form not yet configured — please email us directly");
      return;
    }

    setLoading(true);
    try {
      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_SUPPORT_TEMPLATE_ID,
        {
          to_email: SUPPORT_EMAIL,
          sender_name: name.trim(),
          sender_email: email.trim().toLowerCase(),
          subject: subject.trim(),
          message: message.trim(),
        },
        EMAILJS_PUBLIC_KEY
      );
      setSubmitted(true);
    } catch (e) {
      console.error("Support form submit failed:", e);
      showToast("Couldn't send your message — please try again");
    }
    setLoading(false);
  }

  return (
    <>
      <Nav />

      <main>
        {/* ── Hero ── */}
        <section className={styles.hero}>
          <div className={styles.tag}>
            <LifebuoyIcon size={12} weight="fill" />
            We&apos;re here to help
          </div>
          <h1>
            Get <span className={styles.accent}>Support</span>
          </h1>
          <p>
            Question, bug, account issue, or partnership inquiry? Send us a
            note and a human will get back to you. Typically within 1–2
            business days.
          </p>
        </section>

        {/* ── Quick contact card ── */}
        <section className={styles.quickHelp}>
          <div className={styles.quickHelpCard}>
            <div className={styles.quickHelpIcon}>
              <EnvelopeSimple size={20} weight="regular" />
            </div>
            <div className={styles.quickHelpText}>
              <h3>Prefer email?</h3>
              <p>
                Write us directly at{" "}
                <a href={`mailto:${SUPPORT_EMAIL}`} className={styles.inlineLink}>
                  {SUPPORT_EMAIL}
                </a>
                {" "}— or use the form below and we&apos;ll reply to your
                inbox.
              </p>
            </div>
          </div>
        </section>

        {/* ── Form ── */}
        <section className={styles.formSection}>
          {!submitted ? (
            <div className={styles.formCard}>
              <h2>Send us a message</h2>
              <p className={styles.formSubhead}>
                All fields required. We&apos;ll only use your email to reply.
              </p>

              <label htmlFor="support-name">
                Name <span className={styles.required}>*</span>
              </label>
              <input
                id="support-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                autoComplete="name"
                maxLength={120}
              />

              <label htmlFor="support-email">
                Email <span className={styles.required}>*</span>
              </label>
              <input
                id="support-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                autoComplete="email"
                inputMode="email"
                maxLength={200}
              />

              <label htmlFor="support-subject">
                Subject <span className={styles.required}>*</span>
              </label>
              <input
                id="support-subject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="What's this about?"
                maxLength={140}
              />

              <label htmlFor="support-message">
                Message <span className={styles.required}>*</span>
              </label>
              <textarea
                id="support-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us what's going on — the more detail the faster we can help."
                rows={6}
                maxLength={4000}
              />

              <button
                type="button"
                className={styles.submitBtn}
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? "Sending…" : "Send message"}
              </button>

              {/* If the EmailJS template isn't configured yet, the form
                  is intentionally inert. Surface the direct email path so
                  the user isn't stranded on a non-functional form. */}
              {!TEMPLATE_CONFIGURED && (
                <p className={styles.fallbackNotice}>
                  Form delivery isn&apos;t live yet — please email{" "}
                  <a href={`mailto:${SUPPORT_EMAIL}`} className={styles.inlineLink}>
                    {SUPPORT_EMAIL}
                  </a>{" "}
                  directly. We&apos;ll get back to you the same way.
                </p>
              )}
            </div>
          ) : (
            /* ── Success state ── */
            <div className={styles.success}>
              <div className={styles.successIcon}>
                <Check size={32} weight="bold" />
              </div>
              <h3>Message sent</h3>
              <p>
                Thanks for reaching out. A human will review your message and
                reply to <strong>{email}</strong> shortly.
              </p>
            </div>
          )}
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
