"use client";

import { useState } from "react";
import Link from "next/link";
import Logo from "./Logo";
import styles from "./Nav.module.css";

export default function Nav() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className={styles.nav}>
      <div className={styles.inner}>
        <Logo />
        <ul className={`${styles.links} ${menuOpen ? styles.show : ""}`}>
          <li><Link href="/#features">Features</Link></li>
          <li><Link href="/#trainers">Trainers</Link></li>
          <li><Link href="/grow">Grow Your Gym</Link></li>
          <li><Link href="/feedback">Feedback</Link></li>
          <li><a href="mailto:gymroamapp@gmail.com">Contact</a></li>
          <li>
            <a
              href="https://instagram.com/gymroamapp"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className={styles.ig}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
              </svg>
            </a>
          </li>
          <li><Link href="/#top" className={styles.cta}>Download</Link></li>
        </ul>
        <button
          className={styles.mobile}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Menu"
        >
          &#9776;
        </button>
      </div>
    </nav>
  );
}
