import Link from "next/link";
import styles from "./Logo.module.css";

export default function Logo() {
  return (
    <Link href="/" className={styles.logo}>
      <div className={styles.icon}>G</div>
      <span className={styles.text}>GYMROAM</span>
    </Link>
  );
}
