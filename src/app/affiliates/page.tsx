"use client";

/**
 * /affiliates — creator referral program application.
 *
 * An APPLICATION, not an open signup. Nothing here issues a code: the
 * requested code is recorded, checked for availability as a courtesy,
 * and only becomes real when an admin approves in the panel. That's
 * what keeps coupon sites and code farmers out.
 *
 * Mirrors the /trainer application patterns (client-side Firestore
 * write + `mail` collection for the notification and confirmation
 * emails) so both funnels behave the same way in the admin panel.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Check } from "@phosphor-icons/react/dist/ssr";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Toast from "@/components/Toast";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import {
  CONTENT_NICHES,
  AUDIENCE_LOCATIONS,
  PAYMENT_METHODS,
  REFERRAL_SOURCES,
  COMMISSION_TIERS,
  AFFILIATE_DISCOUNT_USD,
  APPLE_SIGNIN_WARNING,
  CODE_MAX_LENGTH,
  normalizeCode,
  validateCodeFormat,
  CODE_REJECTION_MESSAGES,
} from "@/lib/affiliate";
import styles from "./page.module.css";

/** Shape returned by /api/affiliate/check-code. */
interface CodeCheck {
  code: string;
  /** null = we couldn't check (outage); treat as "unknown", not "no". */
  available: boolean | null;
  message?: string;
  suggestions?: string[];
}

export default function AffiliatesPage() {
  /* ── basics ── */
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("United States");
  const [stateRegion, setStateRegion] = useState("");

  /* ── platforms ── */
  const [instagramHandle, setInstagramHandle] = useState("");
  const [instagramFollowers, setInstagramFollowers] = useState("");
  const [tiktokHandle, setTiktokHandle] = useState("");
  const [tiktokFollowers, setTiktokFollowers] = useState("");
  const [otherPlatform, setOtherPlatform] = useState("");
  const [niche, setNiche] = useState<string>(CONTENT_NICHES[0]);
  const [audienceLocation, setAudienceLocation] = useState<string>(
    AUDIENCE_LOCATIONS[0]
  );

  /* ── deal ── */
  const [requestedCode, setRequestedCode] = useState("");
  const [heardAbout, setHeardAbout] = useState<string>(REFERRAL_SOURCES[0]);
  const [paymentMethod, setPaymentMethod] = useState<string>(PAYMENT_METHODS[0]);
  const [notes, setNotes] = useState("");

  const [agree, setAgree] = useState(false);
  const [acknowledgeApple, setAcknowledgeApple] = useState(false);

  /* ── ui state ── */
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "" });

  /* ── live code availability ── */
  const [codeCheck, setCodeCheck] = useState<CodeCheck | null>(null);
  const [checking, setChecking] = useState(false);
  /** Guards against a slow earlier response overwriting a newer one. */
  const checkSeq = useRef(0);

  function showToast(msg: string) {
    setToast({ show: true, message: msg });
  }

  function normalizeHandle(h: string) {
    const trimmed = h.trim().replace(/^@+/, "");
    return trimmed ? `@${trimmed}` : "";
  }

  function parseFollowers(v: string): number {
    const n = parseInt(v.replace(/[^\d]/g, ""), 10);
    return Number.isFinite(n) ? n : 0;
  }

  /* Debounced availability check — same feel as a username field. */
  const code = normalizeCode(requestedCode);
  const localRejection = code ? validateCodeFormat(code) : null;

  useEffect(() => {
    if (!code) {
      setCodeCheck(null);
      setChecking(false);
      return;
    }
    // Format problems are decided locally — no point asking the server.
    if (localRejection) {
      setCodeCheck({
        code,
        available: false,
        message: CODE_REJECTION_MESSAGES[localRejection],
        suggestions: [],
      });
      setChecking(false);
      return;
    }

    const seq = ++checkSeq.current;
    setChecking(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/affiliate/check-code?code=${encodeURIComponent(code)}`
        );
        const json: CodeCheck = await res.json();
        if (seq !== checkSeq.current) return; // a newer keystroke won
        setCodeCheck(json);
      } catch {
        if (seq !== checkSeq.current) return;
        setCodeCheck({
          code,
          available: null,
          message: "Couldn't check right now — we'll confirm on review",
        });
      } finally {
        if (seq === checkSeq.current) setChecking(false);
      }
    }, 400);

    return () => clearTimeout(t);
  }, [code, localRejection]);

  const applySuggestion = useCallback((s: string) => {
    setRequestedCode(s);
  }, []);

  async function handleSubmit() {
    if (
      !fullName.trim() ||
      !email.trim() ||
      !country.trim() ||
      !stateRegion.trim() ||
      !instagramHandle.trim() ||
      !instagramFollowers.trim() ||
      !tiktokHandle.trim() ||
      !tiktokFollowers.trim() ||
      !requestedCode.trim()
    ) {
      showToast("Please fill in all required fields");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      showToast("Please enter a valid email");
      return;
    }

    if (localRejection) {
      showToast(CODE_REJECTION_MESSAGES[localRejection]);
      return;
    }
    if (codeCheck?.available === false) {
      showToast("Pick an available referral code");
      return;
    }
    if (!acknowledgeApple) {
      showToast("Please confirm you'll sign up with an email address");
      return;
    }
    if (!agree) {
      showToast("Please confirm the program terms");
      return;
    }

    setLoading(true);

    const ig = normalizeHandle(instagramHandle);
    const tt = normalizeHandle(tiktokHandle);
    const igCount = parseFollowers(instagramFollowers);
    const ttCount = parseFollowers(tiktokFollowers);
    const cleanEmail = email.trim().toLowerCase();

    try {
      await addDoc(collection(db, "affiliateApplications"), {
        status: "pending",

        fullName: fullName.trim(),
        email: cleanEmail,
        phone: phone.trim(),
        country: country.trim(),
        stateRegion: stateRegion.trim(),

        instagramHandle: ig,
        instagramFollowers: igCount,
        tiktokHandle: tt,
        tiktokFollowers: ttCount,
        otherPlatform: otherPlatform.trim(),
        niche,
        audienceLocation,

        requestedCode: code,
        heardAbout,
        paymentMethod,
        notes: notes.trim(),

        /* Set by the admin panel on approval — never by this form. */
        issuedCode: null,
        approvedAt: null,
        approvedBy: null,

        createdAt: serverTimestamp(),
      });

      /* notification email to us */
      await addDoc(collection(db, "mail"), {
        to: ["sales@gymroamapp.com"],
        message: {
          subject: `New Affiliate Application: ${fullName.trim()} (${ig}) — wants ${code}`,
          html: `
            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;background:#111114;color:#E8E8EE;padding:32px;border-radius:16px;border:1px solid #E8FF3C;">
              <h2 style="color:#E8FF3C;margin:0 0 24px;">New Affiliate Application</h2>
              <h3 style="color:#8A8A99;font-size:12px;text-transform:uppercase;margin:0 0 8px;">Creator</h3>
              <p style="margin:0 0 4px;"><strong>${fullName.trim()}</strong></p>
              <p style="margin:0 0 4px;">${cleanEmail}</p>
              ${phone.trim() ? `<p style="margin:0 0 4px;">${phone.trim()}</p>` : ""}
              <p style="margin:0 0 16px;">${stateRegion.trim()}, ${country.trim()}</p>
              <h3 style="color:#8A8A99;font-size:12px;text-transform:uppercase;margin:0 0 8px;">Platforms (verify manually)</h3>
              <p style="margin:0 0 4px;">
                <a href="https://instagram.com/${ig.replace(/^@/, "")}" style="color:#E8FF3C;">${ig}</a>
                — claimed <strong>${igCount.toLocaleString()}</strong> followers
              </p>
              <p style="margin:0 0 4px;">
                <a href="https://tiktok.com/@${tt.replace(/^@/, "")}" style="color:#E8FF3C;">${tt}</a>
                — claimed <strong>${ttCount.toLocaleString()}</strong> followers
              </p>
              ${otherPlatform.trim() ? `<p style="margin:0 0 4px;">Other: ${otherPlatform.trim()}</p>` : ""}
              <p style="margin:0 0 16px;">${niche} &middot; ${audienceLocation}</p>
              <h3 style="color:#8A8A99;font-size:12px;text-transform:uppercase;margin:0 0 8px;">Deal</h3>
              <p style="margin:0 0 4px;">Requested code: <strong style="color:#E8FF3C;">${code}</strong></p>
              <p style="margin:0 0 4px;">Payment preference: ${paymentMethod}</p>
              <p style="margin:0 0 16px;">Heard about us: ${heardAbout}</p>
              ${notes.trim() ? `<p style="margin:0 0 16px;"><strong>Notes:</strong> ${notes.trim()}</p>` : ""}
              <p style="margin:24px 0 0;color:#8A8A99;font-size:13px;">Review and approve in the admin panel — the code is not issued until you do.</p>
            </div>
          `,
        },
      });

      /* confirmation email to applicant */
      await addDoc(collection(db, "mail"), {
        to: [cleanEmail],
        message: {
          subject: "GymRoam — Your affiliate application is in review",
          html: `
            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;background:#111114;color:#E8E8EE;padding:32px;border-radius:16px;border:1px solid #1F1F26;">
              <div style="text-align:center;margin-bottom:24px;">
                <div style="display:inline-block;width:40px;height:40px;background:#E8FF3C;border-radius:10px;line-height:40px;font-weight:900;font-size:20px;color:#0A0A0B;">G</div>
              </div>
              <h2 style="text-align:center;margin:0 0 8px;font-size:22px;">Application Received</h2>
              <p style="text-align:center;color:#8A8A99;margin:0 0 24px;font-size:14px;">Thanks for applying, ${fullName.trim()}.</p>
              <div style="background:#18181D;border-radius:12px;padding:20px;margin-bottom:24px;">
                <p style="margin:0 0 4px;color:#8A8A99;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Requested code</p>
                <p style="margin:0;font-weight:800;font-size:20px;color:#E8FF3C;">${code}</p>
              </div>
              <h3 style="font-size:13px;color:#8A8A99;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">What happens next</h3>
              <ol style="color:#8A8A99;font-size:14px;line-height:1.7;padding-left:20px;margin:0 0 24px;">
                <li>We review every application by hand — usually within a few days</li>
                <li>If approved, we confirm your code and send your agreement to sign</li>
                <li>You get your tracking link, dashboard login, and free GymRoam Pro</li>
              </ol>
              <div style="background:#1A1206;border:1px solid #FF8C42;border-radius:12px;padding:16px;margin-bottom:24px;">
                <p style="margin:0 0 6px;color:#FF8C42;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Important</p>
                <p style="margin:0;color:#E8E8EE;font-size:13px;line-height:1.6;">${APPLE_SIGNIN_WARNING}</p>
              </div>
              <p style="color:#55555F;font-size:12px;text-align:center;margin:0;">Questions? Reply to this email.</p>
            </div>
          `,
        },
      });

      setSubmitted(true);
      showToast("Application submitted");
    } catch (e) {
      console.error("Submit error:", e);
      showToast("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  /* ── code field status line ── */
  function codeStatus() {
    if (!code) return null;
    if (checking) {
      return <div className={styles.codeStatusChecking}>Checking…</div>;
    }
    if (!codeCheck) return null;
    if (codeCheck.available === true) {
      return (
        <div className={styles.codeStatusGood}>
          <Check size={13} weight="bold" /> {code} is available
        </div>
      );
    }
    if (codeCheck.available === null) {
      return <div className={styles.codeStatusUnknown}>{codeCheck.message}</div>;
    }
    return (
      <div className={styles.codeStatusBad}>
        <span>{codeCheck.message}</span>
        {codeCheck.suggestions && codeCheck.suggestions.length > 0 && (
          <span className={styles.codeSuggestions}>
            Try:
            {codeCheck.suggestions.map((s) => (
              <button
                key={s}
                type="button"
                className={styles.codeSuggestion}
                onClick={() => applySuggestion(s)}
              >
                {s}
              </button>
            ))}
          </span>
        )}
      </div>
    );
  }

  /* ── success state ── */
  if (submitted) {
    return (
      <>
        <Nav />
        <main>
          <section className={styles.success}>
            <div className={styles.successIcon}>
              <Check size={28} weight="bold" />
            </div>
            <h1>Application received</h1>
            <p>
              We review every application by hand. If you&apos;re a fit,
              we&apos;ll confirm your code <strong>{code}</strong> and send
              your agreement, tracking link, and dashboard login.
            </p>
            <div className={styles.appleNoticeSuccess}>
              <strong>Don&apos;t forget:</strong> {APPLE_SIGNIN_WARNING}
            </div>
          </section>
        </main>
        <Footer />
        <Toast
          show={toast.show}
          message={toast.message}
          onHide={() => setToast({ show: false, message: "" })}
        />
      </>
    );
  }

  return (
    <>
      <Nav />

      <main>
        {/* Hero */}
        <section className={styles.hero}>
          <span className={styles.tag}>Creator Program</span>
          <h1>
            Get paid to send people <span className={styles.accent}>where they train.</span>
          </h1>
          <p>
            Share GymRoam with your audience, they get $
            {AFFILIATE_DISCOUNT_USD} off annual Pro, and you earn recurring
            commission for as long as they stay subscribed.
          </p>
        </section>

        {/* Commission tiers */}
        <section className={styles.values}>
          {COMMISSION_TIERS.map((t) => (
            <div key={t.label} className={styles.valueCard}>
              <h3>{t.label}</h3>
              <p>
                {t.maxSignups === null
                  ? `${t.minSignups}+ Pro signups`
                  : `${t.minSignups}–${t.maxSignups} Pro signups`}
                {" "}in a rolling 12 months
              </p>
            </div>
          ))}
        </section>

        <section className={styles.terms}>
          <p>
            Commission is paid on net revenue — what we actually receive
            after Apple&apos;s cut, refunds, and taxes — and recurs on
            renewals for as long as your referral stays subscribed. Tier
            increases apply going forward from the month you hit them.
            Commission clears after a subscription stays active 30
            consecutive days; payouts run monthly with a $25 minimum.
          </p>
        </section>

        <div className={styles.divider} />

        {/* Form */}
        <section className={styles.formSection}>
          <div className={styles.formCard}>
            <div className={styles.sectionLabelFirst}>About you</div>

            <label htmlFor="fullName">
              Full name <span className={styles.required}>*</span>
            </label>
            <input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your name"
            />

            <label htmlFor="email">
              Email <span className={styles.required}>*</span>
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />

            {/* The Apple warning sits right on the email field, where the
                mistake actually gets made. */}
            <div className={styles.appleNotice}>
              <span className={styles.appleNoticeLabel}>Important</span>
              <p>{APPLE_SIGNIN_WARNING}</p>
            </div>

            <label htmlFor="phone">Phone (optional)</label>
            <input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 305 555 0134"
            />

            <div className={styles.formRow}>
              <div>
                <label htmlFor="country">
                  Country <span className={styles.required}>*</span>
                </label>
                <input
                  id="country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="United States"
                />
              </div>
              <div>
                <label htmlFor="stateRegion">
                  State / region <span className={styles.required}>*</span>
                </label>
                <input
                  id="stateRegion"
                  value={stateRegion}
                  onChange={(e) => setStateRegion(e.target.value)}
                  placeholder="Florida"
                />
              </div>
            </div>

            {/* ── Platforms ── */}
            <div className={styles.sectionLabel}>Your platforms</div>

            <div className={styles.formRow}>
              <div>
                <label htmlFor="instagramHandle">
                  Instagram handle <span className={styles.required}>*</span>
                </label>
                <input
                  id="instagramHandle"
                  value={instagramHandle}
                  onChange={(e) => setInstagramHandle(e.target.value)}
                  placeholder="@yourhandle"
                />
              </div>
              <div>
                <label htmlFor="instagramFollowers">
                  IG followers <span className={styles.required}>*</span>
                </label>
                <input
                  id="instagramFollowers"
                  inputMode="numeric"
                  value={instagramFollowers}
                  onChange={(e) => setInstagramFollowers(e.target.value)}
                  placeholder="12500"
                />
              </div>
            </div>

            <div className={styles.formRow}>
              <div>
                <label htmlFor="tiktokHandle">
                  TikTok handle <span className={styles.required}>*</span>
                </label>
                <input
                  id="tiktokHandle"
                  value={tiktokHandle}
                  onChange={(e) => setTiktokHandle(e.target.value)}
                  placeholder="@yourhandle"
                />
              </div>
              <div>
                <label htmlFor="tiktokFollowers">
                  TikTok followers <span className={styles.required}>*</span>
                </label>
                <input
                  id="tiktokFollowers"
                  inputMode="numeric"
                  value={tiktokFollowers}
                  onChange={(e) => setTiktokFollowers(e.target.value)}
                  placeholder="30000"
                />
              </div>
            </div>

            <label htmlFor="otherPlatform">
              YouTube or other (optional)
            </label>
            <input
              id="otherPlatform"
              value={otherPlatform}
              onChange={(e) => setOtherPlatform(e.target.value)}
              placeholder="youtube.com/@yourchannel"
            />

            <div className={styles.formRow}>
              <div>
                <label htmlFor="niche">
                  Primary niche <span className={styles.required}>*</span>
                </label>
                <select
                  id="niche"
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                >
                  {CONTENT_NICHES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="audienceLocation">
                  Audience location <span className={styles.required}>*</span>
                </label>
                <select
                  id="audienceLocation"
                  value={audienceLocation}
                  onChange={(e) => setAudienceLocation(e.target.value)}
                >
                  {AUDIENCE_LOCATIONS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* ── Deal ── */}
            <div className={styles.sectionLabel}>Your code &amp; payment</div>

            <label htmlFor="requestedCode">
              Requested referral code <span className={styles.required}>*</span>
            </label>
            <input
              id="requestedCode"
              value={requestedCode}
              maxLength={CODE_MAX_LENGTH}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              className={styles.codeInput}
              onChange={(e) => setRequestedCode(e.target.value.toUpperCase())}
              placeholder="YOURNAME"
            />
            <div className={styles.codeStatusWrap}>{codeStatus()}</div>
            <p className={styles.helper}>
              Letters and numbers only, {CODE_MAX_LENGTH} characters max.
              This is what your audience types — short and memorable wins.
              We confirm the final code when we approve you.
            </p>

            <div className={styles.formRow}>
              <div>
                <label htmlFor="heardAbout">How did you hear about us?</label>
                <select
                  id="heardAbout"
                  value={heardAbout}
                  onChange={(e) => setHeardAbout(e.target.value)}
                >
                  {REFERRAL_SOURCES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="paymentMethod">Payment preference</label>
                <select
                  id="paymentMethod"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  {PAYMENT_METHODS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label htmlFor="notes">Anything else? (optional)</label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Best-performing content, why your audience would use GymRoam…"
            />

            {/* ── Confirmations ── */}
            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={acknowledgeApple}
                onChange={(e) => setAcknowledgeApple(e.target.checked)}
              />
              <span>
                I&apos;ll sign up in the GymRoam app with an{" "}
                <strong>email address</strong>, not Sign in with Apple.
              </span>
            </label>

            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
              />
              <span>
                I understand this is an application, that GymRoam reviews and
                approves each creator, and that commission terms are confirmed
                in the agreement I&apos;ll sign if approved.
              </span>
            </label>

            <button
              className={styles.submitBtn}
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? "Submitting…" : "Submit Application"}
            </button>

            <p className={styles.formNote}>
              Applying doesn&apos;t issue a code. We review each one by hand.
            </p>
          </div>
        </section>
      </main>

      <Footer />

      <Toast
        show={toast.show}
        message={toast.message}
        onHide={() => setToast({ show: false, message: "" })}
      />
    </>
  );
}
