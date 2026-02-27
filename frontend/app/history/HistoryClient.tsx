"use client";

import { useMemo, useState } from "react";
import styles from "./history.module.css";

type HistoryRow = {
  date: string;
  tmean: number | null;
  tmax: number | null;
  rhmean: number | null;
};

type CachePayload = {
  rows: HistoryRow[];
  districtCount: number;
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

const LOCATION_KEY = "bd_district_average";
const LOCATION_LABEL = "Bangladesh district average (default)";
const GEOJSON_PATH = "/data/bd_districts.geojson";
const OPEN_METEO_ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive";
const BATCH_SIZE = 8;

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
  const id = normalizeDistrictId(label) || fallbackId;

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
): Promise<OpenMeteoResponse[]> {
  const settled = await Promise.all(
    points.map(async (point) => {
      try {
        return await fetchSingleDistrictSeries(point, startDate, endDate);
      } catch {
        return null;
      }
    }),
  );

  const series = settled.filter((entry): entry is OpenMeteoResponse => entry !== null);
  if (series.length === 0) {
    throw new Error("Failed to load weather data for district batch");
  }

  return series;
}

export default function HistoryClient() {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [districtCount, setDistrictCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [loadedFromCache, setLoadedFromCache] = useState(false);

  const { startDate, endDate } = useMemo(() => getLastTenYearsRange(), []);
  const cacheKey = `history:${LOCATION_KEY}:${startDate}:${endDate}`;

  const previewRows = rows.slice(0, 10);
  const loadedRange = rows.length > 0 ? `${rows[0].date} to ${rows[rows.length - 1].date}` : "";

  const fetchHistory = async (forceRefresh: boolean) => {
    if (loading) {
      return;
    }

    setError("");

    if (!forceRefresh && rows.length > 0) {
      setLoadedFromCache(true);
      return;
    }

    if (!forceRefresh) {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as CachePayload;
          if (Array.isArray(parsed.rows)) {
            setRows(parsed.rows);
            setDistrictCount(parsed.districtCount || 0);
            setLoadedFromCache(true);
            return;
          }
        } catch {
          sessionStorage.removeItem(cacheKey);
        }
      }
    }

    setLoading(true);
    setLoadedFromCache(false);

    try {
      const geoResponse = await fetch(GEOJSON_PATH, { cache: "force-cache" });
      if (!geoResponse.ok) {
        throw new Error(`Failed to load district map (${geoResponse.status})`);
      }

      const geojson = (await geoResponse.json()) as DistrictFeatureCollection;
      const districtPoints = toDistrictPoints(geojson);

      if (districtPoints.length === 0) {
        throw new Error("No district coordinates found in map data");
      }

      const batches = chunkPoints(districtPoints, BATCH_SIZE);
      const allSeries: OpenMeteoResponse[] = [];

      for (const batch of batches) {
        try {
          const batchSeries = await fetchDistrictSeriesBatch(batch, startDate, endDate);
          allSeries.push(...batchSeries);
        } catch {
          continue;
        }
      }

      const nextRows = toRowsFromSeries(allSeries);

      if (nextRows.length === 0) {
        throw new Error("No daily records returned from API");
      }

      if (allSeries.length === 0) {
        throw new Error("No district series could be loaded");
      }

      setRows(nextRows);
      setDistrictCount(allSeries.length);

      const cachePayload: CachePayload = {
        rows: nextRows,
        districtCount: allSeries.length,
        fetchedAt: new Date().toISOString(),
      };

      sessionStorage.setItem(cacheKey, JSON.stringify(cachePayload));
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

      {error ? <p className={styles.error}>{error}</p> : null}

      {rows.length > 0 ? (
        <>
          <p className={styles.meta}>
            Loaded {rows.length} days ({loadedRange}) averaged across {districtCount} mapped districts
            {loadedFromCache ? " [cached]" : ""}
          </p>
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
        </>
      ) : (
        <p className={styles.hint}>
          Click Load data to fetch 10 years of daily weather and compute a map-wide district average.
        </p>
      )}
    </section>
  );
}
