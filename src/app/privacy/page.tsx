/**
 * Privacy Policy — static legal page.
 *
 * Ported verbatim from the prior GitHub Pages copy
 * (alexfumo10-debug.github.io/gymroam-privacy), with the controlling
 * entity set to "AI Growth House LLC" — the operating entity for
 * GymRoam (formerly AI Growth House LLC; same LLC, renamed).
 *
 * Server component — no interactivity. Indexable.
 */

import type { Metadata } from "next";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Privacy Policy | GymRoam",
  description:
    "How GymRoam collects, uses, and protects your information when you use the app.",
  alternates: { canonical: "https://gymroamapp.com/privacy" },
  openGraph: {
    title: "Privacy Policy | GymRoam",
    description:
      "How GymRoam collects, uses, and protects your information when you use the app.",
    url: "https://gymroamapp.com/privacy",
    type: "website",
  },
};

export default function PrivacyPage() {
  return (
    <>
      <Nav />
      <main className={styles.page}>
        <div className={styles.container}>
          <h1>Privacy Policy</h1>
          <p className={styles.subtitle}>
            GymRoam &mdash; Last updated: March 27, 2026
          </p>

          <p>
            AI Growth House LLC (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or
            &ldquo;us&rdquo;) built GymRoam as a commercial application. This
            Privacy Policy explains how we collect, use, and protect your
            information when you use our app.
          </p>

          <h2>1. Information We Collect</h2>
          <p>
            <strong>Account Information:</strong> When you create an account, we
            collect your email address, display name, and username. If you sign
            in with Apple, we receive the information you choose to share.
          </p>
          <p>
            <strong>Location Data:</strong> With your permission, we access your
            device&apos;s location to show nearby gyms and fitness centers.
            Location data is used in real-time and is not stored on our servers.
          </p>
          <p>
            <strong>Profile Information:</strong> You may optionally provide a
            profile photo, fitness preferences, and traveler type. This
            information is stored in your account.
          </p>
          <p>
            <strong>Usage Data:</strong> We collect general usage data such as
            which features you use, gyms you view, and interactions within the
            app to improve the experience.
          </p>

          <h2>2. How We Use Your Information</h2>
          <ul>
            <li>To provide and maintain the app&apos;s core functionality</li>
            <li>
              To show you relevant gyms and fitness centers near your location
            </li>
            <li>To enable social features (friends, activity feed, likes)</li>
            <li>To personalize your experience based on your preferences</li>
            <li>To improve and optimize the app</li>
          </ul>

          <h2>3. Third-Party Services</h2>
          <p>GymRoam uses the following third-party services:</p>
          <ul>
            <li>
              <strong>Firebase (Google):</strong> For authentication and data
              storage. See{" "}
              <a
                href="https://firebase.google.com/support/privacy"
                target="_blank"
                rel="noopener noreferrer"
              >
                Firebase Privacy Policy
              </a>
              .
            </li>
            <li>
              <strong>Google Places API:</strong> To fetch gym photos and place
              information. See{" "}
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google Privacy Policy
              </a>
              .
            </li>
            <li>
              <strong>Apple MapKit:</strong> To search for and display fitness
              locations. See{" "}
              <a
                href="https://www.apple.com/legal/privacy/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Apple Privacy Policy
              </a>
              .
            </li>
          </ul>

          <h2>4. Data Storage and Security</h2>
          <p>
            Your data is stored securely using Firebase Cloud Firestore with
            authentication-based access controls. Only you can access and modify
            your personal data. We implement industry-standard security measures
            to protect your information.
          </p>

          <h2>5. Data Sharing</h2>
          <p>
            We do not sell, trade, or rent your personal information to third
            parties. Your profile information (name, username) may be visible to
            other GymRoam users for social features such as friend search and
            activity feeds.
          </p>

          <h2>6. Your Rights</h2>
          <p>You can:</p>
          <ul>
            <li>
              Access and update your personal information through the app&apos;s
              Profile settings
            </li>
            <li>
              Delete your account and all associated data by contacting us
            </li>
            <li>
              Revoke location permissions at any time through your device
              settings
            </li>
            <li>Opt out of notifications through the app or device settings</li>
          </ul>

          <h2>7. Children&apos;s Privacy</h2>
          <p>
            GymRoam is not intended for children under the age of 13. We do not
            knowingly collect personal information from children under 13.
          </p>

          <h2>8. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify
            you of any changes by posting the new policy within the app and
            updating the &ldquo;Last updated&rdquo; date above.
          </p>

          <h2>9. Contact Us</h2>
          <p>
            If you have any questions about this Privacy Policy or your data,
            contact us at:
          </p>
          <p>
            <strong>Email:</strong>{" "}
            <a href="mailto:gymroamapp@gmail.com">gymroamapp@gmail.com</a>
          </p>

          <div className={styles.footerNote}>
            <p>&copy; 2026 AI Growth House LLC. All rights reserved.</p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
