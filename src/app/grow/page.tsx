"use client";

import { useState } from "react";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Toast from "@/components/Toast";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { GYM_PARTNER_PRICE } from "@/lib/subscription";
import styles from "./page.module.css";

export default function GrowPage() {
  /* ── form fields ── */
  const [ownerName, setOwnerName] = useState("");
  const [ownerRole, setOwnerRole] = useState("Owner");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");

  const [gymName, setGymName] = useState("");
  const [gymAddress, setGymAddress] = useState("");
  const [gymCity, setGymCity] = useState("");
  const [gymState, setGymState] = useState("");
  const [gymPhone, setGymPhone] = useState("");
  const [gymType, setGymType] = useState("Gym / Fitness Center");
  const [gymWebsite, setGymWebsite] = useState("");
  const [gymInstagram, setGymInstagram] = useState("");

  const [verifyMethod, setVerifyMethod] = useState("");

  const [dayPass, setDayPass] = useState("Yes");
  const [gymNotes, setGymNotes] = useState("");

  /* ── ui state ── */
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "" });

  function showToast(msg: string) {
    setToast({ show: true, message: msg });
  }

  async function handleSubmit() {
    /* required-fields check */
    if (
      !ownerName.trim() ||
      !ownerEmail.trim() ||
      !ownerPhone.trim() ||
      !gymName.trim() ||
      !gymAddress.trim() ||
      !gymCity.trim() ||
      !gymState.trim() ||
      !verifyMethod.trim()
    ) {
      showToast("Please fill in all required fields");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(ownerEmail.trim())) {
      showToast("Please enter a valid email");
      return;
    }

    setLoading(true);

    try {
      await addDoc(collection(db, "gymPartnerApplications"), {
        ownerName: ownerName.trim(),
        ownerRole,
        ownerEmail: ownerEmail.trim(),
        ownerPhone: ownerPhone.trim(),
        gymName: gymName.trim(),
        gymAddress: gymAddress.trim(),
        gymCity: gymCity.trim(),
        gymState: gymState.trim(),
        gymPhone: gymPhone.trim(),
        gymType,
        gymWebsite: gymWebsite.trim(),
        gymInstagram: gymInstagram.trim(),
        verifyMethod: verifyMethod.trim(),
        dayPass,
        notes: gymNotes.trim(),
        status: "pending",
        createdAt: serverTimestamp(),
      });

      /* notification email via Firebase Trigger Email extension */
      await addDoc(collection(db, "mail"), {
        to: ["gymroamapp@gmail.com"],
        message: {
          subject: `New Gym Partner Application: ${gymName.trim()}`,
          html: `
            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;background:#111114;color:#E8E8EE;padding:32px;border-radius:16px;border:1px solid #E8FF3C;">
              <h2 style="color:#E8FF3C;margin:0 0 24px;">New Partner Application</h2>
              <h3 style="color:#8A8A99;font-size:12px;text-transform:uppercase;margin:0 0 8px;">Owner Info</h3>
              <p style="margin:0 0 4px;"><strong>${ownerName.trim()}</strong> — ${ownerRole}</p>
              <p style="margin:0 0 4px;">${ownerEmail.trim()}</p>
              <p style="margin:0 0 16px;">${ownerPhone.trim()}</p>
              <h3 style="color:#8A8A99;font-size:12px;text-transform:uppercase;margin:0 0 8px;">Gym Info</h3>
              <p style="margin:0 0 4px;"><strong>${gymName.trim()}</strong> (${gymType})</p>
              <p style="margin:0 0 4px;">${gymAddress.trim()}, ${gymCity.trim()}, ${gymState.trim()}</p>
              ${gymPhone.trim() ? `<p style="margin:0 0 4px;">${gymPhone.trim()}</p>` : ""}
              ${gymWebsite.trim() ? `<p style="margin:0 0 4px;">${gymWebsite.trim()}</p>` : ""}
              ${gymInstagram.trim() ? `<p style="margin:0 0 16px;">${gymInstagram.trim()}</p>` : '<p style="margin:0 0 16px;"></p>'}
              <h3 style="color:#8A8A99;font-size:12px;text-transform:uppercase;margin:0 0 8px;">Verification</h3>
              <p style="margin:0 0 16px;"><strong>How to verify:</strong> ${verifyMethod.trim()}</p>
              <h3 style="color:#8A8A99;font-size:12px;text-transform:uppercase;margin:0 0 8px;">Additional</h3>
              <p style="margin:0 0 4px;"><strong>Day passes:</strong> ${dayPass}</p>
              ${gymNotes.trim() ? `<p style="margin:0 0 4px;"><strong>Notes:</strong> ${gymNotes.trim()}</p>` : ""}
            </div>
          `,
        },
      });

      /* confirmation email to applicant */
      await addDoc(collection(db, "mail"), {
        to: [ownerEmail.trim()],
        message: {
          subject: "GymRoam — We received your application",
          html: `
            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;background:#111114;color:#E8E8EE;padding:32px;border-radius:16px;border:1px solid #1F1F26;">
              <div style="text-align:center;margin-bottom:24px;">
                <div style="display:inline-block;width:40px;height:40px;background:#E8FF3C;border-radius:10px;line-height:40px;font-weight:900;font-size:20px;color:#0A0A0B;">G</div>
              </div>
              <h2 style="text-align:center;margin:0 0 8px;font-size:22px;">Application Received</h2>
              <p style="text-align:center;color:#8A8A99;margin:0 0 24px;font-size:14px;">Thanks for applying to partner with GymRoam, ${ownerName.trim()}.</p>
              <div style="background:#18181D;border-radius:12px;padding:20px;margin-bottom:24px;">
                <p style="margin:0 0 4px;font-weight:700;">${gymName.trim()}</p>
                <p style="margin:0;color:#8A8A99;font-size:13px;">${gymCity.trim()}, ${gymState.trim()}</p>
              </div>
              <p style="color:#8A8A99;font-size:14px;text-align:center;margin:0 0 8px;">We'll review your documents and get back to you within <strong style="color:#E8E8EE;">24-48 hours</strong>.</p>
              <p style="color:#8A8A99;font-size:14px;text-align:center;margin:0;">Once approved, you'll receive a temporary passcode to sign into the GymRoam app and access your Partner Dashboard.</p>
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

  /* ── render ── */
  return (
    <>
      <Nav />

      <main>
        {/* Hero */}
        <section className={styles.hero}>
          <h1>
            Grow Your <span className={styles.accent}>Gym</span>
          </h1>
          <p>
            GymRoam sends travelers and locals to your door. Get listed, get
            seen, get booked.
          </p>
          <p
            style={{
              fontSize: 13,
              color: "var(--dim)",
              marginTop: -24,
              marginBottom: 48,
            }}
          >
            Gym Partner &middot; <strong style={{ color: "var(--accent)" }}>{GYM_PARTNER_PRICE}</strong>{" "}
            &middot; cancel anytime
          </p>
        </section>

        {/* Value props */}
        <section className={styles.values}>
          <div className={styles.valueCard}>
            <div className={styles.valueIcon}>&#9906;</div>
            <h3>Get discovered</h3>
            <p>
              Travelers search for gyms in your area daily. Your listing appears
              on their map with photos, details, and directions.
            </p>
          </div>
          <div className={styles.valueCard}>
            <div className={styles.valueIcon}>&#9733;</div>
            <h3>Build trust</h3>
            <p>
              Verified Partner badge on your listing. Respond to reviews. Show
              visitors you&apos;re traveler-friendly.
            </p>
          </div>
          <div className={styles.valueCard}>
            <div className={styles.valueIcon}>&#8599;</div>
            <h3>See your impact</h3>
            <p>
              Track how many people view your gym, save it, tap directions, and
              actually visit through GymRoam.
            </p>
          </div>
          <div className={styles.valueCard}>
            <div className={styles.valueIcon}>&#9881;</div>
            <h3>Control your listing</h3>
            <p>
              Update hours, photos, amenities, day pass pricing, and visitor
              deals — all from your dashboard.
            </p>
          </div>
        </section>

        <div className={styles.divider} />

        {/* How it works */}
        <section className={styles.how}>
          <h2>How it works</h2>
          <div className={styles.steps}>
            {[
              {
                num: 1,
                title: "Fill out the application",
                desc: "Tell us about your gym and provide proof of ownership. Takes about 5 minutes.",
              },
              {
                num: 2,
                title: "We review and verify",
                desc: "Our team reviews your documents and confirms ownership. Usually within 24-48 hours.",
              },
              {
                num: 3,
                title: "Receive your login",
                desc: "Once approved, we send you a temporary passcode to sign into the GymRoam app as a verified partner.",
              },
              {
                num: 4,
                title: "Manage your listing",
                desc: "Set your own password, access your dashboard, update photos, hours, pricing, and start getting discovered.",
              },
            ].map((s) => (
              <div key={s.num} className={styles.step}>
                <div className={styles.stepNum}>{s.num}</div>
                <div className={styles.stepText}>
                  <h4>{s.title}</h4>
                  <p>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className={styles.divider} />

        {/* Application form */}
        <section className={styles.formSection}>
          <h2>Partner Application</h2>
          <p>
            All fields marked <span className={styles.required}>*</span> are
            required.
          </p>

          {!submitted ? (
            <div className={styles.formCard}>
              {/* Section 1: Personal Info */}
              <div className={styles.sectionLabelFirst}>Your Information</div>

              <div className={styles.formRow}>
                <div>
                  <label>
                    Full Name <span className={styles.required}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="John Smith"
                    maxLength={100}
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                  />
                </div>
                <div>
                  <label>
                    Your Role <span className={styles.required}>*</span>
                  </label>
                  <select
                    value={ownerRole}
                    onChange={(e) => setOwnerRole(e.target.value)}
                  >
                    <option value="Owner">Owner</option>
                    <option value="Co-Owner">Co-Owner</option>
                    <option value="General Manager">General Manager</option>
                    <option value="Operations Director">
                      Operations Director
                    </option>
                    <option value="Marketing Director">
                      Marketing Director
                    </option>
                    <option value="Franchise Owner">Franchise Owner</option>
                  </select>
                </div>
              </div>

              <div className={styles.formRow}>
                <div>
                  <label>
                    Email <span className={styles.required}>*</span>
                  </label>
                  <input
                    type="email"
                    placeholder="you@yourgym.com"
                    maxLength={150}
                    value={ownerEmail}
                    onChange={(e) => setOwnerEmail(e.target.value)}
                  />
                </div>
                <div>
                  <label>
                    Phone Number <span className={styles.required}>*</span>
                  </label>
                  <input
                    type="tel"
                    placeholder="+1 (555) 123-4567"
                    maxLength={20}
                    value={ownerPhone}
                    onChange={(e) => setOwnerPhone(e.target.value)}
                  />
                </div>
              </div>

              {/* Section 2: Gym Info */}
              <div className={styles.sectionLabel}>Gym Information</div>

              <label>
                Gym / Studio Name <span className={styles.required}>*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Ironworks Fitness"
                maxLength={150}
                value={gymName}
                onChange={(e) => setGymName(e.target.value)}
              />

              <label>
                Full Address <span className={styles.required}>*</span>
              </label>
              <input
                type="text"
                placeholder="123 Main St, Miami, FL 33131"
                maxLength={250}
                value={gymAddress}
                onChange={(e) => setGymAddress(e.target.value)}
              />

              <div className={styles.formRow}>
                <div>
                  <label>
                    City <span className={styles.required}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Miami"
                    maxLength={100}
                    value={gymCity}
                    onChange={(e) => setGymCity(e.target.value)}
                  />
                </div>
                <div>
                  <label>
                    State / Country <span className={styles.required}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Florida, US"
                    maxLength={100}
                    value={gymState}
                    onChange={(e) => setGymState(e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <div>
                  <label>Gym Phone Number</label>
                  <input
                    type="tel"
                    placeholder="Gym's main line"
                    maxLength={20}
                    value={gymPhone}
                    onChange={(e) => setGymPhone(e.target.value)}
                  />
                </div>
                <div>
                  <label>
                    Gym Type <span className={styles.required}>*</span>
                  </label>
                  <select
                    value={gymType}
                    onChange={(e) => setGymType(e.target.value)}
                  >
                    <option value="Gym / Fitness Center">
                      Gym / Fitness Center
                    </option>
                    <option value="CrossFit Box">CrossFit Box</option>
                    <option value="Yoga Studio">Yoga Studio</option>
                    <option value="Pilates Studio">Pilates Studio</option>
                    <option value="Boxing / MMA Gym">Boxing / MMA Gym</option>
                    <option value="Cycling Studio">Cycling Studio</option>
                    <option value="Wellness / Recovery">
                      Wellness / Recovery
                    </option>
                    <option value="Personal Training Studio">
                      Personal Training Studio
                    </option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <label>Gym Website</label>
              <input
                type="text"
                placeholder="www.yourgym.com"
                maxLength={200}
                value={gymWebsite}
                onChange={(e) => setGymWebsite(e.target.value)}
              />

              <label>Gym Instagram</label>
              <input
                type="text"
                placeholder="@yourgym"
                maxLength={100}
                value={gymInstagram}
                onChange={(e) => setGymInstagram(e.target.value)}
              />

              {/* Section 3: Verification */}
              <div className={styles.sectionLabel}>Quick Verification</div>

              <label>
                How can we verify you manage this gym?{" "}
                <span className={styles.required}>*</span>
              </label>
              <textarea
                placeholder="e.g. 'I'm listed as the owner on Google Business Profile' or 'Check our Instagram @mygym — I manage the account' or 'Call the gym and ask for me'"
                value={verifyMethod}
                onChange={(e) => setVerifyMethod(e.target.value)}
              />
              <p className={styles.helper}>
                Just give us the easiest way to confirm. We&apos;ll reach out if
                we need anything else.
              </p>

              {/* Section 4: Additional */}
              <div className={styles.sectionLabel}>A Few More Details</div>

              <label>Do you accept day passes or drop-in visitors?</label>
              <select
                value={dayPass}
                onChange={(e) => setDayPass(e.target.value)}
              >
                <option value="Yes">Yes</option>
                <option value="No">No, members only</option>
                <option value="Sometimes">Case by case</option>
              </select>

              <label>Anything else?</label>
              <textarea
                placeholder="Tell us what makes your gym unique, or any questions you have..."
                value={gymNotes}
                onChange={(e) => setGymNotes(e.target.value)}
              />

              <button
                className={styles.submitBtn}
                disabled={loading}
                onClick={handleSubmit}
              >
                {loading ? "Submitting..." : "Submit Application"}
              </button>
              <p className={styles.formNote}>
                We review every application personally. Expect to hear from us
                within 24-48 hours.
              </p>
            </div>
          ) : (
            /* Success state */
            <div className={styles.success}>
              <div className={styles.successIcon}>&#10003;</div>
              <h3>Application received</h3>
              <p>
                We&apos;re reviewing your submission. You&apos;ll hear from us
                at the email you provided within 24-48 hours.
              </p>
              <div className={styles.nextSteps}>
                <h4>What happens next</h4>
                <ol>
                  <li>We verify your ownership documents</li>
                  <li>
                    Once approved, we email you a temporary passcode
                  </li>
                  <li>
                    Download GymRoam and sign in with your email + passcode
                  </li>
                  <li>
                    Set your own password and access your Partner Dashboard
                  </li>
                  <li>
                    We&apos;ll send a billing link for Gym Partner ({GYM_PARTNER_PRICE})
                  </li>
                </ol>
              </div>
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
