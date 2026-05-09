import Link from "next/link";
import Image from "next/image";
import styles from "./Logo.module.css";

/**
 * Brand mark used in the nav. Renders the GymRoam app icon (yellow
 * square + black G + dot) as an image, paired with the GYMROAM
 * wordmark.
 *
 * The icon image lives at /public/gymroam-logo.png — replace that
 * file to update the brand mark across the entire site nav.
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
