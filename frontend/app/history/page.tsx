import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { DisclaimerBanner } from "../../components/ui/DisclaimerBanner";

const HistoryClient = dynamic(() => import("./HistoryClient"), {
  ssr: false,
  loading: () => <div className="page-shell"><div className="skeleton" style={{ height: "36rem" }} /></div>,
});

export const metadata: Metadata = {
  title: "Forecasts | HeatOps",
  description: "District-level weather history and scenario forecasting dashboard.",
};

export default function HistoryPage() {
  return (
    <main className="page-shell">
      <div className="page-header">
        <div>
          <div className="page-kicker">Forecasts</div>
          <h1 className="page-title">Historical Forecasts</h1>
          <p className="page-subtitle">District history, anomalies, and timeline playback. Historical reanalysis baseline for planning context.</p>
        </div>
      </div>
      <HistoryClient />

      <DisclaimerBanner>
        This is an informational tool only. It does not provide medical advice. Heat-related response actions should follow official emergency and public-health guidance.
      </DisclaimerBanner>
    </main>
  );
}
