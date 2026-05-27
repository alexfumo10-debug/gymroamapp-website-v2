/**
 * Footer — large branded footer with watermark text, centered logo, and
 * full nav. Adapted from the modem-animated-footer pattern to use our
 * Phosphor icon set + brand tokens (--bg, --text, --muted, --accent,
 * --border) via Tailwind v4 theme classes.
 *
 * Layout (top → bottom):
 *  1. "GymRoam" wordmark + product tagline
 *  2. Social icon row (Instagram, TikTok, X, email)
 *  3. Nav link row (all secondary pages, since none live in the top nav)
 *  4. Big "GYMROAM" watermark behind everything, fading bottom→transparent
 *  5. Centered G-icon card sitting on a soft divider line
 *  6. Copyright + "Powered by: AI Growth House LLC" link
 */

import Link from "next/link";
import Image from "next/image";
import {
  EnvelopeSimple,
  InstagramLogo,
  TiktokLogo,
  XLogo,
} from "@phosphor-icons/react/dist/ssr";

interface SocialLink {
  icon: React.ReactNode;
  href: string;
  label: string;
}

interface NavLink {
  label: string;
  href: string;
}

const SOCIAL_LINKS: SocialLink[] = [
  { icon: <InstagramLogo size={24} weight="regular" />, href: "https://instagram.com/gymroamapp", label: "Instagram" },
  { icon: <TiktokLogo size={24} weight="regular" />, href: "https://tiktok.com/@gymroamapp", label: "TikTok" },
  { icon: <XLogo size={24} weight="regular" />, href: "https://x.com/gymroamapp", label: "X" },
  { icon: <EnvelopeSimple size={24} weight="regular" />, href: "mailto:gymroamapp@gmail.com", label: "Email" },
];

const NAV_LINKS: NavLink[] = [
  { label: "Explore Gyms", href: "/search" },
  { label: "Trainers", href: "/trainer" },
  { label: "Grow Your Gym", href: "/grow" },
  { label: "Careers", href: "/careers" },
  { label: "Feedback", href: "/feedback" },
  { label: "Support", href: "/support" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <section className="relative w-full overflow-hidden">
      <footer className="border-t border-border bg-bg mt-20 relative">
        <div className="max-w-7xl mx-auto flex flex-col justify-between min-h-[37rem] sm:min-h-[44rem] md:min-h-[50rem] relative p-4 py-10">
          {/* Top block: brand, tagline, socials, nav */}
          <div className="flex flex-col mb-12 sm:mb-20 md:mb-0 w-full">
            <div className="w-full flex flex-col items-center">
              <div className="flex flex-col items-center flex-1 gap-3">
                {/* Headline echoes the hero — "Anywhere." gets the brand
                    glow so the footer feels like a bookend, not a reset. */}
                <h2 className="text-text text-3xl md:text-4xl font-extrabold tracking-tight text-center leading-tight m-0">
                  Find Your Sweat.
                  <br />
                  <span
                    className="text-accent"
                    style={{
                      textShadow:
                        "0 0 20px rgba(232, 255, 60, 0.32), 0 0 40px rgba(232, 255, 60, 0.15)",
                    }}
                  >
                    Anywhere.
                  </span>
                </h2>
                <p className="text-muted font-medium text-center w-full max-w-sm sm:w-96 px-4 sm:px-0 leading-relaxed">
                  Discover gyms, studios, and wellness centers wherever you travel.
                </p>
              </div>

              {/* Social icons */}
              <div className="flex mb-8 mt-6 gap-5">
                {SOCIAL_LINKS.map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    className="text-muted hover:text-accent transition-colors duration-200"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={link.label}
                  >
                    <div className="w-6 h-6 hover:scale-110 transition-transform duration-300">
                      {link.icon}
                    </div>
                  </Link>
                ))}
              </div>

              {/* Nav links. Uses `!` prefix on color utilities so they
                  win against the global `a { color: var(--accent) }`
                  rule in globals.css (layered utilities lose to
                  unlayered element rules without !important). */}
              <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm font-medium max-w-full px-4">
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    className="!text-text hover:!text-accent transition-colors duration-300"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom row: copyright + parent company */}
          <div className="mt-20 md:mt-24 flex flex-col gap-2 md:gap-1 items-center justify-center md:flex-row md:items-center md:justify-between px-4 md:px-0">
            <p className="text-sm text-text text-center md:text-left">
              © {year} GymRoam. All rights reserved.
            </p>
            <Link
              href="https://aigrowthhouse.com"
              target="_blank"
              rel="noopener noreferrer"
              className="!text-text hover:!text-accent text-sm transition-colors duration-300"
            >
              Powered by: AI Growth House LLC
            </Link>
          </div>
        </div>

        {/* Large background watermark text. Fades from accent-yellow at
            top to transparent at bottom for a "burned-in" feel.
            Sized to span ~90% of the viewport width at most sizes. */}
        <div
          className="absolute left-1/2 -translate-x-1/2 bottom-40 md:bottom-32 font-extrabold tracking-tighter pointer-events-none select-none text-center leading-none bg-gradient-to-b from-accent/14 via-accent/6 to-transparent bg-clip-text text-transparent whitespace-nowrap"
          style={{
            fontSize: "clamp(3rem, 18vw, 16rem)",
          }}
        >
          GYMROAM
        </div>

        {/* Centered G-icon card */}
        <div
          className="absolute bottom-24 md:bottom-20 left-1/2 -translate-x-1/2 z-10 backdrop-blur-sm rounded-3xl bg-bg/70 border-2 border-border flex items-center justify-center p-3"
          style={{
            filter: "drop-shadow(0 0 20px rgba(232, 255, 60, 0.35))",
          }}
        >
          <div className="w-12 sm:w-16 md:w-20 h-12 sm:h-16 md:h-20 rounded-2xl flex items-center justify-center shadow-lg overflow-hidden">
            <Image
              src="/gymroam-logo.png"
              alt="GymRoam"
              width={80}
              height={80}
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Horizontal divider line behind the logo card */}
        <div className="absolute bottom-32 sm:bottom-34 left-1/2 -translate-x-1/2 backdrop-blur-sm h-px bg-gradient-to-r from-transparent via-border to-transparent w-full" />

        {/* Bottom shadow gradient to fade content into the page */}
        <div className="absolute bottom-28 w-full h-24 pointer-events-none bg-gradient-to-t from-bg via-bg/80 to-bg/40 blur-[1em]" />
      </footer>
    </section>
  );
}
