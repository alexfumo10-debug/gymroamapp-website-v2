/**
 * Terms of Service — static legal page.
 *
 * Initial draft authored alongside the Privacy Policy. Should be
 * reviewed by counsel before formal launch, especially the Governing
 * Law clause (currently set to Georgia, Fulton County — adjust if
 * AI Growth House LLC's principal place of business moves).
 *
 * Server component — no interactivity. Indexable.
 */

import type { Metadata } from "next";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Terms of Service | GymRoam",
  description:
    "The terms under which you may use the GymRoam website and app.",
  alternates: { canonical: "https://gymroamapp.com/terms" },
  openGraph: {
    title: "Terms of Service | GymRoam",
    description:
      "The terms under which you may use the GymRoam website and app.",
    url: "https://gymroamapp.com/terms",
    type: "website",
  },
};

export default function TermsPage() {
  return (
    <>
      <Nav />
      <main className={styles.page}>
        <div className={styles.container}>
          <h1>Terms of Service</h1>
          <p className={styles.subtitle}>
            GymRoam &mdash; Last updated: May 16, 2026
          </p>

          <p>
            These Terms of Service (&ldquo;Terms&rdquo;) govern your access
            to and use of the GymRoam website at{" "}
            <a href="https://gymroamapp.com">gymroamapp.com</a>, the GymRoam
            mobile application, and any related services (collectively, the
            &ldquo;Service&rdquo;) provided by AI Growth House LLC
            (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;). By
            using the Service, you agree to be bound by these Terms.
          </p>

          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing or using the Service, you confirm that you have
            read, understood, and agree to be bound by these Terms and our{" "}
            <a href="/privacy">Privacy Policy</a>. If you do not agree, do
            not use the Service.
          </p>

          <h2>2. About the Service</h2>
          <p>
            GymRoam helps people discover gyms, fitness studios, and
            wellness centers wherever they travel or live. The Service
            includes a mobile app (available on the Apple App Store), a
            marketing website with city-level discovery pages, and
            submission forms for prospective gym partners, trainers, and
            team members.
          </p>
          <p>
            We continue to evolve the Service. Features described on the
            website or in the app may change or be removed in the
            ordinary course of product development.
          </p>

          <h2>3. Eligibility</h2>
          <p>
            You must be at least 13 years old to use the Service. By using
            the Service, you represent and warrant that you meet this
            requirement. If you are under 18, you confirm that you have a
            parent or legal guardian&apos;s permission to use the Service.
          </p>

          <h2>4. Accounts, Submissions, and Communications</h2>
          <p>
            Some parts of the Service require you to provide information
            (for example, an email address, details about your gym,
            trainer practice, or job application, or information you
            provide while using your account in the mobile app). You
            agree to provide accurate information and to keep it current.
            You are responsible for activity that occurs through your
            submissions or your account.
          </p>
          <p>
            By submitting an email or contact information, you consent to
            receive transactional and product-related communications from
            us. You can opt out of marketing emails at any time.
          </p>

          <h2>5. Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul>
            <li>
              Use the Service for any unlawful purpose or in violation of
              any applicable law or regulation;
            </li>
            <li>
              Submit false, misleading, or fraudulent information (for
              example, fake gym listings, false credentials, or impersonated
              applications);
            </li>
            <li>
              Attempt to interfere with, disrupt, or compromise the
              security or integrity of the Service, including by scraping,
              automated querying, or denial-of-service attempts;
            </li>
            <li>
              Reverse engineer, decompile, or attempt to extract source
              code from the Service except where permitted by law;
            </li>
            <li>
              Harass, abuse, or harm any other user, partner, or member of
              our team;
            </li>
            <li>
              Use the Service to send unsolicited promotional material,
              spam, or chain communications.
            </li>
          </ul>

          <h2>6. User Content and Feedback</h2>
          <p>
            You retain ownership of the content you submit to the Service
            (for example, gym descriptions, trainer bios, photos, feature
            requests, and application materials). By submitting content,
            you grant AI Growth House LLC a worldwide, non-exclusive,
            royalty-free license to host, store, display, reproduce, and
            distribute that content for the purpose of operating and
            promoting the Service.
          </p>
          <p>
            Feature requests, ideas, and suggestions you submit may be used
            by us without obligation or compensation. You represent that
            you have the rights necessary to submit any content you upload
            and that it does not infringe on the rights of any third party.
          </p>

          <h2>7. Partner Listings and Trainer Profiles</h2>
          <p>
            Submitting a gym partner application or trainer profile does
            not guarantee that you will be listed in the Service. We
            reserve the right to decline, modify, or remove any submission
            at our discretion, including for inaccuracy, brand
            misalignment, or violation of these Terms.
          </p>
          <p>
            Any pricing, drop-in pass, or promotional information shown on
            the Service may be illustrative. Final pricing terms for
            partner listings will be communicated directly during
            onboarding.
          </p>

          <h2>8. Intellectual Property</h2>
          <p>
            The Service, including its design, code, branding, copy, and
            content (excluding user-submitted content), is owned by AI
            Growth House LLC and is protected by U.S. and international
            copyright, trademark, and other intellectual property laws.
            &ldquo;GymRoam&rdquo; and associated marks are trademarks of
            AI Growth House LLC.
          </p>
          <p>
            Third-party trademarks, including gym brand names that may
            appear in illustrative content, are the property of their
            respective owners and are used for reference only.
          </p>

          <h2>9. Third-Party Services</h2>
          <p>
            The Service relies on third-party providers to function,
            including Firebase (Google), Stripe, EmailJS, and mapping
            services. Your use of those features is also governed by the
            providers&apos; respective terms. We are not responsible for
            the practices or content of any third party.
          </p>

          <h2>10. Disclaimers</h2>
          <p>
            The Service is provided &ldquo;as is&rdquo; and &ldquo;as
            available&rdquo; without warranties of any kind, express or
            implied. We do not warrant that the Service will be
            uninterrupted, error-free, accurate, or secure, or that gym
            listings, pricing, hours, or contact information are complete
            or current.
          </p>
          <p>
            We do not operate the gyms, studios, or wellness centers shown
            in the Service. Your use of any third-party fitness facility
            is at your own risk, and you are responsible for assessing the
            suitability of any facility, instructor, or program before
            participating.
          </p>

          <h2>11. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, AI Growth House LLC,
            its officers, employees, and contractors will not be liable
            for any indirect, incidental, special, consequential, or
            punitive damages, or for any loss of profits, revenue, data,
            or goodwill, arising out of or in connection with your use of
            the Service. Our total aggregate liability for any claim
            related to the Service will not exceed the greater of
            one hundred U.S. dollars ($100) or the amount you paid us in
            the twelve months preceding the claim.
          </p>

          <h2>12. Indemnification</h2>
          <p>
            You agree to indemnify and hold harmless AI Growth House LLC
            and its team from any claim, loss, or expense arising out of
            your use of the Service, your content, or your breach of these
            Terms.
          </p>

          <h2>13. Termination</h2>
          <p>
            We may suspend or terminate your access to the Service at any
            time, with or without notice, for any reason, including if we
            believe you have violated these Terms. You may stop using the
            Service at any time. Sections that by their nature should
            survive termination will continue to apply.
          </p>

          <h2>14. Changes to These Terms</h2>
          <p>
            We may update these Terms from time to time. Material changes
            will be reflected by updating the &ldquo;Last updated&rdquo;
            date above and, where appropriate, by notice through the
            Service. Your continued use of the Service after changes
            become effective constitutes acceptance of the revised Terms.
          </p>

          <h2>15. Governing Law and Disputes</h2>
          <p>
            These Terms are governed by the laws of the State of Georgia,
            without regard to its conflict-of-laws principles. You agree
            that any dispute arising out of or relating to these Terms or
            the Service will be resolved exclusively in the state or
            federal courts located in Fulton County, Georgia, and you
            consent to the personal jurisdiction of those courts. Nothing
            in this section limits any right you may have under mandatory
            local consumer-protection law.
          </p>

          <h2>16. Contact</h2>
          <p>
            Questions about these Terms? Email us at:
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
