"use client";

import { useEffect, useState } from "react";
import { apiUrl } from "../lib/api";

type LagRow = { lag_days: number; n_obs: number; correlation: number | null };
type Effect = { coef: number; p_value: number };

type Metrics = {
  generated_at?: string;
  panel_rows?: number;
  district_day_rows?: number;
  lag_correlations?: LagRow[];
  count_models?: {
    poisson?: { aic?: number };
    negative_binomial?: { aic?: number; effects?: Record<string, Effect> };
  };
  heatmap?: {
    intensity_categories: string[];
    incident_bins: string[];
    matrix: number[][];
  };
};

type PriorityRow = {
  area_type: string;
  district_name: string;
  upazila_name?: string | null;
  smc_priority_score: number;
  smc_priority_rank: number;
  heatwave_forecast_score: number;
  pop_exposure_score: number;
  mobility_proxy_score: number;
  explainability_note?: string;
};

function corrWidth(value: number | null): number {
  if (value === null) return 0;
  return Math.min(100, Math.round(Math.abs(value) * 100));
}

function heatColor(value: number, max: number): string {
  if (max <= 0) return "#f3f4f6";
  const alpha = Math.max(0.08, value / max);
  return `rgba(216, 81, 29, ${alpha.toFixed(2)})`;
}

function scoreBar(value: number, color: string) {
  const pct = Math.min(100, Math.round(value * 100));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
      <div style={{ background: "#e5e7eb", height: 8, borderRadius: 4, flex: 1, minWidth: 60 }}>
        <div style={{ width: `${pct}%`, height: 8, borderRadius: 4, background: color }} />
      </div>
      <span style={{ fontSize: "0.8rem", whiteSpace: "nowrap", minWidth: 32 }}>{(value * 100).toFixed(0)}%</span>
    </div>
  );
}

export default function AnalysisDashboard() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [priorities, setPriorities] = useState<PriorityRow[]>([]);
  const [priorityType, setPriorityType] = useState<"district" | "upazila">("district");

  useEffect(() => {
    const load = async () => {
      const res = await fetch(apiUrl("/api/v1/analysis/metrics"));
      if (!res.ok) return;
      setMetrics((await res.json()) as Metrics);
    };
    load().catch(() => null);
  }, []);

  useEffect(() => {
    const loadPriority = async () => {
      const res = await fetch(apiUrl(`/api/v1/smc/priority-index?limit=10&area_type=${priorityType}`));
      if (!res.ok) return;
      setPriorities((await res.json()) as PriorityRow[]);
    };
    loadPriority().catch(() => null);
  }, [priorityType]);

  const lags = metrics?.lag_correlations ?? [];
  const heatmap = metrics?.heatmap;
  const flatHeat = heatmap?.matrix?.flat() ?? [];
  const maxHeat = flatHeat.length ? Math.max(...flatHeat) : 0;

  return (
    <>
      {/* SMC Priority Index */}
      <section className="card" style={{ marginTop: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.75rem" }}>
          <div>
            <h2 style={{ margin: 0 }}>SMC Activation Priority Index</h2>
            <p style={{ margin: "0.2rem 0 0", fontSize: "0.88rem", color: "#6b7280" }}>
              Composite score = 50% heatwave forecast + 30% population exposure + 20% mobility
            </p>
          </div>
          <label style={{ fontSize: "0.88rem" }}>
            Level:{" "}
            <select value={priorityType} onChange={(e) => setPriorityType(e.target.value as "district" | "upazila")} style={{ marginLeft: "0.3rem" }}>
              <option value="district">District</option>
              <option value="upazila">Upazila</option>
            </select>
          </label>
        </div>

        {priorities.length === 0 ? (
          <p style={{ color: "#9ca3af" }}>Loading…</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.88rem" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <th style={{ padding: "0.4rem 0.6rem", textAlign: "left", borderBottom: "2px solid #e5e7eb" }}>#</th>
                  <th style={{ padding: "0.4rem 0.6rem", textAlign: "left", borderBottom: "2px solid #e5e7eb" }}>Area</th>
                  <th style={{ padding: "0.4rem 0.6rem", textAlign: "left", borderBottom: "2px solid #e5e7eb" }}>Priority score</th>
                  <th style={{ padding: "0.4rem 0.6rem", textAlign: "left", borderBottom: "2px solid #e5e7eb" }}>Heatwave</th>
                  <th style={{ padding: "0.4rem 0.6rem", textAlign: "left", borderBottom: "2px solid #e5e7eb" }}>Population</th>
                  <th style={{ padding: "0.4rem 0.6rem", textAlign: "left", borderBottom: "2px solid #e5e7eb" }}>Mobility</th>
                </tr>
              </thead>
              <tbody>
                {priorities.map((row, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "0.4rem 0.6rem", color: "#6b7280", fontWeight: 600 }}>{row.smc_priority_rank ?? i + 1}</td>
                    <td style={{ padding: "0.4rem 0.6rem", fontWeight: 500 }}>
                      {row.upazila_name ? `${row.upazila_name}, ${row.district_name}` : row.district_name}
                    </td>
                    <td style={{ padding: "0.4rem 0.6rem", minWidth: 120 }}>
                      {scoreBar(row.smc_priority_score, "#d8511d")}
                    </td>
                    <td style={{ padding: "0.4rem 0.6rem", minWidth: 100 }}>
                      {scoreBar(row.heatwave_forecast_score, "#fb923c")}
                    </td>
                    <td style={{ padding: "0.4rem 0.6rem", minWidth: 100 }}>
                      {scoreBar(row.pop_exposure_score, "#3b82f6")}
                    </td>
                    <td style={{ padding: "0.4rem 0.6rem", minWidth: 100 }}>
                      {scoreBar(row.mobility_proxy_score, "#8b5cf6")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Incident Correlation Dashboard */}
      <section className="card" style={{ marginTop: "1rem" }}>
        <h2 style={{ marginTop: 0 }}>Incident–Heatwave Correlation Analysis</h2>
        <p style={{ marginBottom: "0.75rem", fontSize: "0.88rem", color: "#6b7280" }}>
          Lag effects and count-model signals between heatwave intensity and casualty incidents.
          {metrics?.panel_rows ? ` Dataset: ${metrics.panel_rows} panel rows, ${metrics.district_day_rows} district-days.` : ""}
        </p>

        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 320px", minWidth: "320px" }}>
            <h3 style={{ marginBottom: "0.5rem" }}>Lag Correlation (heatwave intensity vs incidents at t+lag)</h3>
            {lags.map((row) => {
              const positive = (row.correlation ?? 0) >= 0;
              return (
                <div key={row.lag_days} style={{ marginBottom: "0.5rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem" }}>
                    <span>Lag {row.lag_days}d <span style={{ color: "#9ca3af" }}>(n={row.n_obs})</span></span>
                    <span style={{ fontWeight: 600, color: positive ? "#15803d" : "#dc2626" }}>{row.correlation ?? "n/a"}</span>
                  </div>
                  <div style={{ background: "#e5e7eb", height: "10px", borderRadius: "4px" }}>
                    <div
                      style={{
                        width: `${corrWidth(row.correlation)}%`,
                        height: "10px",
                        borderRadius: "4px",
                        background: positive ? "#2f855a" : "#c53030",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ flex: "1 1 320px", minWidth: "320px" }}>
            <h3 style={{ marginBottom: "0.5rem" }}>Count Model Results</h3>
            <div style={{ fontSize: "0.92rem", lineHeight: 1.6 }}>
              <div>Poisson AIC: <b>{metrics?.count_models?.poisson?.aic ?? "n/a"}</b></div>
              <div>NegBin AIC: <b>{metrics?.count_models?.negative_binomial?.aic ?? "n/a"}</b></div>
              <div style={{ marginTop: "0.4rem", fontWeight: 600 }}>NegBin key effects:</div>
              {Object.entries(metrics?.count_models?.negative_binomial?.effects ?? {}).map(([k, v]) => (
                <div key={k} style={{ paddingLeft: "0.5rem" }}>
                  <span style={{ fontFamily: "monospace" }}>{k}</span>: coef=<b>{v.coef}</b>, p={v.p_value < 0.05 ? <b style={{ color: "#dc2626" }}>{v.p_value}</b> : v.p_value}
                </div>
              ))}
            </div>
          </div>
        </div>

        {heatmap && (
          <div style={{ marginTop: "1rem" }}>
            <h3 style={{ marginBottom: "0.5rem" }}>Heatmap: intensity category vs incident counts</h3>
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", width: "100%" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "0.4rem", borderBottom: "1px solid #d1d5db" }}>
                      Intensity
                    </th>
                    {heatmap.incident_bins.map((b) => (
                      <th key={b} style={{ padding: "0.4rem", borderBottom: "1px solid #d1d5db" }}>
                        incidents={b}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {heatmap.intensity_categories.map((cat, i) => (
                    <tr key={cat}>
                      <td style={{ padding: "0.4rem", borderBottom: "1px solid #e5e7eb", fontWeight: 500 }}>{cat}</td>
                      {heatmap.matrix[i].map((value, j) => (
                        <td
                          key={`${cat}-${j}`}
                          style={{
                            padding: "0.4rem",
                            textAlign: "center",
                            borderBottom: "1px solid #e5e7eb",
                            background: heatColor(value, maxHeat),
                          }}
                        >
                          {value}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
