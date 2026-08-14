"use client";

import { useEffect, useRef, useCallback } from "react";
import { MapContainer, TileLayer, GeoJSON, useMap, useMapEvents, Marker, Polyline, Popup } from "react-leaflet";
import L from "leaflet";
import { OsmRouteCollection, OsmRouteProperties } from "@/data/routes";
import { getDifficulty } from "@/data/difficulty";
import { Difficulty } from "@/types/route";
import { Waypoint } from "./RoutePlanner";

interface Props {
  routes: OsmRouteCollection;
  plannedRoute: [number, number][] | null;
  waypoints: Waypoint[];
  clickMode: "none" | "start" | "end" | "via";
  onMapClick: (lat: number, lng: number) => void;
  onGreenLaneClick: (routeId: string, lat: number, lng: number) => void;
  selectedRouteId: string | null;
}

const difficultyColors: Record<Difficulty, string> = {
  unknown: "#888888",
  easy: "#2d6a4f",
  moderate: "#e9c46a",
  challenging: "#f4845f",
  extreme: "#e63946",
};

const startIcon = L.divIcon({ className: "", html: '<div style="background:#16a34a;width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div>', iconSize: [14, 14], iconAnchor: [7, 7] });
const endIcon = L.divIcon({ className: "", html: '<div style="background:#dc2626;width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div>', iconSize: [14, 14], iconAnchor: [7, 7] });
const viaIcon = L.divIcon({ className: "", html: '<div style="background:#2563eb;width:10px;height:10px;border-radius:50%;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div>', iconSize: [10, 10], iconAnchor: [5, 5] });

function ClickHandler({ mode, onMapClick }: { mode: string; onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      if (mode !== "none") {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

function FitBounds({ routes }: { routes: OsmRouteCollection }) {
  const map = useMap();
  const hasFit = useRef(false);
  useEffect(() => {
    if (hasFit.current || routes.features.length === 0) return;
    hasFit.current = true;
    const group = L.featureGroup();
    routes.features.forEach((feature) => {
      const coords = feature.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]);
      L.polyline(coords).addTo(group);
    });
    const bounds = group.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds.pad(0.05));
    group.remove();
  }, [routes, map]);
  return null;
}

export default function PlannerMap({ routes, plannedRoute, waypoints, clickMode, onMapClick, onGreenLaneClick, selectedRouteId }: Props) {
  const onEachFeature = useCallback((feature: any, layer: L.Layer) => {
    const props = feature.properties as OsmRouteProperties;
    const difficulty = getDifficulty(props);
    const restricted = props.motor_vehicle === "no" ? " [RESTRICTED]" : "";
    (layer as any).bindTooltip(
      `<strong>${props.name}</strong>${restricted}<br/>${props.type} | ${difficulty}<br/>Surface: ${props.surface}<br/><em>Click to add to route</em>`,
      { sticky: true }
    );
    layer.on("click", (e: any) => {
      L.DomEvent.stopPropagation(e);
      const latlng = e.latlng;
      onGreenLaneClick(props.id, latlng.lat, latlng.lng);
    });
  }, [onGreenLaneClick]);

  const style = useCallback((feature: any) => {
    const props = feature?.properties as OsmRouteProperties;
    const difficulty = getDifficulty(props);
    return {
      color: difficultyColors[difficulty],
      weight: 3,
      opacity: 0.6,
    };
  }, []);

  // Convert planned route from [lng,lat] to [lat,lng] for Leaflet
  const routeLine = plannedRoute
    ? plannedRoute.map(([lng, lat]) => [lat, lng] as [number, number])
    : null;

  return (
    <MapContainer center={[54.4, -1.9]} zoom={9} className="h-full w-full" zoomControl={true}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds routes={routes} />
      <ClickHandler mode={clickMode} onMapClick={onMapClick} />

      {/* Green lane overlay */}
      <GeoJSON
        key={routes.features.length.toString()}
        data={routes as any}
        style={style}
        onEachFeature={onEachFeature}
      />

      {/* Planned route line */}
      {routeLine && (
        <Polyline positions={routeLine} color="#3b82f6" weight={5} opacity={0.9} />
      )}

      {/* Waypoint markers */}
      {waypoints.map((wp, idx) => {
        const icon = idx === 0 ? startIcon : idx === waypoints.length - 1 ? endIcon : viaIcon;
        return (
          <Marker key={wp.id} position={[wp.lat, wp.lng]} icon={icon}>
            <Popup>
              <span className="text-xs">
                {idx === 0 ? "Start" : idx === waypoints.length - 1 ? "End" : `Via ${idx}`}
                {wp.greenLane && <><br/>{wp.greenLane.properties.name}</>}
              </span>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
