"use client";

import { useEffect, useMemo, useState } from "react";

import { MapIcon, ThermometerIcon } from "../../components/icons";
import { PopulationSpikeMap } from "../../components/maps/PopulationSpikeMap";
import { AlertBanner } from "../../components/ui/AlertBanner";
import { Card, CardBody, CardHeader, CardHeaderMeta, CardTitle, CardCaption } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { Field, Select } from "../../components/ui/Field";
import { loadBangladeshDistrictGeoJson, buildSpikeData, type DistrictSpikeData } from "../../lib/populationMapData";
import styles from "./population-density.module.css";

export default function PopulationDensityClient() {
  const [data, setData] = useState<DistrictSpikeData[]>([]);
  const [selectedPcode, setSelectedPcode] = useState<string>("");
  const [divisionFilter, setDivisionFilter] = useState("all");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const geojson = await loadBangladeshDistrictGeoJson();
        const spikes = buildSpikeData(geojson);
        if (cancelled) return;
        setData(spikes);
        setSelectedPcode(spikes[0]?.pcode ?? "");
        setError("");
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load population density map.");
        }
      }
    }

    load().catch(() => {
      if (!cancelled) {
        setError("Failed to load population density map.");
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const divisions = useMemo(
    () => ["all", ...new Set(data.map((district) => district.division))],
    [data]
  );

  const filteredData = useMemo(() => {
    if (divisionFilter === "all") return data;
    return data.filter((district) => district.division === divisionFilter);
  }, [data, divisionFilter]);

  const selectedDistrict =
    filteredData.find((district) => district.pcode === selectedPcode) ??
    data.find((district) => district.pcode === selectedPcode) ??
    filteredData[0] ??
    null;

  const rankedDistricts = useMemo(
    () => [...filteredData].sort((left, right) => right.density - left.density),
    [filteredData]
  );

  return (
    <main className="page-shell">
      <div className="page-header">
        <div>
          <div className="page-kicker">Population Density</div>
          <h1 className="page-title">3D District Population Density</h1>
          <p className="page-subtitle">
            Bangladesh district spikes built from the 2022 census fallback table and local district geometry.
          </p>
        </div>
      </div>

      {error ? (
        <AlertBanner variant="critical" title="Population map unavailable" description={error} />
      ) : null}

      <div className={styles.layout}>
        <Card variant="elevated" className={styles.mapCard}>
          <CardHeader>
            <CardHeaderMeta>
              <CardTitle>Density spike field</CardTitle>
              <CardCaption>Thin spikes are distributed across district geometry so the whole country reads as a density surface.</CardCaption>
            </CardHeaderMeta>
          </CardHeader>
          <CardBody className={styles.mapBody}>
            {filteredData.length ? (
              <PopulationSpikeMap
                data={filteredData}
                selectedPcode={selectedDistrict?.pcode}
                onDistrictClick={(district) => setSelectedPcode(district.pcode)}
              />
            ) : (
              <EmptyState
                icon={<MapIcon width={28} height={28} />}
                title="No districts available"
                description="Population spikes will appear once the district geometry and census fallback data are joined."
              />
            )}
          </CardBody>
        </Card>

        <div className={styles.sidePanel}>
          <Card variant="default">
            <CardHeader>
              <CardHeaderMeta>
                <CardTitle>Controls</CardTitle>
                <CardCaption>Filter the spike map by division and review the densest districts.</CardCaption>
              </CardHeaderMeta>
            </CardHeader>
            <CardBody className={styles.controls}>
              <Field label="Division">
                <Select value={divisionFilter} onChange={(event) => setDivisionFilter(event.target.value)}>
                  {divisions.map((division) => (
                    <option key={division} value={division}>
                      {division === "all" ? "All divisions" : division}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className={styles.tableWrap}>
                {rankedDistricts.map((district, index) => (
                  <button
                    key={district.pcode}
                    type="button"
                    onClick={() => setSelectedPcode(district.pcode)}
                    className={`${styles.tableRow} ${selectedDistrict?.pcode === district.pcode ? styles.tableRowActive : ""}`.trim()}
                  >
                    <div className={styles.tableMeta}>
                      <span className={styles.tableRank}>{index + 1}</span>
                      <span className={styles.tableName}>{district.district}</span>
                    </div>
                    <span className={styles.tableValue}>{district.density.toLocaleString()}</span>
                  </button>
                ))}
              </div>
            </CardBody>
          </Card>

          {selectedDistrict ? (
            <Card variant="accent">
              <CardHeader>
                <CardHeaderMeta>
                  <CardTitle>{selectedDistrict.district}</CardTitle>
                  <CardCaption>{selectedDistrict.division} Division · BBS 2022 fallback data</CardCaption>
                </CardHeaderMeta>
              </CardHeader>
              <CardBody>
                <div className={styles.detailGrid}>
                  <MetricCard label="Population" value={selectedDistrict.population.toLocaleString()} />
                  <MetricCard label="Area (km²)" value={selectedDistrict.area_km2.toLocaleString()} />
                  <MetricCard label="Density /km²" value={selectedDistrict.density.toLocaleString()} accent />
                  <MetricCard label="Density Rank" value={`#${rankedDistricts.findIndex((item) => item.pcode === selectedDistrict.pcode) + 1}`} />
                </div>
              </CardBody>
            </Card>
          ) : (
            <EmptyState
              icon={<ThermometerIcon width={28} height={28} />}
              title="Select a district"
              description="Choose a district from the 3D map or the ranking list to inspect the density profile."
            />
          )}
        </div>
      </div>
    </main>
  );
}

function MetricCard({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={styles.metricCard}
      style={accent ? { borderColor: "rgba(214, 160, 75, 0.32)" } : undefined}
    >
      <div className={styles.metricLabel}>{label}</div>
      <div className={styles.metricValue} style={accent ? { color: "var(--accent-primary)" } : undefined}>
        {value}
      </div>
    </div>
  );
}
