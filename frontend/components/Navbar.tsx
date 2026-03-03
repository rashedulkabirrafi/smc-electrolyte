"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Navbar.module.css";

export default function Navbar() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <header className={styles.nav}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            HM
          </span>
          <span className={styles.brandCopy}>
            <span className={styles.brandTitle}>Heatwave Monitor</span>
            <span className={styles.brandSub}>Bangladesh district tracker</span>
          </span>
        </Link>
        <nav className={styles.links}>
          <Link
            href="/"
            className={`${styles.link} ${isHome ? styles.active : ""}`}
            aria-current={isHome ? "page" : undefined}
          >
            Home
          </Link>
        </nav>
      </div>
    </header>
  );
}
