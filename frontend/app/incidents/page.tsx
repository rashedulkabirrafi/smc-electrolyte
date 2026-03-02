import dynamic from "next/dynamic";
import IncidentTable from "./IncidentTable";
import styles from "./incidents.module.css";

const IncidentMap = dynamic(() => import("./IncidentMap"), {
  ssr: false,
});

type IncidentsPageProps = {
  searchParams?: {
    district?: string | string[];
  };
};

export default function IncidentsPage({ searchParams }: IncidentsPageProps) {
  const districtParam = searchParams?.district;
  const initialDistrict =
    typeof districtParam === "string" ? districtParam : Array.isArray(districtParam) ? districtParam[0] || "" : "";

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Heatstroke Incidents (News Reports)</h1>
      <p className={styles.subtitle}>
        Verified incident list from <code>/public/data</code>, sourced from direct newspaper links. Current
        source-backed coverage in this dataset spans 2016 to 2024.
      </p>
      <IncidentMap />
      <IncidentTable initialDistrict={initialDistrict} />
    </main>
  );
}
