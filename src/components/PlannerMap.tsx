"use client";

import { useEffect, useRef, useCallback, useState } from "react";
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
  onWaypointDrag: (id: string, lat: number, lng: number) => void;
  onRouteLineDrag: (lat: number, lng: number, segmentIndex: number) => void;
  selectedRouteId: string | null;
}

const difficultyColors: Record<Difficulty, string> = {
  unknown: "#888888",
  easy: "#2d6a4f",
  moderate: "#e9c46a",
  challenging: "#f4845f",
  extreme: "#e63946",
};

const startIcon = L.divIcon({ className: "", html: '<div style="background:#16a34a;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);cursor:grab"></div>', iconSize: [16, 16], iconAnchor: [8, 8] });
const endIcon = L.divIcon({ className: "", html: '<div style="background:#dc2626;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);cursor:grab"></div>', iconSize: [16, 16], iconAnchor: [8, 8] });
const viaIcon = L.divIcon({ className: "", html: '<div style="background:#2563eb;width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);cursor:grab"></div>', iconSize: [12, 12], iconAnchor: [6, 6] });
const dragHintIcon = L.divIcon({ className: "", html: '<div style="background:white;width:10px;height:10px;border-radius:50%;border:2px solid #3b82f6;opacity:0.7;cursor:grab"></div>', iconSize: [10, 10], iconAnchor: [5, 5] });

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

/**
 * Draggable marker component that reports its new position on drag end.
 */
function DraggableWaypoint({ wp, idx, total, onDragEnd }: {
  wp: Waypoint;
  idx: number;
  total: number;
  onDragEnd: (id: string, lat: number, lng: number) => void;
}) {
  const icon = idx === 0 ? startIcon : idx === total - 1 ? endIcon : viaIcon;
  const markerRef = useRef<L.Marker | null>(null);

  const eventHandlers = {
    dragend() {
      const marker = markerRef.current;
      if (marker) {
        const pos = marker.getLatLng();
        onDragEnd(wp.id, pos.lat, pos.lng);
      }
    },
  };

  return (
    <Marker
      position={[wp.lat, wp.lng]}
      icon={icon}
      draggable={true}
      eventHandlers={eventHandlers}
      ref={markerRef}
    >
      <Popup>
        <span className="text-xs">
          {idx === 0 ? "Start (drag to move)" : idx === total - 1 ? "End (drag to move)" : `Via point ${idx} (drag to move)`}
          {wp.greenLane && <><br/><strong>{wp.greenLane.properties.name}</strong></>}
        </span>
      </Popup>
    </Marker>
  );
}

/**
 * Mid-point markers placed ON the actual route line between waypoints.
 * Dragging these inserts a new via-point.
 */
function MidpointMarkers({ waypoints, routeCoords, onDrag }: {
  waypoints: Waypoint[];
  routeCoords: [number, number][] | null;
  onDrag: (lat: number, lng: number, segmentIndex: number) => void;
}) {
  if (!routeCoords || routeCoords.length < 2 || waypoints.length < 2) return null;

  // For each segment between waypoints, find the midpoint on the actual route line
  const totalPoints = routeCoords.length;
  const segCount = waypoints.length - 1;
  const pointsPerSeg = Math.floor(totalPoints / segCount);

  const midpoints: { lat: number; lng: number; segIdx: number }[] = [];
  for (let i = 0; i < segCount; i++) {
    const midIdx = Math.min(Math.floor((i + 0.5) * pointsPerSeg), totalPoints - 1);
    const coord = routeCoords[midIdx]; // [lng, lat]
    midpoints.push({ lat: coord[1], lng: coord[0], segIdx: i });
  }

  return (
    <>
      {midpoints.map((mp, idx) => (
        <MidpointDragMarker key={`mid-${idx}-${mp.lat.toFixed(4)}`} lat={mp.lat} lng={mp.lng} segIdx={mp.segIdx} onDrag={onDrag} />
      ))}
    </>
  );
}

function MidpointDragMarker({ lat, lng, segIdx, onDrag }: {
  lat: number; lng: number; segIdx: number;
  onDrag: (lat: number, lng: number, segmentIndex: number) => void;
}) {
  const markerRef = useRef<L.Marker | null>(null);

  const eventHandlers = {
    dragend() {
      const marker = markerRef.current;
      if (marker) {
        const pos = marker.getLatLng();
        onDrag(pos.lat, pos.lng, segIdx);
      }
    },
  };

  return (
    <Marker
      position={[lat, lng]}
      icon={dragHintIcon}
      draggable={true}
      eventHandlers={eventHandlers}
      ref={markerRef}
    />
  );
}

export default function PlannerMap({ routes, plannedRoute, waypoints, clickMode, onMapClick, onGreenLaneClick, onWaypointDrag, onRouteLineDrag, selectedRouteId }: Props) {
  // Use ref so the GeoJSON layer click always calls the latest callback
  const greenLaneClickRef = useRef(onGreenLaneClick);
  greenLaneClickRef.current = onGreenLaneClick;

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
      greenLaneClickRef.current(props.id, e.latlng.lat, e.latlng.lng);
    });
  }, []);

  const style = useCallback((feature: any) => {
    const props = feature?.properties as OsmRouteProperties;
    const difficulty = getDifficulty(props);
    return {
      color: difficultyColors[difficulty],
      weight: 3,
      opacity: 0.6,
    };
  }, []);

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
        <Polyline positions={routeLine} color="#3b82f6" weight={5} opacity={0.85} />
      )}

      {/* Midpoint drag handles (between waypoints) */}
      <MidpointMarkers waypoints={waypoints} routeCoords={plannedRoute} onDrag={onRouteLineDrag} />

      {/* Draggable waypoint markers */}
      {waypoints.map((wp, idx) => (
        <DraggableWaypoint key={wp.id} wp={wp} idx={idx} total={waypoints.length} onDragEnd={onWaypointDrag} />
      ))}
    </MapContainer>
  );
}
