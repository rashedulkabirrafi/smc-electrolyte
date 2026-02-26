import Link from "next/link";
import dynamic from "next/dynamic";
import { notFound } from "next/navigation";

type Incident = {
  id: string;
  date_occurred: string | null;
  date_published: string | null;
  district: string | null;
  upazila: string | null;
  district_code: string | null;
  deaths: number | null;
  injured: number | null;
  source_name: string | null;
  source_url: string | null;
  headline: string | null;
  place: string | null;
  lat: number | null;
  lon: number | null;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

const IncidentDetailMap = dynamic(() => import("../../../components/incident-detail-map"), {
  ssr: false,
});

async function fetchIncident(id: string): Promise<Incident | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/incidents/${id}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as Incident;
  } catch {
    return null;
  }
}

export default async function IncidentDetailPage({ params }: { params: { id: string } }) {
  const incident = await fetchIncident(params.id);
  if (!incident) {
    notFound();
  }

  const place = incident.upazila
    ? `${incident.district}, ${incident.upazila}`
    : incident.district || incident.place || "N/A";
  const eventDate = incident.date_occurred || incident.date_published || "N/A";

  return (
    <main>
      <section className="card incidents-shell">
        <div className="detail-header">
          <div>
            <p className="muted-label">Incident ID</p>
            <h1 style={{ marginTop: 0 }}>{incident.id}</h1>
          </div>
          <Link href="/incidents" className="btn">
            Back to Incidents
          </Link>
        </div>

        <h2 style={{ marginTop: "0.25rem" }}>{incident.headline || "Heat-related incident"}</h2>

        <div className="detail-grid">
          <div>
            <p><strong>Date occurred:</strong> {incident.date_occurred || "-"}</p>
            <p><strong>Date published:</strong> {incident.date_published || "-"}</p>
            <p><strong>Display date:</strong> {eventDate}</p>
            <p><strong>Place:</strong> {place}</p>
          </div>
          <div>
            <p><strong>Deaths:</strong> {incident.deaths ?? "-"}</p>
            <p><strong>Injured/Hospitalized:</strong> {incident.injured ?? "-"}</p>
            <p><strong>District:</strong> {incident.district || "-"}</p>
            <p><strong>Upazila:</strong> {incident.upazila || "-"}</p>
          </div>
          <div>
            <p><strong>Source:</strong> {incident.source_name || "-"}</p>
            <p>
              <strong>Source URL:</strong>{" "}
              {incident.source_url ? (
                <a href={incident.source_url} target="_blank" rel="noreferrer">
                  {incident.source_url}
                </a>
              ) : (
                "-"
              )}
            </p>
            <p><strong>Latitude:</strong> {incident.lat ?? "-"}</p>
            <p><strong>Longitude:</strong> {incident.lon ?? "-"}</p>
          </div>
        </div>

        <h3 style={{ marginBottom: "0.35rem" }}>Location</h3>
        <p style={{ color: "#64748b", marginTop: 0 }}>
          {incident.lat !== null && incident.lon !== null
            ? "Marker shows incident coordinates."
            : "District boundary highlight shown when coordinates are not available."}
        </p>

        <IncidentDetailMap
          lat={incident.lat}
          lon={incident.lon}
          districtCode={incident.district_code}
          title={incident.headline || incident.id}
        />
      </section>
    </main>
  );
}
