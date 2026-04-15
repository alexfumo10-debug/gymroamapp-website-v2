"use client";

import { useState } from "react";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Toast from "@/components/Toast";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { MIN_INSTAGRAM_FOLLOWERS, TRAINER_PRO_PRICE } from "@/lib/subscription";
import styles from "./page.module.css";

export default function TrainerPage() {
  /* ── form fields ── */
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");

  const [instagramHandle, setInstagramHandle] = useState("");
  const [followerCount, setFollowerCount] = useState("");

  const [specialty, setSpecialty] = useState("Personal Trainer");
  const [certifications, setCertifications] = useState("");
  const [yearsExperience, setYearsExperience] = useState("1-3");
  const [bio, setBio] = useState("");

  const [offersDropIns, setOffersDropIns] = useState("Yes");
  const [rate, setRate] = useState("");
  const [websiteOrLink, setWebsiteOrLink] = useState("");
  const [notes, setNotes] = useState("");

  const [agree, setAgree] = useState(false);

  /* ── ui state ── */
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "" });

  function showToast(msg: string) {
    setToast({ show: true, message: msg });
  }

  function normalizeHandle(h: string) {
    const trimmed = h.trim().replace(/^@+/, "");
    return trimmed ? `@${trimmed}` : "";
  }

  async function handleSubmit() {
    /* required-fields check */
    if (
      !fullName.trim() ||
      !email.trim() ||
      !phone.trim() ||
      !city.trim() ||
      !country.trim() ||
      !instagramHandle.trim() ||
      !followerCount.trim() ||
      !bio.trim()
    ) {
      showToast("Please fill in all required fields");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      showToast("Please enter a valid email");
      return;
    }

    const followers = parseInt(followerCount.replace(/[^\d]/g, ""), 10);
    if (isNaN(followers) || followers < MIN_INSTAGRAM_FOLLOWERS) {
      showToast(
        `Trainers need at least ${MIN_INSTAGRAM_FOLLOWERS.toLocaleString()} Instagram followers`
      );
      return;
    }

    if (!agree) {
      showToast("Please confirm the trainer agreement");
      return;
    }

    setLoading(true);

    const handle = normalizeHandle(instagramHandle);

    try {
      await addDoc(collection(db, "trainerApplications"), {
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        city: city.trim(),
        country: country.trim(),
        instagramHandle: handle,
        followerCount: followers,
        specialty,
        certifications: certifications.trim(),
        yearsExperience,
        bio: bio.trim(),
        offersDropIns,
        rate: rate.trim(),
        websiteOrLink: websiteOrLink.trim(),
        notes: notes.trim(),
        status: "pending",
        instagramVerified: false,
        paymentStatus: "unpaid",
        createdAt: serverTimestamp(),
      });

      /* notification email to admin */
      await addDoc(collection(db, "mail"), {
        to: ["gymroamapp@gmail.com"],
        message: {
          subject: `New Trainer Application: ${fullName.trim()} (${handle})`,
          html: `
            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;background:#111114;color:#E8E8EE;padding:32px;border-radius:16px;border:1px solid #E8FF3C;">
              <h2 style="color:#E8FF3C;margin:0 0 24px;">New Trainer Application</h2>
              <h3 style="color:#8A8A99;font-size:12px;text-transform:uppercase;margin:0 0 8px;">Trainer</h3>
              <p style="margin:0 0 4px;"><strong>${fullName.trim()}</strong> — ${specialty}</p>
              <p style="margin:0 0 4px;">${email.trim()}</p>
              <p style="margin:0 0 4px;">${phone.trim()}</p>
              <p style="margin:0 0 16px;">${city.trim()}, ${country.trim()}</p>
              <h3 style="color:#8A8A99;font-size:12px;text-transform:uppercase;margin:0 0 8px;">Instagram (verify manually)</h3>
              <p style="margin:0 0 4px;">
                <a href="https://instagram.com/${handle.replace(/^@/, "")}" style="color:#E8FF3C;">${handle}</a>
                &nbsp;— <strong>claimed ${followers.toLocaleString()} followers</strong>
              </p>
              <p style="margin:0 0 16px;color:${followers >= MIN_INSTAGRAM_FOLLOWERS ? "#4ECDC4" : "#FF4D6D"};font-size:13px;">
                ${followers >= MIN_INSTAGRAM_FOLLOWERS ? "✓ Meets minimum" : "✗ Below minimum"}
              </p>
              <h3 style="color:#8A8A99;font-size:12px;text-transform:uppercase;margin:0 0 8px;">Experience</h3>
              <p style="margin:0 0 4px;"><strong>Years:</strong> ${yearsExperience}</p>
              ${certifications.trim() ? `<p style="margin:0 0 4px;"><strong>Certs:</strong> ${certifications.trim()}</p>` : ""}
              <p style="margin:0 0 16px;"><strong>Bio:</strong> ${bio.trim()}</p>
              <h3 style="color:#8A8A99;font-size:12px;text-transform:uppercase;margin:0 0 8px;">Services</h3>
              <p style="margin:0 0 4px;"><strong>Drop-ins:</strong> ${offersDropIns}</p>
              ${rate.trim() ? `<p style="margin:0 0 4px;"><strong>Rate:</strong> ${rate.trim()}</p>` : ""}
              ${websiteOrLink.trim() ? `<p style="margin:0 0 4px;"><strong>Link:</strong> ${websiteOrLink.trim()}</p>` : ""}
              ${notes.trim() ? `<p style="margin:16px 0 0;"><strong>Notes:</strong> ${notes.trim()}</p>` : ""}
            </div>
          `,
        },
      });

      /* confirmation email to applicant */
      await addDoc(collection(db, "mail"), {
        to: [email.trim().toLowerCase()],
        message: {
          subject: "GymRoam — Your trainer application is in review",
          html: `
            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;background:#111114;color:#E8E8EE;padding:32px;border-radius:16px;border:1px solid #1F1F26;">
              <div style="text-align:center;margin-bottom:24px;">
                <div style="display:inline-block;width:40px;height:40px;background:#E8FF3C;border-radius:10px;line-height:40px;font-weight:900;font-size:20px;color:#0A0A0B;">G</div>
              </div>
              <h2 style="text-align:center;margin:0 0 8px;font-size:22px;">Application Received</h2>
              <p style="text-align:center;color:#8A8A99;margin:0 0 24px;font-size:14px;">Thanks for applying, ${fullName.trim()}.</p>
              <div style="background:#18181D;border-radius:12px;padding:20px;margin-bottom:24px;">
                <p style="margin:0 0 4px;font-weight:700;">${specialty}</p>
                <p style="margin:0;color:#8A8A99;font-size:13px;">${handle} &middot; ${city.trim()}</p>
              </div>
              <h3 style="font-size:13px;color:#8A8A99;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">What happens next</h3>
              <ol style="color:#8A8A99;font-size:14px;line-height:1.7;padding-left:20px;margin:0 0 24px;">
                <li>We verify your Instagram account and follower count</li>
                <li>You'll hear back within <strong style="color:#E8E8EE;">24-48 hours</strong></li>
                <li>If approved, we email a passcode to sign into the GymRoam app</li>
                <li>Subscribe to Trainer Pro (${TRAINER_PRO_PRICE}) through Apple — one tap with Face ID</li>
              </ol>
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

  /* ── render ── */
  return (
    <>
      <Nav />

      <main>
        {/* Hero */}
        <section className={styles.hero}>
          <div className={styles.tag}>Trainer Pro &middot; {TRAINER_PRO_PRICE}</div>
          <h1>
            Train travelers <span className={styles.accent}>anywhere</span>
          </h1>
          <p>
            Get discovered by travelers in your city. Post drop-in offers,
            share your schedule, and receive messages from clients looking for
            a session.
          </p>
        </section>

        {/* Value props */}
        <section className={styles.values}>
          <div className={styles.valueCard}>
            <h3>Get discovered</h3>
            <p>
              Verified trainer profile surfaces for travelers searching in your
              city. Your bio, rate, and Instagram — one tap away.
            </p>
          </div>
          <div className={styles.valueCard}>
            <h3>Post promotions</h3>
            <p>
              Drop-in sessions, intro packages, class schedule. Promotions
              expire automatically so your profile always feels fresh.
            </p>
          </div>
          <div className={styles.valueCard}>
            <h3>Direct messages</h3>
            <p>
              Travelers message you directly through GymRoam. Reply from the
              app, lock in the booking, done.
            </p>
          </div>
          <div className={styles.valueCard}>
            <h3>Verified badge</h3>
            <p>
              Approved trainers get the verified badge — proof you&apos;re a
              real coach with a real following.
            </p>
          </div>
        </section>

        <div className={styles.divider} />

        {/* Requirements */}
        <section className={styles.how}>
          <h2>Requirements</h2>
          <div className={styles.reqCard}>
            <div className={styles.reqRow}>
              <div className={styles.reqCheck}>&#10003;</div>
              <div>
                <h4>
                  {MIN_INSTAGRAM_FOLLOWERS.toLocaleString()}+ Instagram followers
                </h4>
                <p>
                  We verify every trainer on Instagram to protect travelers
                  from fake profiles. Your account must be public and active.
                </p>
              </div>
            </div>
            <div className={styles.reqRow}>
              <div className={styles.reqCheck}>&#10003;</div>
              <div>
                <h4>Certification or proven experience</h4>
                <p>
                  NASM, ACE, RYT, CrossFit, or equivalent. Uncertified trainers
                  with a strong track record are welcome too — tell us your
                  story.
                </p>
              </div>
            </div>
            <div className={styles.reqRow}>
              <div className={styles.reqCheck}>&#10003;</div>
              <div>
                <h4>Trainer Pro subscription</h4>
                <p>
                  {TRAINER_PRO_PRICE}, billed through Apple. Cancel anytime
                  from your iPhone settings. You only subscribe after
                  we approve you and you&apos;re inside the app.
                </p>
              </div>
            </div>
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
                title: "Apply",
                desc: "Tell us about yourself, your Instagram, and how you coach. Takes 5 minutes.",
              },
              {
                num: 2,
                title: "We verify",
                desc: "We check your Instagram, follower count, and certs. Usually 24-48 hours.",
              },
              {
                num: 3,
                title: "Sign in",
                desc: "Passcode arrives by email. Download GymRoam, sign in, set your password.",
              },
              {
                num: 4,
                title: "Subscribe in-app",
                desc: `Tap subscribe, confirm with Face ID. ${TRAINER_PRO_PRICE} through Apple. Profile goes live instantly.`,
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
          <h2>Trainer Application</h2>
          <p>
            All fields marked <span className={styles.required}>*</span> are
            required.
          </p>

          {!submitted ? (
            <div className={styles.formCard}>
              {/* Section 1: You */}
              <div className={styles.sectionLabelFirst}>Your Information</div>

              <div className={styles.formRow}>
                <div>
                  <label>
                    Full Name <span className={styles.required}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Alex Rivera"
                    maxLength={100}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
                <div>
                  <label>
                    Email <span className={styles.required}>*</span>
                  </label>
                  <input
                    type="email"
                    placeholder="you@email.com"
                    maxLength={150}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <div>
                  <label>
                    Phone <span className={styles.required}>*</span>
                  </label>
                  <input
                    type="tel"
                    placeholder="+1 (555) 123-4567"
                    maxLength={20}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div>
                  <label>
                    Specialty <span className={styles.required}>*</span>
                  </label>
                  <select
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                  >
                    <option value="Personal Trainer">Personal Trainer</option>
                    <option value="Yoga Instructor">Yoga Instructor</option>
                    <option value="Pilates Instructor">Pilates Instructor</option>
                    <option value="CrossFit Coach">CrossFit Coach</option>
                    <option value="Boxing Coach">Boxing Coach</option>
                    <option value="Strength & Conditioning">
                      Strength & Conditioning
                    </option>
                    <option value="Run Coach">Run Coach</option>
                    <option value="Mobility / Recovery">
                      Mobility / Recovery
                    </option>
                    <option value="Nutrition Coach">Nutrition Coach</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className={styles.formRow}>
                <div>
                  <label>
                    City <span className={styles.required}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Miami"
                    maxLength={100}
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </div>
                <div>
                  <label>
                    Country <span className={styles.required}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="USA"
                    maxLength={100}
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                  />
                </div>
              </div>

              {/* Section 2: Instagram verification */}
              <div className={styles.sectionLabel}>
                Instagram Verification
              </div>

              <p className={styles.helper} style={{ marginTop: 0 }}>
                We verify every trainer on Instagram. You need at least{" "}
                <strong>{MIN_INSTAGRAM_FOLLOWERS.toLocaleString()}</strong>{" "}
                followers and a public account.
              </p>

              <div className={styles.formRow}>
                <div>
                  <label>
                    Instagram Handle <span className={styles.required}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="@yourhandle"
                    maxLength={60}
                    value={instagramHandle}
                    onChange={(e) => setInstagramHandle(e.target.value)}
                  />
                </div>
                <div>
                  <label>
                    Follower Count <span className={styles.required}>*</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder={`${MIN_INSTAGRAM_FOLLOWERS}+`}
                    maxLength={10}
                    value={followerCount}
                    onChange={(e) =>
                      setFollowerCount(e.target.value.replace(/[^\d,]/g, ""))
                    }
                  />
                </div>
              </div>

              {/* Section 3: Experience */}
              <div className={styles.sectionLabel}>Experience</div>

              <div className={styles.formRow}>
                <div>
                  <label>
                    Years Experience <span className={styles.required}>*</span>
                  </label>
                  <select
                    value={yearsExperience}
                    onChange={(e) => setYearsExperience(e.target.value)}
                  >
                    <option value="0-1">Less than 1 year</option>
                    <option value="1-3">1-3 years</option>
                    <option value="3-5">3-5 years</option>
                    <option value="5-10">5-10 years</option>
                    <option value="10+">10+ years</option>
                  </select>
                </div>
                <div>
                  <label>Certifications</label>
                  <input
                    type="text"
                    placeholder="NASM, ACE, RYT-200..."
                    maxLength={200}
                    value={certifications}
                    onChange={(e) => setCertifications(e.target.value)}
                  />
                </div>
              </div>

              <label>
                Short Bio <span className={styles.required}>*</span>
              </label>
              <textarea
                placeholder="A few sentences on your approach, style, and who you love training."
                maxLength={500}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
              <p className={styles.helper}>
                Travelers see this on your profile. Max 500 characters.
              </p>

              {/* Section 4: Services */}
              <div className={styles.sectionLabel}>Services</div>

              <div className={styles.formRow}>
                <div>
                  <label>Offer drop-in sessions?</label>
                  <select
                    value={offersDropIns}
                    onChange={(e) => setOffersDropIns(e.target.value)}
                  >
                    <option value="Yes">Yes</option>
                    <option value="No">No, packages only</option>
                    <option value="Sometimes">Case by case</option>
                  </select>
                </div>
                <div>
                  <label>Typical Rate</label>
                  <input
                    type="text"
                    placeholder="$80/session"
                    maxLength={50}
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                  />
                </div>
              </div>

              <label>Website or booking link</label>
              <input
                type="text"
                placeholder="trainerwithme.com"
                maxLength={200}
                value={websiteOrLink}
                onChange={(e) => setWebsiteOrLink(e.target.value)}
              />

              <label>Anything else?</label>
              <textarea
                placeholder="Questions, the gym you train out of, languages spoken..."
                maxLength={500}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />

              {/* Agreement */}
              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                />
                <span>
                  I understand Trainer Pro costs {TRAINER_PRO_PRICE} through
                  Apple after approval, and I confirm my Instagram is public
                  with at least {MIN_INSTAGRAM_FOLLOWERS.toLocaleString()}{" "}
                  followers.
                </span>
              </label>

              <button
                className={styles.submitBtn}
                disabled={loading}
                onClick={handleSubmit}
              >
                {loading ? "Submitting..." : "Submit Application"}
              </button>
              <p className={styles.formNote}>
                No payment today. Subscribe inside the GymRoam app after
                you&apos;re approved — billed through Apple.
              </p>
            </div>
          ) : (
            /* Success state */
            <div className={styles.success}>
              <div className={styles.successIcon}>&#10003;</div>
              <h3>Application received</h3>
              <p>
                We&apos;re verifying your Instagram and reviewing your
                application. Expect to hear back within 24-48 hours.
              </p>
              <div className={styles.nextSteps}>
                <h4>What happens next</h4>
                <ol>
                  <li>We verify your Instagram account and follower count</li>
                  <li>If approved, we email a temporary passcode</li>
                  <li>
                    Download GymRoam, sign in, subscribe via Apple (
                    {TRAINER_PRO_PRICE})
                  </li>
                  <li>Your trainer profile goes live instantly</li>
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
