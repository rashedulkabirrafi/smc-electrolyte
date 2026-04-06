"use client";

import { AmbientLight, DirectionalLight, LightingEffect } from "@deck.gl/core";
import DeckGL from "@deck.gl/react";
import { ColumnLayer, GeoJsonLayer } from "@deck.gl/layers";
import { useMemo, useState } from "react";
import { Map } from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";

import {
  buildGeoJsonForDeck,
  buildPopulationSpikeField,
  type DistrictSpikeData,
  type PopulationSpikePoint,
} from "../../lib/populationMapData";
import { Button } from "../ui/Button";
import styles from "./population-map.module.css";

const INITIAL_VIEW_STATE = {
  longitude: 90.3563,
  latitude: 23.685,
  zoom: 6.35,
  pitch: 50,
  bearing: -12,
  minZoom: 5.3,
  maxZoom: 12,
};

const COLUMN_RADIUS = 220;
const ambientLight = new AmbientLight({ color: [255, 252, 246], intensity: 1.3 });
const directionalLight = new DirectionalLight({
  color: [255, 235, 225],
  intensity: 2.8,
  direction: [-3.5, -7.5, -11],
});
const effects = [new LightingEffect({ ambientLight, directionalLight })];

const MAP_STYLE = {
  version: 8,
  sources: {
    carto: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png",
        "https://b.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png",
        "https://c.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
    },
  },
  layers: [{ id: "carto-base", type: "raster", source: "carto" }],
} as const;

function interpolateChannel(start: number, end: number, ratio: number): number {
  return Math.round(start + (end - start) * ratio);
}

function spikeColor(intensity: number, highlighted: boolean): [number, number, number, number] {
  const clamped = Math.max(0, Math.min(1, intensity));
  const gradient =
    clamped < 0.45
      ? [
          interpolateChannel(85, 115, clamped / 0.45),
          interpolateChannel(82, 70, clamped / 0.45),
          interpolateChannel(235, 255, clamped / 0.45),
        ]
      : [
          interpolateChannel(115, 194, (clamped - 0.45) / 0.55),
          interpolateChannel(70, 18, (clamped - 0.45) / 0.55),
          interpolateChannel(255, 82, (clamped - 0.45) / 0.55),
        ];

  return [gradient[0], gradient[1], gradient[2], highlighted ? 255 : 210];
}

type HoverState = {
  district: DistrictSpikeData;
  x: number;
  y: number;
} | null;

export function PopulationSpikeMap({
  data,
  elevationScale = 1,
  selectedPcode,
  onDistrictClick,
}: {
  data: DistrictSpikeData[];
  elevationScale?: number;
  selectedPcode?: string;
  onDistrictClick?: (district: DistrictSpikeData) => void;
}) {
  const [hoverState, setHoverState] = useState<HoverState>(null);
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);

  const districtGeoJson = useMemo(() => buildGeoJsonForDeck(data), [data]);
  const spikeField = useMemo(() => buildPopulationSpikeField(data), [data]);
  const districtByPcode = useMemo(
    () => new globalThis.Map(data.map((district) => [district.pcode, district])),
    [data]
  );

  const layers = useMemo(
    () => [
      new GeoJsonLayer({
        id: "population-density-base",
        data: districtGeoJson,
        filled: true,
        stroked: true,
        pickable: false,
        getFillColor: [246, 244, 252, 36],
        getLineColor: [102, 93, 177, 48],
        lineWidthMinPixels: 0.4,
      }),
      new ColumnLayer<PopulationSpikePoint>({
        id: "population-density-spikes",
        data: spikeField,
        radius: COLUMN_RADIUS,
        coverage: 0.72,
        diskResolution: 6,
        extruded: true,
        pickable: true,
        material: {
          ambient: 0.32,
          diffuse: 0.88,
          shininess: 44,
          specularColor: [255, 255, 255],
        },
        getElevation: (point) => point.height_m * elevationScale,
        getPosition: (point) => [point.longitude, point.latitude],
        getFillColor: (point) => spikeColor(point.intensity, point.pcode === selectedPcode),
        getLineColor: [255, 255, 255, 0],
        lineWidthMinPixels: 0,
        elevationScale,
        onHover: (info) => {
          if (!info.object) {
            setHoverState(null);
            return;
          }
          const district = districtByPcode.get(info.object.pcode);
          if (!district) {
            setHoverState(null);
            return;
          }
          setHoverState({ district, x: info.x, y: info.y });
        },
        onClick: (info) => {
          if (!info.object) return;
          const district = districtByPcode.get(info.object.pcode);
          if (district) {
            onDistrictClick?.(district);
          }
        },
        updateTriggers: {
          getFillColor: [spikeField, selectedPcode],
          getLineColor: [selectedPcode],
          getElevation: [spikeField, elevationScale],
        },
      }),
    ],
    [districtByPcode, districtGeoJson, elevationScale, onDistrictClick, selectedPcode, spikeField]
  );

  const densestDistricts = useMemo(
    () => [...data].sort((a, b) => b.density - a.density).slice(0, 5),
    [data]
  );

  return (
    <div className={styles.mapShell}>
      <DeckGL
        controller={{ dragRotate: true, touchRotate: true }}
        effects={effects}
        layers={layers}
        viewState={viewState}
        onViewStateChange={(event) => setViewState(event.viewState as typeof INITIAL_VIEW_STATE)}
        style={{ position: "absolute", top: "0", right: "0", bottom: "0", left: "0" }}
      >
        <Map mapLib={maplibregl} mapStyle={MAP_STYLE as never} reuseMaps />
      </DeckGL>

      <div className={styles.controlStack}>
        <Button type="button" variant="secondary" onClick={() => setViewState(INITIAL_VIEW_STATE)}>
          Reset View
        </Button>
      </div>

      <div className={styles.legend}>
        <div className={styles.legendTitle}>Population Density</div>
        <div
          className={styles.legendGradient}
          style={{ background: "linear-gradient(to right, #5552eb, #8f63ff, #ef4f9a, #b40f38)" }}
        />
        <div className={styles.legendLabels}>
          <span>Low</span>
          <span>High</span>
        </div>
        <div className={styles.legendTitle}>Top 5 densest</div>
        <div className={styles.legendList}>
          {densestDistricts.map((district) => (
            <div key={district.pcode} className={styles.legendItem}>
              <span className={styles.legendItemName}>{district.district}</span>
              <span className={styles.legendItemValue}>{district.density.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      {hoverState ? (
        <div
          className={styles.tooltip}
          style={{ left: `${hoverState.x + 12}px`, top: `${hoverState.y - 104}px` }}
        >
          <div className={styles.tooltipTitle}>{hoverState.district.district}</div>
          <div className={styles.tooltipMeta}>{hoverState.district.division} Division</div>
          <div className={styles.tooltipRows}>
            <TooltipRow label="Population" value={hoverState.district.population.toLocaleString()} />
            <TooltipRow label="Area" value={`${hoverState.district.area_km2.toLocaleString()} km²`} />
            <TooltipRow
              label="Density"
              value={`${hoverState.district.density.toLocaleString()} /km²`}
              mono
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TooltipRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className={styles.tooltipRow}>
      <span className={styles.tooltipLabel}>{label}</span>
      <span className={`${styles.tooltipValue} ${mono ? styles.mono : ""}`.trim()}>{value}</span>
    </div>
  );
}
