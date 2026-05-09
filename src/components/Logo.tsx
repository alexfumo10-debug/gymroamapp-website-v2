import Link from "next/link";
import Image from "next/image";
import styles from "./Logo.module.css";

/**
 * Brand mark used in the nav. Renders the GymRoam app icon (yellow
 * rounded square + black G + dot) from /public/gymroam-logo.png,
 * paired with the GYMROAM wordmark.
 *
 * To update the brand mark site-wide, replace
 * /public/gymroam-logo.png — favicon and apple-touch-icon point at
 * the same file (see app/layout.tsx).
 */
export default function Logo() {
  return (
    <Link href="/" className={styles.logo} aria-label="GymRoam home">
      <Image
        src="/gymroam-logo.png"
        alt="GymRoam"
        width={32}
        height={32}
        className={styles.icon}
        priority
      />
      <span className={styles.text}>GYMROAM</span>
    </Link>
  );
}
