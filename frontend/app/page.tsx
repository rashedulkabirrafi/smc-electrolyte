import AnalysisDashboard from "../components/analysis-dashboard";
import MapWrapper from "../components/map-wrapper";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

type Hotspot = {
  district_code: string;
  district_name: string;
  tmax_c: number;
  intensity_category: string;
};

type HeatwaveSummary = {
  as_of_date?: string;
  district_hotspots?: Hotspot[];
};

const intensityColor: Record<string, string> = {
  extreme: "#dc2626",
  high: "#fb923c",
  watch: "#d97706",
  none: "#9ca3af",
};

export default async function Home() {
  let health = "unreachable";
  let summary: HeatwaveSummary = {};
  try {
    const [healthRes, summaryRes] = await Promise.all([
      fetch(`${API_BASE}/health`, { cache: "no-store" }),
      fetch(`${API_BASE}/api/v1/heatwave/summary`, { cache: "no-store" }),
    ]);
    if (healthRes.ok) {
      const payload = (await healthRes.json()) as { status?: string };
      health = payload.status ?? "unknown";
    }
    if (summaryRes.ok) {
      summary = (await summaryRes.json()) as HeatwaveSummary;
    }
  } catch {
    health = "unreachable";
  }

  const hotspots = summary.district_hotspots ?? [];
  const extremeCount = hotspots.filter((h) => h.intensity_category === "extreme").length;
  const highCount = hotspots.filter((h) => h.intensity_category === "high").length;

  return (
    <main>
      <h1 style={{ marginBottom: "0.25rem" }}>Bangladesh Heatwave Risk Dashboard</h1>
      <p style={{ color: "#4b5563", marginBottom: "1rem" }}>
        Live district heatwave intensity · 7-day forecast · Population &amp; mobility exposure · SMC activation priority
      </p>

      {/* Summary stats bar */}
      {hotspots.length > 0 && (
        <section className="card" style={{ marginBottom: "1rem", background: "#fff8f1", borderColor: "#fde68a" }}>
          <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: "0.78rem", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.04em" }}>As of date</div>
              <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{summary.as_of_date ?? "N/A"}</div>
            </div>
            {extremeCount > 0 && (
              <div>
                <div style={{ fontSize: "0.78rem", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.04em" }}>Extreme districts</div>
                <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "#dc2626" }}>{extremeCount}</div>
              </div>
            )}
            {highCount > 0 && (
              <div>
                <div style={{ fontSize: "0.78rem", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.04em" }}>High-heat districts</div>
                <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "#fb923c" }}>{highCount}</div>
              </div>
            )}
            <div style={{ flex: 1, minWidth: "240px" }}>
              <div style={{ fontSize: "0.78rem", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "0.35rem" }}>Top hotspot districts</div>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {hotspots.slice(0, 6).map((h) => (
                  <span key={h.district_code} style={{
                    background: intensityColor[h.intensity_category] ?? "#9ca3af",
                    color: "#fff",
                    borderRadius: "999px",
                    padding: "0.15rem 0.6rem",
                    fontSize: "0.82rem",
                    fontWeight: 500,
                  }}>
                    {h.district_name} {h.tmax_c.toFixed(1)}°C
                  </span>
                ))}
              </div>
            </div>
            <div style={{ fontSize: "0.78rem", color: health === "ok" ? "#16a34a" : "#dc2626", alignSelf: "center" }}>
              ● Backend: {health}
            </div>
          </div>
        </section>
      )}

      <section className="card" style={{ padding: "1rem" }}>
        <MapWrapper />
      </section>

      <AnalysisDashboard />
    </main>
  );
}
