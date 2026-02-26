import dynamic from "next/dynamic";
import styles from "./home.module.css";

const HomeMapClient = dynamic(() => import("./HomeMapClient"), {
  ssr: false,
  loading: () => <div className={styles.mapPlaceholder}>Loading map...</div>,
});

export default function HomePage() {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Bangladesh Heatwave / Heatstroke Monitor</h1>
      <p className={styles.subtitle}>
        Interactive district boundary map (GADM Level 2). Hover for district name and click to inspect.
      </p>
      <HomeMapClient />
    </main>
  );
}
