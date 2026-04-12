import Link from "next/link";
import Logo from "./Logo";
import styles from "./Footer.module.css";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div>
          <Logo />
        </div>
        <div className={styles.links}>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/grow">Grow Your Gym</Link>
          <Link href="/feedback">Feedback</Link>
          <a href="mailto:gymroamapp@gmail.com">Contact</a>
          <a href="https://instagram.com/gymroamapp" target="_blank" rel="noopener noreferrer">Instagram</a>
        </div>
      </div>
      <div className={styles.bottom}>
        <span>&copy; 2026 GymRoam</span>
        <span>
          <a href="https://levestudios.com" target="_blank" rel="noopener noreferrer">
            Leve AI Studios
          </a>{" "}
          Company
        </span>
      </div>
    </footer>
  );
}
