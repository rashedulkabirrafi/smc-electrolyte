export interface DemandInputs {
  population: number;
  density_normalized: number;
  heat_tier: number;
  heat_index_p50: number;
  anom_hi: number;
  per_capita_base_rate?: number;
  sku_pack_size?: number;
}

export interface DemandOutput {
  base_demand_units: number;
  adjusted_demand_units: number;
  demand_cases: number;
  heat_multiplier: number;
  density_weight: number;
  anomaly_factor: number;
  demand_tier: "standard" | "elevated" | "surge" | "critical";
  recommended_reorder_flag: boolean;
}

const HEAT_MULTIPLIERS: Record<number, number> = {
  0: 0.8,
  1: 1.0,
  2: 1.35,
  3: 1.75,
  4: 2.3,
};

export function calculateDistrictDemand(inputs: DemandInputs): DemandOutput {
  const {
    population,
    density_normalized,
    heat_tier,
    anom_hi,
    per_capita_base_rate = 0.05,
    sku_pack_size = 24,
  } = inputs;

  const base_demand_units = population * per_capita_base_rate;
  const heat_multiplier = HEAT_MULTIPLIERS[heat_tier] ?? 1;
  const density_weight = 1 + density_normalized * 0.5;
  const anomaly_factor = Math.min(1 + Math.max(0, anom_hi) / 10, 1.5);
  const adjusted_demand_units = base_demand_units * heat_multiplier * density_weight * anomaly_factor;
  const demand_cases = Math.ceil(adjusted_demand_units / Math.max(sku_pack_size, 1));
  const uplift = adjusted_demand_units / Math.max(base_demand_units, 1);

  const demand_tier =
    uplift >= 2 ? "critical" : uplift >= 1.5 ? "surge" : uplift >= 1.2 ? "elevated" : "standard";

  return {
    base_demand_units: Math.round(base_demand_units),
    adjusted_demand_units: Math.round(adjusted_demand_units),
    demand_cases,
    heat_multiplier,
    density_weight: Number(density_weight.toFixed(2)),
    anomaly_factor: Number(anomaly_factor.toFixed(2)),
    demand_tier,
    recommended_reorder_flag: demand_tier === "surge" || demand_tier === "critical",
  };
}

