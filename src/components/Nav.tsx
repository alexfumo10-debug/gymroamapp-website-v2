"use client";

import { useState } from "react";
import Link from "next/link";
import {
  InstagramLogo,
  List,
  TiktokLogo,
  X,
  XLogo,
} from "@phosphor-icons/react/dist/ssr";
import Logo from "./Logo";
import { HoverBorderGradient } from "./ui/hover-border-gradient";
import styles from "./Nav.module.css";

export default function Nav() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className={styles.nav}>
      <div className={styles.inner}>
        <Logo />
        <ul className={`${styles.links} ${menuOpen ? styles.show : ""}`}>
          <li><Link href="/#features" onClick={() => setMenuOpen(false)}>Features</Link></li>
          <li><a href="mailto:gymroamapp@gmail.com" onClick={() => setMenuOpen(false)}>Contact</a></li>
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
          <li className={styles.ctaWrap}>
            <HoverBorderGradient
              as={Link}
              href="/#top"
              onClick={() => setMenuOpen(false)}
              duration={1.2}
            >
              Get Early Access
            </HoverBorderGradient>
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
