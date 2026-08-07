"use client";

import { useState } from "react";
import { Check, Gear, MapPin, ShieldCheck, TrendUp } from "@phosphor-icons/react/dist/ssr";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Toast from "@/components/Toast";
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
      const res = await fetch("/api/forms/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "gym",
          email: ownerEmail.trim().toLowerCase(),
          name: ownerName.trim(),
          doc: {
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
          },
          fields: [
            ["Gym", gymName.trim()],
            ["Type", gymType],
            ["Address", [gymAddress.trim(), gymCity.trim(), gymState.trim()].filter(Boolean).join(", ")],
            ["Gym phone", gymPhone.trim()],
            ["Website", gymWebsite.trim()],
            ["Instagram", gymInstagram.trim()],
            ["Owner", `${ownerName.trim()} (${ownerRole})`],
            ["Owner email", ownerEmail.trim()],
            ["Owner phone", ownerPhone.trim()],
            ["Ownership verification", verifyMethod.trim()],
            ["Day pass", dayPass],
            ["Notes", gymNotes.trim()],
          ] as [string, string][],
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error || `HTTP ${res.status}`);

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
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "5px 14px",
              borderRadius: 100,
              background: "rgba(232, 255, 60, 0.1)",
              border: "1px solid rgba(232, 255, 60, 0.18)",
              color: "var(--accent)",
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "1.8px",
              textTransform: "uppercase",
              marginBottom: 20,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--accent)",
                boxShadow: "0 0 10px var(--accent)",
              }}
            />
            Launching soon
          </div>
          <h1>
            Grow Your <span className={styles.accent}>Gym</span>
          </h1>
          <p>
            GymRoam sends travelers and locals to your door. Get listed, get
            seen, get booked. Add your gym to the launch list now &mdash;
            we&apos;ll reach out as we open partner slots in your city.
          </p>
          <p
            style={{
              fontSize: 13,
              color: "var(--dim)",
              marginTop: -24,
              marginBottom: 48,
            }}
          >
            No payment today &middot; pricing details shared at activation
          </p>
        </section>

        {/* Value props */}
        <section className={styles.values}>
          <div className={styles.valueCard}>
            <div className={styles.valueIcon}><MapPin size={20} weight="regular" /></div>
            <h3>Get discovered</h3>
            <p>
              Travelers search for gyms in your area daily. Your listing appears
              on their map with photos, details, and directions.
            </p>
          </div>
          <div className={styles.valueCard}>
            <div className={styles.valueIcon}><ShieldCheck size={20} weight="regular" /></div>
            <h3>Build trust</h3>
            <p>
              Verified Partner badge on your listing. Respond to reviews. Show
              visitors you&apos;re traveler-friendly.
            </p>
          </div>
          <div className={styles.valueCard}>
            <div className={styles.valueIcon}><TrendUp size={20} weight="regular" /></div>
            <h3>See your impact</h3>
            <p>
              Track how many people view your gym, save it, tap directions, and
              actually visit through GymRoam.
            </p>
          </div>
          <div className={styles.valueCard}>
            <div className={styles.valueIcon}><Gear size={20} weight="regular" /></div>
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
                title: "We add you to the launch list",
                desc: "We read every submission and prioritize early applicants when we open partner slots in your city.",
              },
              {
                num: 3,
                title: "We onboard you at launch",
                desc: "When we're ready in your area, we verify ownership and send you a passcode to sign into the GymRoam app as a verified partner.",
              },
              {
                num: 4,
                title: "Manage your listing",
                desc: "Set your own password, access your dashboard, update photos, hours, day-pass details, and start getting discovered.",
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
                {loading ? "Submitting..." : "Join the launch list"}
              </button>
              <p className={styles.formNote}>
                We read every submission. We&apos;ll reach out as we open
                slots in your city.
              </p>
            </div>
          ) : (
            /* Success state */
            <div className={styles.success}>
              <div className={styles.successIcon}><Check size={32} weight="bold" /></div>
              <h3>You&apos;re on the launch list</h3>
              <p>
                We&apos;re building toward launch and reading every
                submission. You&apos;ll hear from us at the email you
                provided as we open partner slots in your city.
              </p>
              <div className={styles.nextSteps}>
                <h4>What happens next</h4>
                <ol>
                  <li>We review your submission</li>
                  <li>We verify your ownership when we&apos;re ready to onboard you</li>
                  <li>
                    You&apos;ll receive a passcode to sign into the GymRoam app
                  </li>
                  <li>
                    Set your own password and access your Partner Dashboard
                  </li>
                  <li>
                    Pricing details shared at activation
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
