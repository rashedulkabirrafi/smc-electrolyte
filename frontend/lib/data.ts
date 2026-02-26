import Papa from "papaparse";

export type IncidentRecord = {
  id: string;
  reporting_date: string;
  incident_date: string;
  district: string;
  casualties: number;
  place: string;
  description: string;
  source_name: string;
  source_url: string;
};

function toNumber(value: string | number | undefined): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (!value) return 0;
  const parsed = Number.parseFloat(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
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

  return parsed.data.map((row, index) => ({
    id: row.id?.trim() || String(index + 1),
    reporting_date: row.reporting_date?.trim() || "",
    incident_date: row.incident_date?.trim() || "",
    district: row.district?.trim() || "",
    casualties: toNumber(row.casualties),
    place: row.place?.trim() || "",
    description: row.description?.trim() || "",
    source_name: row.source_name?.trim() || "",
    source_url: row.source_url?.trim() || "",
  }));
}

export function exportIncidentsCsv(rows: IncidentRecord[]): string {
  return Papa.unparse(
    rows.map((row) => ({
      id: row.id,
      reporting_date: row.reporting_date,
      incident_date: row.incident_date,
      district: row.district,
      casualties: row.casualties,
      place: row.place,
      description: row.description,
      source_name: row.source_name,
      source_url: row.source_url,
    }))
  );
}
