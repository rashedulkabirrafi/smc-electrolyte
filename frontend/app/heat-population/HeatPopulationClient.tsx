"use client";

import { useEffect, useMemo, useState } from "react";

import { DemandCalculatorPanel } from "../../components/DemandCalculatorPanel";
import { MapIcon, ZapIcon } from "../../components/icons";
import { HeatPopulationMap } from "../../components/maps/HeatPopulationMap";
import { AlertBanner } from "../../components/ui/AlertBanner";
import { Card, CardBody, CardHeader, CardHeaderMeta, CardTitle, CardCaption } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { fetchCurrentTemperatures, TEMPERATURE_POINTS } from "../page-home/temperature";
import {
  attachHeatMetrics,
  buildGeoJsonForDeck,
  buildSpikeData,
  loadBangladeshDistrictGeoJson,
  type DistrictWithHeat,
} from "../../lib/populationMapData";
import styles from "./heat-population.module.css";

export default function HeatPopulationClient() {
  const [data, setData] = useState<DistrictWithHeat[]>([]);
  const [selectedPcode, setSelectedPcode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [geojson, temperatures] = await Promise.all([
          loadBangladeshDistrictGeoJson(),
          fetchCurrentTemperatures(TEMPERATURE_POINTS),
        ]);
        const spikes = buildSpikeData(geojson);
        const combined = attachHeatMetrics(spikes, temperatures);
        if (cancelled) return;
        setData(combined);
        setSelectedPcode(combined[0]?.pcode ?? "");
        setError("");
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load heat and population overlay.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load().catch(() => {
      if (!cancelled) {
        setError("Failed to load heat and population overlay.");
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const geojson = useMemo(() => buildGeoJsonForDeck(data), [data]);
  const selectedDistrict = data.find((district) => district.pcode === selectedPcode) ?? data[0] ?? null;
  const topDemandDistricts = useMemo(
    () => [...data].sort((left, right) => right.population * right.probability_tier3 - left.population * left.probability_tier3).slice(0, 3),
    [data]
  );
  const averageHeat = useMemo(
    () => data.reduce((sum, district) => sum + district.heat_index_p50, 0) / Math.max(data.length, 1),
    [data]
  );

  return (
    <main className="page-shell">
      <div className="page-header">
        <div>
          <div className="page-kicker">Heat × Population</div>
          <h1 className="page-title">Population Density Meets Heat Stress</h1>
          <p className="page-subtitle">
            District population spikes layered over the current heat surface, with demand estimates for heat-driven hydration planning.
          </p>
        </div>
      </div>

      {error ? (
        <AlertBanner variant="critical" title="Heat-population view unavailable" description={error} />
      ) : null}

      {data.length ? (
        <div className={styles.summaryGrid}>
          <SummaryCard label="Average HI" value={`${averageHeat.toFixed(1)} °C`} sub="current district-level heat snapshot" />
          <SummaryCard label="Dense + Hot Districts" value={String(data.filter((district) => district.heat_tier >= 3 && district.density_normalized >= 0.35).length)} sub="heat tier 3+ with above-average density" />
          <SummaryCard label="Top Demand Cluster" value={topDemandDistricts[0]?.district ?? "—"} sub="highest combined population and heat pressure" />
        </div>
      ) : null}

      <div className={styles.layout}>
        <Card variant="elevated" className={styles.mapCard}>
          <CardHeader>
            <CardHeaderMeta>
              <CardTitle>Combined density and heat map</CardTitle>
              <CardCaption>Choropleth polygons show heat tier. Column height still represents density, so dense hot districts rise fastest.</CardCaption>
            </CardHeaderMeta>
          </CardHeader>
          <CardBody className={styles.mapBody}>
            {loading ? (
              <div className="skeleton" style={{ width: "100%", height: "100%" }} />
            ) : data.length ? (
              <HeatPopulationMap
                data={data}
                geojson={geojson}
                selectedPcode={selectedDistrict?.pcode}
                onDistrictClick={(district) => setSelectedPcode(district.pcode)}
              />
            ) : (
              <EmptyState
                icon={<MapIcon width={28} height={28} />}
                title="No overlay data available"
                description="The combined heat and density surface appears here once both the district geometry and weather feed resolve."
              />
            )}
          </CardBody>
        </Card>

        <div className={styles.sideStack}>
          {selectedDistrict ? (
            <Card variant="accent">
              <CardHeader>
                <CardHeaderMeta>
                  <CardTitle>{selectedDistrict.district}</CardTitle>
                  <CardCaption>{selectedDistrict.division} Division · live selection</CardCaption>
                </CardHeaderMeta>
              </CardHeader>
              <CardBody>
                <div className="stack-sm">
                  {[
                    ["Heat tier", `T${selectedDistrict.heat_tier}`],
                    ["HI p50", `${selectedDistrict.heat_index_p50.toFixed(1)} °C`],
                    ["HI anomaly", `${selectedDistrict.anom_hi >= 0 ? "+" : ""}${selectedDistrict.anom_hi.toFixed(1)} °C`],
                    ["Population", selectedDistrict.population.toLocaleString()],
                    ["Density", `${selectedDistrict.density.toLocaleString()} /km²`],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "0.75rem",
                        paddingBottom: "0.55rem",
                        borderBottom: "1px solid var(--border-subtle)",
                      }}
                    >
                      <span style={{ color: "var(--text-tertiary)", fontSize: "0.74rem" }}>{label}</span>
                      <span className="mono" style={{ color: "var(--text-primary)", fontSize: "0.78rem" }}>
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          ) : null}

          {data.length ? (
            <DemandCalculatorPanel
              districts={data}
              selectedPcode={selectedDistrict?.pcode}
              onSelectDistrict={setSelectedPcode}
            />
          ) : (
            <EmptyState
              icon={<ZapIcon width={28} height={28} />}
              title="Demand calculator waiting on data"
              description="Demand estimates populate once the heat and density overlay is available."
            />
          )}
        </div>
      </div>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className={styles.summaryCard}>
      <div className={styles.summaryLabel}>{label}</div>
      <div className={styles.summaryValue}>{value}</div>
      <div className={styles.summarySub}>{sub}</div>
    </div>
  );
}

