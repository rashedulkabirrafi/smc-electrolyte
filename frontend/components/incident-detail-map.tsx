"use client";

import "leaflet/dist/leaflet.css";
import { GeoJSON, MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import { useEffect, useState } from "react";
import { apiUrl } from "../lib/api";

type GeoJsonFeature = {
  type: "Feature";
  geometry: any;
  properties: Record<string, unknown>;
};

type Props = {
  lat: number | null;
  lon: number | null;
  districtCode: string | null;
  title: string;
};

export default function IncidentDetailMap({ lat, lon, districtCode, title }: Props) {
  const [districtFeature, setDistrictFeature] = useState<GeoJsonFeature | null>(null);

  useEffect(() => {
    if (lat !== null && lon !== null) {
      setDistrictFeature(null);
      return;
    }
    if (!districtCode) {
      setDistrictFeature(null);
      return;
    }
    const loadDistrict = async () => {
      const res = await fetch(apiUrl(`/api/v1/admin/districts/${districtCode}`));
      if (!res.ok) return;
      setDistrictFeature((await res.json()) as GeoJsonFeature);
    };
    loadDistrict().catch(() => {
      setDistrictFeature(null);
    });
  }, [lat, lon, districtCode]);

  const center: [number, number] = lat !== null && lon !== null ? [lat, lon] : [23.685, 90.3563];
  const zoom = lat !== null && lon !== null ? 10 : 7;

  return (
    <div className="map-shell" style={{ marginTop: "0.5rem" }}>
      <MapContainer center={center} zoom={zoom} style={{ height: 320, width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {lat !== null && lon !== null ? (
          <Marker position={[lat, lon]}>
            <Popup>{title}</Popup>
          </Marker>
        ) : null}

        {lat === null && lon === null && districtFeature ? (
          <GeoJSON
            data={districtFeature as any}
            style={{
              color: "#b91c1c",
              weight: 2,
              fillColor: "#fca5a5",
              fillOpacity: 0.35,
            }}
          />
        ) : null}
      </MapContainer>
    </div>
  );
}
