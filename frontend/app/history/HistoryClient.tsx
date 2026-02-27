"use client";

import L from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import { GeoJSON, MapContainer, TileLayer, useMap } from "react-leaflet";
import { TEMPERATURE_POINTS, findNearestPointId } from "../page-home/temperature";
import styles from "./history.module.css";

type HistoryRow = {
  date: string;
  tmean: number | null;
  tmax: number | null;
  rhmean: number | null;
};

type DistrictAverage = {
  tmean: number | null;
  tmax: number | null;
  rhmean: number | null;
};

type CachePayload = {
  rows: HistoryRow[];
  districtCount: number;
  districtAverages: Record<string, DistrictAverage>;
  fetchedAt: string;
};

type DistrictFeatureCollection = {
  type: "FeatureCollection";
  features: Array<{
    type: string;
    properties?: Record<string, string>;
    geometry?: {
      type: string;
      coordinates: unknown;
    };
  }>;
};

type DistrictPoint = {
  id: string;
  label: string;
  lat: number;
  lon: number;
};

type OpenMeteoResponse = {
  daily?: {
    time?: string[];
    temperature_2m_mean?: Array<number | null>;
    temperature_2m_max?: Array<number | null>;
    relative_humidity_2m_mean?: Array<number | null>;
  };
  reason?: string;
};

type DistrictSeriesResult = {
  point: DistrictPoint;
  series: OpenMeteoResponse;
};

type MetricKey = "tmean" | "tmax" | "rhmean";

type MetricBucket = {
  label: string;
  min: number;
  max: number;
  color: string;
};

const DISTRICT_ALIAS: Record<string, string> = {
  barisal: "barishal",
  bogra: "bogura",
  chittagong: "chattogram",
  comilla: "cumilla",
  jessore: "jashore",
};

const LOCATION_KEY = "bd_district_average";
const LOCATION_LABEL = "Bangladesh district average (default)";
const GEOJSON_PATH = "/data/bd_districts.geojson";
const OPEN_METEO_ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive";
const BATCH_SIZE = 8;

const METRIC_OPTIONS: Array<{ key: MetricKey; label: string }> = [
  { key: "tmean", label: "Mean Temp" },
  { key: "tmax", label: "Max Temp" },
  { key: "rhmean", label: "Mean Humidity" },
];

const METRIC_BUCKETS: Record<MetricKey, MetricBucket[]> = {
  tmean: [
    { label: "< 24 C", min: Number.NEGATIVE_INFINITY, max: 24, color: "#bfdbfe" },
    { label: "24-26 C", min: 24, max: 26, color: "#93c5fd" },
    { label: "26-28 C", min: 26, max: 28, color: "#60a5fa" },
    { label: "28-30 C", min: 28, max: 30, color: "#fb923c" },
    { label: ">= 30 C", min: 30, max: Number.POSITIVE_INFINITY, color: "#ef4444" },
  ],
  tmax: [
    { label: "< 30 C", min: Number.NEGATIVE_INFINITY, max: 30, color: "#bfdbfe" },
    { label: "30-33 C", min: 30, max: 33, color: "#93c5fd" },
    { label: "33-35 C", min: 33, max: 35, color: "#60a5fa" },
    { label: "35-37 C", min: 35, max: 37, color: "#fb923c" },
    { label: ">= 37 C", min: 37, max: Number.POSITIVE_INFINITY, color: "#ef4444" },
  ],
  rhmean: [
    { label: "< 60%", min: Number.NEGATIVE_INFINITY, max: 60, color: "#fef3c7" },
    { label: "60-65%", min: 60, max: 65, color: "#fde68a" },
    { label: "65-70%", min: 65, max: 70, color: "#86efac" },
    { label: "70-75%", min: 70, max: 75, color: "#38bdf8" },
    { label: ">= 75%", min: 75, max: Number.POSITIVE_INFINITY, color: "#0284c7" },
  ],
};

function formatUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getLastTenYearsRange(): { startDate: string; endDate: string } {
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  end.setUTCDate(end.getUTCDate() - 1);

  const start = new Date(end);
  start.setUTCFullYear(start.getUTCFullYear() - 10);

  return {
    startDate: formatUtcDate(start),
    endDate: formatUtcDate(end),
  };
}

function normalizeDistrictId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
}

function canonicalDistrictId(value: string): string {
  const normalized = normalizeDistrictId(value);
  return DISTRICT_ALIAS[normalized] || normalized;
}

function districtName(properties?: Record<string, string>): string {
  return properties?.NAME_2 || properties?.district || properties?.name || "Unknown District";
}

function isCoordinatePair(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === "number" &&
    Number.isFinite(value[0]) &&
    typeof value[1] === "number" &&
    Number.isFinite(value[1])
  );
}

function collectCoordinates(node: unknown, out: Array<{ lat: number; lon: number }>) {
  if (isCoordinatePair(node)) {
    out.push({ lon: node[0], lat: node[1] });
    return;
  }

  if (Array.isArray(node)) {
    for (const child of node) {
      collectCoordinates(child, out);
    }
  }
}

function featureToPoint(feature: DistrictFeatureCollection["features"][number], index: number): DistrictPoint | null {
  const coords: Array<{ lat: number; lon: number }> = [];
  collectCoordinates(feature.geometry?.coordinates, coords);

  if (coords.length === 0) {
    return null;
  }

  let latSum = 0;
  let lonSum = 0;

  for (const coord of coords) {
    latSum += coord.lat;
    lonSum += coord.lon;
  }

  const lat = latSum / coords.length;
  const lon = lonSum / coords.length;
  const label = districtName(feature.properties);
  const fallbackId = `district${index + 1}`;
  const id = canonicalDistrictId(label) || fallbackId;

  return { id, label, lat, lon };
}

function toDistrictPoints(collection: DistrictFeatureCollection): DistrictPoint[] {
  const points: DistrictPoint[] = [];
  const seen = new Set<string>();

  collection.features.forEach((feature, index) => {
    const point = featureToPoint(feature, index);
    if (!point || seen.has(point.id)) {
      return;
    }

    seen.add(point.id);
    points.push(point);
  });

  return points;
}

function chunkPoints(points: DistrictPoint[], size: number): DistrictPoint[][] {
  const chunks: DistrictPoint[][] = [];

  for (let i = 0; i < points.length; i += size) {
    chunks.push(points.slice(i, i + size));
  }

  return chunks;
}

function summarizeDistrictSeries(series: OpenMeteoResponse): DistrictAverage {
  const daily = series.daily;

  if (!daily?.time || !daily.temperature_2m_mean || !daily.temperature_2m_max || !daily.relative_humidity_2m_mean) {
    return { tmean: null, tmax: null, rhmean: null };
  }

  const size = Math.min(
    daily.time.length,
    daily.temperature_2m_mean.length,
    daily.temperature_2m_max.length,
    daily.relative_humidity_2m_mean.length,
  );

  let tmeanSum = 0;
  let tmeanCount = 0;
  let tmaxSum = 0;
  let tmaxCount = 0;
  let rhmeanSum = 0;
  let rhmeanCount = 0;

  for (let i = 0; i < size; i += 1) {
    const tmean = daily.temperature_2m_mean[i];
    const tmax = daily.temperature_2m_max[i];
    const rhmean = daily.relative_humidity_2m_mean[i];

    if (typeof tmean === "number" && Number.isFinite(tmean)) {
      tmeanSum += tmean;
      tmeanCount += 1;
    }

    if (typeof tmax === "number" && Number.isFinite(tmax)) {
      tmaxSum += tmax;
      tmaxCount += 1;
    }

    if (typeof rhmean === "number" && Number.isFinite(rhmean)) {
      rhmeanSum += rhmean;
      rhmeanCount += 1;
    }
  }

  return {
    tmean: tmeanCount > 0 ? tmeanSum / tmeanCount : null,
    tmax: tmaxCount > 0 ? tmaxSum / tmaxCount : null,
    rhmean: rhmeanCount > 0 ? rhmeanSum / rhmeanCount : null,
  };
}

function toRowsFromSeries(seriesList: OpenMeteoResponse[]): HistoryRow[] {
  const aggregate = new Map<
    string,
    {
      date: string;
      tmeanSum: number;
      tmeanCount: number;
      tmaxSum: number;
      tmaxCount: number;
      rhmeanSum: number;
      rhmeanCount: number;
    }
  >();

  for (const series of seriesList) {
    const daily = series.daily;
    if (!daily?.time || !daily.temperature_2m_mean || !daily.temperature_2m_max || !daily.relative_humidity_2m_mean) {
      continue;
    }

    const size = Math.min(
      daily.time.length,
      daily.temperature_2m_mean.length,
      daily.temperature_2m_max.length,
      daily.relative_humidity_2m_mean.length,
    );

    for (let i = 0; i < size; i += 1) {
      const date = daily.time[i];
      const entry =
        aggregate.get(date) ||
        {
          date,
          tmeanSum: 0,
          tmeanCount: 0,
          tmaxSum: 0,
          tmaxCount: 0,
          rhmeanSum: 0,
          rhmeanCount: 0,
        };

      const tmean = daily.temperature_2m_mean[i];
      const tmax = daily.temperature_2m_max[i];
      const rhmean = daily.relative_humidity_2m_mean[i];

      if (typeof tmean === "number" && Number.isFinite(tmean)) {
        entry.tmeanSum += tmean;
        entry.tmeanCount += 1;
      }

      if (typeof tmax === "number" && Number.isFinite(tmax)) {
        entry.tmaxSum += tmax;
        entry.tmaxCount += 1;
      }

      if (typeof rhmean === "number" && Number.isFinite(rhmean)) {
        entry.rhmeanSum += rhmean;
        entry.rhmeanCount += 1;
      }

      aggregate.set(date, entry);
    }
  }

  return Array.from(aggregate.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((entry) => ({
      date: entry.date,
      tmean: entry.tmeanCount > 0 ? entry.tmeanSum / entry.tmeanCount : null,
      tmax: entry.tmaxCount > 0 ? entry.tmaxSum / entry.tmaxCount : null,
      rhmean: entry.rhmeanCount > 0 ? entry.rhmeanSum / entry.rhmeanCount : null,
    }));
}

function formatNumber(value: number | null): string {
  return value === null ? "-" : value.toFixed(1);
}

function formatMetric(metric: MetricKey, value: number | null): string {
  if (value === null) {
    return "N/A";
  }

  if (metric === "rhmean") {
    return `${value.toFixed(1)}%`;
  }

  return `${value.toFixed(1)} C`;
}

function getMetricColor(metric: MetricKey, value: number | null): string {
  if (value === null) {
    return "#e2e8f0";
  }

  const bucket = METRIC_BUCKETS[metric].find((item) => value >= item.min && value < item.max);
  return bucket?.color || "#e2e8f0";
}

function safeReadCache(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeWriteCache(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // Ignore storage failures (private mode/quota).
  }
}

function safeRemoveCache(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Ignore storage failures.
  }
}

function FitToDistrictBounds({ bounds }: { bounds?: L.LatLngBounds }) {
  const map = useMap();

  useEffect(() => {
    if (!bounds) {
      return;
    }
    map.fitBounds(bounds.pad(0.04));
  }, [map, bounds]);

  return null;
}

async function fetchSingleDistrictSeries(
  point: DistrictPoint,
  startDate: string,
  endDate: string,
): Promise<OpenMeteoResponse> {
  const params = new URLSearchParams({
    latitude: String(point.lat),
    longitude: String(point.lon),
    start_date: startDate,
    end_date: endDate,
    daily: "temperature_2m_mean,temperature_2m_max,relative_humidity_2m_mean",
    timezone: "Asia/Dhaka",
  });

  const response = await fetch(`${OPEN_METEO_ARCHIVE_URL}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`API request failed (${response.status})`);
  }

  return (await response.json()) as OpenMeteoResponse;
}

async function fetchDistrictSeriesBatch(
  points: DistrictPoint[],
  startDate: string,
  endDate: string,
): Promise<DistrictSeriesResult[]> {
  const settled = await Promise.all(
    points.map(async (point) => {
      try {
        const series = await fetchSingleDistrictSeries(point, startDate, endDate);
        return { point, series };
      } catch {
        return null;
      }
    }),
  );

  return settled.filter((entry): entry is DistrictSeriesResult => entry !== null);
}

async function loadDistrictGeojson(): Promise<DistrictFeatureCollection> {
  const response = await fetch(GEOJSON_PATH, { cache: "force-cache" });
  if (!response.ok) {
    throw new Error(`Failed to load district map (${response.status})`);
  }
  return (await response.json()) as DistrictFeatureCollection;
}

export default function HistoryClient() {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [districtCount, setDistrictCount] = useState(0);
  const [districtAverages, setDistrictAverages] = useState<Record<string, DistrictAverage>>({});
  const [districts, setDistricts] = useState<DistrictFeatureCollection | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [mapError, setMapError] = useState<string>("");
  const [loadedFromCache, setLoadedFromCache] = useState(false);
  const [activeMetric, setActiveMetric] = useState<MetricKey>("tmean");
  const [selectedDistrict, setSelectedDistrict] = useState("");

  const geoJsonRef = useRef<L.GeoJSON | null>(null);

  const { startDate, endDate } = useMemo(() => getLastTenYearsRange(), []);
  const cacheKey = `history:v3:${LOCATION_KEY}:${startDate}:${endDate}`;

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const geojson = await loadDistrictGeojson();
        if (cancelled) {
          return;
        }
        setDistricts(geojson);
        setMapError("");
      } catch (err) {
        if (cancelled) {
          return;
        }
        const message = err instanceof Error ? err.message : "Failed to load district map";
        setMapError(message);
      }
    };

    load().catch(() => {
      if (!cancelled) {
        setMapError("Failed to load district map");
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const previewRows = rows.slice(0, 10);
  const loadedRange = rows.length > 0 ? `${rows[0].date} to ${rows[rows.length - 1].date}` : "";

  const mapBounds = useMemo(() => {
    if (!districts) {
      return undefined;
    }

    const layer = L.geoJSON(districts as any);
    const bounds = layer.getBounds();
    return bounds.isValid() ? bounds : undefined;
  }, [districts]);

  const selectedDistrictSummary = useMemo(() => {
    if (!selectedDistrict) {
      return null;
    }

    const key = canonicalDistrictId(selectedDistrict);
    return districtAverages[key] || null;
  }, [selectedDistrict, districtAverages]);

  const styleForFeature = useMemo<L.StyleFunction<any>>(() => {
    return (feature): L.PathOptions => {
      const properties = (feature?.properties as Record<string, string> | undefined) ?? undefined;
      const name = districtName(properties);
      const key = canonicalDistrictId(name);
      const value = districtAverages[key]?.[activeMetric] ?? null;

      return {
        color: "#0f172a",
        weight: 1,
        fillColor: getMetricColor(activeMetric, value),
        fillOpacity: 0.72,
      };
    };
  }, [districtAverages, activeMetric]);

  const onEachFeature = (feature: { properties?: Record<string, string> }, layer: L.Layer) => {
    const name = districtName(feature.properties);
    const key = canonicalDistrictId(name);
    const value = districtAverages[key]?.[activeMetric] ?? null;

    layer.bindTooltip(`${name}: ${formatMetric(activeMetric, value)}`, { sticky: true });

    layer.on("add", () => {
      const path = (layer as L.Path).getElement?.();
      if (path) {
        path.setAttribute("tabindex", "-1");
      }
    });

    layer.on({
      mouseover: (event) => {
        const target = event.target as L.Path;
        target.setStyle({
          weight: 2,
          color: "#111827",
          fillOpacity: 0.9,
        });
      },
      mouseout: (event) => {
        geoJsonRef.current?.resetStyle(event.target);
      },
      click: () => {
        setSelectedDistrict(name);
      },
    });
  };

  const fetchHistory = async (forceRefresh: boolean) => {
    if (loading) {
      return;
    }

    setError("");

    if (!forceRefresh && rows.length > 0 && Object.keys(districtAverages).length > 0) {
      setLoadedFromCache(true);
      return;
    }

    if (!forceRefresh) {
      const cached = safeReadCache(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as CachePayload;
          if (Array.isArray(parsed.rows) && parsed.districtAverages && typeof parsed.districtAverages === "object") {
            setRows(parsed.rows);
            setDistrictCount(parsed.districtCount || 0);
            setDistrictAverages(parsed.districtAverages);
            setLoadedFromCache(true);
            return;
          }
        } catch {
          safeRemoveCache(cacheKey);
        }
      }
    }

    setLoading(true);
    setLoadedFromCache(false);

    try {
      let geojson = districts;
      if (!geojson) {
        geojson = await loadDistrictGeojson();
        setDistricts(geojson);
        setMapError("");
      }

      const districtPoints = toDistrictPoints(geojson);
      if (districtPoints.length === 0) {
        throw new Error("No district coordinates found in map data");
      }

      const weatherPoints = TEMPERATURE_POINTS;
      const batches = chunkPoints(weatherPoints, BATCH_SIZE);
      const allResults: DistrictSeriesResult[] = [];

      for (const batch of batches) {
        const batchResults = await fetchDistrictSeriesBatch(batch, startDate, endDate);
        allResults.push(...batchResults);
      }

      if (allResults.length === 0) {
        throw new Error("No weather series could be loaded");
      }

      const seriesByPointId = new Map(allResults.map((result) => [result.point.id, result.series]));
      const successfulPoints = weatherPoints.filter((point) => seriesByPointId.has(point.id));

      if (successfulPoints.length === 0) {
        throw new Error("No weather series could be loaded");
      }

      const mappedDistrictSeries: OpenMeteoResponse[] = [];
      const nextDistrictAverages: Record<string, DistrictAverage> = {};

      for (const districtPoint of districtPoints) {
        const nearestPointId = findNearestPointId(districtPoint.lat, districtPoint.lon, successfulPoints);
        if (!nearestPointId) {
          continue;
        }

        const series = seriesByPointId.get(nearestPointId);
        if (!series) {
          continue;
        }

        mappedDistrictSeries.push(series);
        nextDistrictAverages[districtPoint.id] = summarizeDistrictSeries(series);
      }

      if (mappedDistrictSeries.length === 0) {
        throw new Error("Unable to map weather history to districts");
      }

      const nextRows = toRowsFromSeries(mappedDistrictSeries);
      if (nextRows.length === 0) {
        throw new Error("No daily records returned from API");
      }

      setRows(nextRows);
      setDistrictCount(mappedDistrictSeries.length);
      setDistrictAverages(nextDistrictAverages);

      const cachePayload: CachePayload = {
        rows: nextRows,
        districtCount: mappedDistrictSeries.length,
        districtAverages: nextDistrictAverages,
        fetchedAt: new Date().toISOString(),
      };

      safeWriteCache(cacheKey, JSON.stringify(cachePayload));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load history data";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className={styles.panel}>
      <div className={styles.controls}>
        <label className={styles.fieldLabel} htmlFor="history-location">
          Location
        </label>
        <select id="history-location" className={styles.select} defaultValue={LOCATION_KEY}>
          <option value={LOCATION_KEY}>{LOCATION_LABEL}</option>
        </select>
        <div className={styles.buttonRow}>
          <button type="button" className={styles.buttonPrimary} onClick={() => void fetchHistory(false)} disabled={loading}>
            {loading ? "Loading..." : "Load data"}
          </button>
          <button type="button" className={styles.buttonSecondary} onClick={() => void fetchHistory(true)} disabled={loading}>
            Refresh
          </button>
        </div>
      </div>

      {mapError ? <p className={styles.error}>{mapError}</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}

      <p className={styles.meta}>
        {rows.length > 0
          ? `Loaded ${rows.length} days (${loadedRange}) averaged across ${districtCount} mapped districts`
          : "No history loaded yet. Click Load data to fetch 10 years of history."}
        {rows.length > 0 && loadedFromCache ? " [cached]" : ""}
      </p>

      <div className={styles.metricBar}>
        <span className={styles.metricLabel}>District map metric</span>
        <div className={styles.metricSwitch}>
          {METRIC_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              className={`${styles.metricButton} ${activeMetric === option.key ? styles.metricButtonActive : ""}`}
              onClick={() => setActiveMetric(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.mapLayout}>
        <div className={styles.mapContainer}>
          {districts ? (
            <MapContainer center={[23.7, 90.4]} zoom={7} style={{ height: "100%", width: "100%" }} bounds={mapBounds}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <GeoJSON
                data={districts as any}
                style={styleForFeature}
                onEachFeature={onEachFeature}
                ref={(layer) => {
                  geoJsonRef.current = layer;
                }}
              />
              <FitToDistrictBounds bounds={mapBounds} />
            </MapContainer>
          ) : (
            <div className={styles.mapPlaceholder}>Loading district map...</div>
          )}

          <div className={styles.legend}>
            <span className={styles.legendTitle}>{METRIC_OPTIONS.find((item) => item.key === activeMetric)?.label}</span>
            {METRIC_BUCKETS[activeMetric].map((bucket) => (
              <div key={bucket.label} className={styles.legendRow}>
                <span className={styles.legendSwatch} style={{ background: bucket.color }} />
                <span>{bucket.label}</span>
              </div>
            ))}
          </div>
        </div>

        <aside className={styles.sidePanel}>
          <h3 className={styles.sideTitle}>District Summary</h3>
          {selectedDistrictSummary ? (
            <>
              <p className={styles.sideText}>{selectedDistrict}</p>
              <dl className={styles.statsList}>
                <div className={styles.statsRow}>
                  <dt>10Y Mean Temp</dt>
                  <dd>{formatMetric("tmean", selectedDistrictSummary.tmean)}</dd>
                </div>
                <div className={styles.statsRow}>
                  <dt>10Y Max Temp</dt>
                  <dd>{formatMetric("tmax", selectedDistrictSummary.tmax)}</dd>
                </div>
                <div className={styles.statsRow}>
                  <dt>10Y Mean Humidity</dt>
                  <dd>{formatMetric("rhmean", selectedDistrictSummary.rhmean)}</dd>
                </div>
              </dl>
            </>
          ) : (
            <p className={styles.sideText}>Click any district on the map to inspect its 10-year summary.</p>
          )}
        </aside>
      </div>

      {rows.length > 0 ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Tmean (C)</th>
                <th>Tmax (C)</th>
                <th>RHmean (%)</th>
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row) => (
                <tr key={row.date}>
                  <td>{row.date}</td>
                  <td>{formatNumber(row.tmean)}</td>
                  <td>{formatNumber(row.tmax)}</td>
                  <td>{formatNumber(row.rhmean)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className={styles.hint}>Map is ready. Load data to color districts with 10-year historical averages.</p>
      )}
    </section>
  );
}
