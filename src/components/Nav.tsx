"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  InstagramLogo,
  List,
  TiktokLogo,
  X,
  XLogo,
} from "@phosphor-icons/react/dist/ssr";
import Logo from "./Logo";
import { APP_STORE_URL } from "@/lib/app-store";
import styles from "./Nav.module.css";

export default function Nav() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className={styles.nav}>
      <div className={styles.inner}>
        <Logo />
        <ul className={`${styles.links} ${menuOpen ? styles.show : ""}`}>
          <li><Link href="/#features" onClick={() => setMenuOpen(false)}>Features</Link></li>
          <li><a href="mailto:support@gymroamapp.com" onClick={() => setMenuOpen(false)}>Contact</a></li>
          <li className={styles.socials}>
            <a
              href="https://instagram.com/gymroamapp"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className={styles.social}
            >
              <InstagramLogo size={20} weight="regular" />
            </a>
            <a
              href="https://tiktok.com/@gymroamapp"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="TikTok"
              className={styles.social}
            >
              <TiktokLogo size={20} weight="regular" />
            </a>
            <a
              href="https://x.com/gymroamapp"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="X"
              className={styles.social}
            >
              <XLogo size={20} weight="regular" />
            </a>
          </li>
          {/* Primary CTA — official Apple App Store badge linking to the
              live GymRoam iOS listing. Replaced the prior "Get Early
              Access" pill once the app shipped on the App Store. */}
          <li className={styles.ctaWrap}>
            <a
              href={APP_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMenuOpen(false)}
              className={styles.appStoreBadge}
              aria-label="Download GymRoam on the App Store"
            >
              <Image
                src="/app-store-badge.svg"
                alt="Download on the App Store"
                width={120}
                height={40}
                priority
              />
            </a>
          </li>
        </ul>
        <button
          className={styles.mobile}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X size={22} weight="regular" /> : <List size={22} weight="regular" />}
        </button>
      </div>
    </nav>
  );
}
