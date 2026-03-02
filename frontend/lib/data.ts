import Papa from "papaparse";

export type IncidentRecord = {
  id: string;
  reporting_date: string;
  incident_date: string;
  district: string;
  dead: number;
  sick: number;
  casualties: number;
  place: string;
  description: string;
  source_name: string;
  source_url: string;
  latitude?: number;
  longitude?: number;
  location_precision?: string;
};

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeLooseText(value: string): string {
  return normalizeText(value).replace(/[^a-z0-9 ]/g, "");
}

function normalizeDate(value: string): string {
  const normalized = normalizeText(value);
  if (!normalized) return "";
  const parsed = Date.parse(normalized);
  if (Number.isNaN(parsed)) return normalized;
  return new Date(parsed).toISOString().slice(0, 10);
}

const DISTRICT_ALIAS: Record<string, string> = {
  barisal: "barishal",
  bogra: "bogura",
  chapainawabganj: "nawabganj",
  chittagong: "chattogram",
  comilla: "cumilla",
  jessore: "jashore",
};

const EXCLUDED_SOURCE_NAMES = new Set(["historical simulation"]);
const EXCLUDED_SOURCE_HOSTS = new Set(["archive-api.open-meteo.com"]);

function normalizeDistrict(value: string): string {
  const normalized = normalizeText(value).replace(/[^a-z0-9]/g, "");
  return DISTRICT_ALIAS[normalized] || normalized;
}

function sourceUrlWithScheme(value: string): string {
  const raw = normalizeText(value);
  if (!raw) return "";
  return /^[a-z][a-z0-9+.-]*:\/\//.test(raw) ? raw : `https://${raw}`;
}

function extractSourceHost(value: string): string {
  const withScheme = sourceUrlWithScheme(value);
  if (!withScheme) return "";

  try {
    const url = new URL(withScheme);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function normalizeSourceUrl(value: string): string {
  const withScheme = sourceUrlWithScheme(value);
  if (!withScheme) return "";

  try {
    const url = new URL(withScheme);
    const host = url.hostname.replace(/^www\./, "");
    const path = url.pathname.replace(/\/+$/, "");
    return `${host}${path}`;
  } catch {
    const raw = normalizeText(value);
    return raw.replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[?#]/)[0].replace(/\/+$/, "");
  }
}

function hasDirectSourceLink(row: IncidentRecord): boolean {
  const sourceName = normalizeText(row.source_name);
  if (!sourceName || EXCLUDED_SOURCE_NAMES.has(sourceName)) return false;

  const withScheme = sourceUrlWithScheme(row.source_url);
  if (!withScheme) return false;

  try {
    const url = new URL(withScheme);
    if (!/^https?:$/.test(url.protocol)) return false;
  } catch {
    return false;
  }

  const host = extractSourceHost(row.source_url);
  if (!host || EXCLUDED_SOURCE_HOSTS.has(host)) return false;

  return true;
}

function recordCompletenessScore(row: IncidentRecord): number {
  let score = 0;
  if (normalizeText(row.source_url)) score += 3;
  if (normalizeText(row.source_name)) score += 2;
  if (normalizeText(row.description)) score += 2;
  if (normalizeText(row.place)) score += 1;
  return score;
}

function toNumber(value: string | number | undefined): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (!value) return 0;
  const parsed = Number.parseFloat(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function dedupeIncidents(rows: IncidentRecord[]): IncidentRecord[] {
  const seenStrict = new Set<string>();
  const seenSoft = new Map<string, number>();
  const deduped: IncidentRecord[] = [];

  for (const row of rows) {
    const strictKey = [
      normalizeDate(row.reporting_date),
      normalizeDate(row.incident_date),
      normalizeDistrict(row.district),
      String(row.dead || 0),
      String(row.sick || 0),
      String(row.casualties || 0),
      Number.isFinite(row.latitude) ? row.latitude?.toFixed(6) : "",
      Number.isFinite(row.longitude) ? row.longitude?.toFixed(6) : "",
      normalizeText(row.place),
      normalizeText(row.description),
      normalizeText(row.source_name),
      normalizeSourceUrl(row.source_url),
    ].join("|");

    if (seenStrict.has(strictKey)) continue;

    const softKey = [
      normalizeDate(row.reporting_date),
      normalizeDate(row.incident_date),
      normalizeDistrict(row.district),
      String(row.dead || 0),
      String(row.sick || 0),
      String(row.casualties || 0),
      normalizeLooseText(row.place),
      normalizeLooseText(row.description),
    ].join("|");

    const existingIndex = seenSoft.get(softKey);
    if (existingIndex !== undefined) {
      const existing = deduped[existingIndex];
      const existingScore = recordCompletenessScore(existing);
      const nextScore = recordCompletenessScore(row);

      if (nextScore > existingScore) {
        deduped[existingIndex] = row;
      }
      seenStrict.add(strictKey);
      continue;
    }

    seenSoft.set(softKey, deduped.length);
    seenStrict.add(strictKey);
    deduped.push(row);
  }

  return deduped;
}

export async function loadIncidentsCsv(): Promise<IncidentRecord[]> {
  const response = await fetch("/data/heatstroke_incidents.csv", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load incidents CSV (${response.status})`);
  }

  const text = await response.text();
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0) {
    throw new Error(parsed.errors[0]?.message || "Failed to parse CSV.");
  }

  const mapped = parsed.data.map((row, index) => {
    const dead = toNumber(row.dead ?? row.deaths ?? row.fatalities ?? row.casualties);
    const sick = toNumber(
      row.sick ?? row.injured ?? row.hospitalized ?? row.hospitalised ?? row.ill
    );

    return {
      id: row.id?.trim() || String(index + 1),
      reporting_date: row.reporting_date?.trim() || "",
      incident_date: row.incident_date?.trim() || "",
      district: row.district?.trim() || "",
      dead,
      sick,
      casualties: dead + sick,
      place: row.place?.trim() || "",
      description: row.description?.trim() || "",
      source_name: row.source_name?.trim() || "",
      source_url: row.source_url?.trim() || "",
      latitude: toCoordinate(row.latitude ?? row.lat),
      longitude: toCoordinate(row.longitude ?? row.lng ?? row.lon),
      location_precision: row.location_precision?.trim() || "",
    };
  });

  const sourceBacked = mapped.filter(hasDirectSourceLink);
  return dedupeIncidents(sourceBacked);
}

export function exportIncidentsCsv(rows: IncidentRecord[]): string {
  return Papa.unparse(
    rows.map((row) => ({
      id: row.id,
      reporting_date: row.reporting_date,
      incident_date: row.incident_date,
      district: row.district,
      dead: row.dead,
      sick: row.sick,
      casualties: row.casualties,
      place: row.place,
      description: row.description,
      source_name: row.source_name,
      source_url: row.source_url,
      latitude: row.latitude ?? "",
      longitude: row.longitude ?? "",
      location_precision: row.location_precision ?? "",
    }))
  );
}

function toCoordinate(value: string | number | undefined): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (!value) return undefined;
  const parsed = Number.parseFloat(String(value).trim());
  return Number.isFinite(parsed) ? parsed : undefined;
}
