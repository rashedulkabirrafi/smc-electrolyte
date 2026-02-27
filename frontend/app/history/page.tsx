import dynamic from "next/dynamic";
import styles from "./history.module.css";

const HistoryClient = dynamic(() => import("./HistoryClient"), {
  ssr: false,
  loading: () => <div className={styles.mapPlaceholder}>Loading history tools...</div>,
});

export default function HistoryPage() {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Temperature & Humidity History (Last 10 Years)</h1>
      <p className={styles.subtitle}>
        Reanalysis-based daily weather history from Open-Meteo (ERA5/Copernicus), aggregated as the average across
        all mapped Bangladesh districts for long-term trend analysis.
      </p>
      <HistoryClient />
    </main>
  );
}
