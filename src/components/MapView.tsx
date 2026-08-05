"use client";

import { useEffect, useRef, useCallback } from "react";
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import L from "leaflet";
import { OsmRouteCollection, OsmRouteProperties } from "@/data/routes";
import { getDifficulty } from "@/data/difficulty";
import { Difficulty } from "@/types/route";

interface MapViewProps {
  routes: OsmRouteCollection;
  onSelectRoute: (routeId: string) => void;
  selectedRouteId: string | null;
}

const difficultyColors: Record<Difficulty, string> = {
  unknown: "#888888",
  easy: "#2d6a4f",
  moderate: "#e9c46a",
  challenging: "#f4845f",
  extreme: "#e63946",
};

function FitBounds({ routes }: { routes: OsmRouteCollection }) {
  const map = useMap();
  const hasFit = useRef(false);

  useEffect(() => {
    if (hasFit.current || routes.features.length === 0) return;
    hasFit.current = true;

    const group = L.featureGroup();
    routes.features.forEach((feature) => {
      const coords = feature.geometry.coordinates.map(
        ([lng, lat]) => [lat, lng] as [number, number]
      );
      L.polyline(coords).addTo(group);
    });
    const bounds = group.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds.pad(0.05));
    group.remove();
  }, [routes, map]);

  return null;
}

export default function MapView({ routes, onSelectRoute, selectedRouteId }: MapViewProps) {
  const geoJsonRef = useRef<L.GeoJSON | null>(null);
  const selectedIdRef = useRef<string | null>(selectedRouteId);

  // Update styles when selection changes without re-creating the layer
  useEffect(() => {
    selectedIdRef.current = selectedRouteId;
    if (geoJsonRef.current) {
      geoJsonRef.current.eachLayer((layer: any) => {
        const props = layer.feature?.properties as OsmRouteProperties;
        if (!props) return;
        const isSelected = props.id === selectedRouteId;
        const difficulty = getDifficulty(props);
        layer.setStyle({
          color: isSelected ? "#264653" : difficultyColors[difficulty],
          weight: isSelected ? 5 : 3,
          opacity: isSelected ? 1 : 0.75,
        });
        if (isSelected) layer.bringToFront();
      });
    }
  }, [selectedRouteId]);

  const onEachFeature = useCallback((feature: any, layer: L.Layer) => {
    const props = feature.properties as OsmRouteProperties;
    const difficulty = getDifficulty(props);
    const restricted = props.motor_vehicle === "no" ? " [RESTRICTED]" : "";
    (layer as any).bindTooltip(
      `<strong>${props.name}</strong>${restricted}<br/>${props.type} | ${difficulty}<br/>Surface: ${props.surface}`,
      { sticky: true }
    );
    layer.on("click", () => onSelectRoute(props.id));
  }, [onSelectRoute]);

  const style = useCallback((feature: any) => {
    const props = feature?.properties as OsmRouteProperties;
    const isSelected = props?.id === selectedIdRef.current;
    const difficulty = getDifficulty(props);
    return {
      color: isSelected ? "#264653" : difficultyColors[difficulty],
      weight: isSelected ? 5 : 3,
      opacity: isSelected ? 1 : 0.75,
    };
  }, []);

  return (
    <MapContainer center={[54.4, -1.9]} zoom={9} className="h-full w-full" zoomControl={true}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds routes={routes} />
      <GeoJSON
        key={routes.features.length.toString()}
        ref={(ref) => { geoJsonRef.current = ref; }}
        data={routes as any}
        style={style}
        onEachFeature={onEachFeature}
      />
    </MapContainer>
  );
}
