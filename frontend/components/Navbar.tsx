"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Navbar.module.css";

export default function Navbar() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const isIncidents = pathname.startsWith("/incidents");
  const isHistory = pathname.startsWith("/history");

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
          <Link
            href="/incidents"
            className={`${styles.link} ${isIncidents ? styles.active : ""}`}
            aria-current={isIncidents ? "page" : undefined}
          >
            Incidents
          </Link>
          <Link
            href="/history"
            className={`${styles.link} ${isHistory ? styles.active : ""}`}
            aria-current={isHistory ? "page" : undefined}
          >
            History
          </Link>
        </nav>
      </div>
    </header>
  );
}
