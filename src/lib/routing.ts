/**
 * Routing service using OSRM (free, no API key needed).
 * Routes on normal roads. Green lane segments are spliced in manually.
 */

const OSRM_URL = "https://router.project-osrm.org/route/v1/driving";

export interface RoutePoint {
  lat: number;
  lng: number;
  type: "waypoint" | "greenLaneStart" | "greenLaneEnd";
}

export interface RoutingResult {
  coordinates: [number, number][]; // [lng, lat][]
  distance: number; // km
  duration: number; // seconds
}

/**
 * Get a road route between waypoints using OSRM.
 * Returns the route geometry as [lng, lat] coordinate pairs.
 */
export async function getRoute(waypoints: { lat: number; lng: number }[]): Promise<RoutingResult> {
  if (waypoints.length < 2) {
    throw new Error("Need at least 2 waypoints");
  }

  const coords = waypoints.map((w) => `${w.lng},${w.lat}`).join(";");
  const url = `${OSRM_URL}/${coords}?overview=full&geometries=geojson&steps=false`;

  const response = await fetch(url);
  if (!response.ok) throw new Error("Routing service unavailable");

  const data = await response.json();
  if (data.code !== "Ok" || !data.routes || data.routes.length === 0) {
    throw new Error("No route found");
  }

  const route = data.routes[0];
  return {
    coordinates: route.geometry.coordinates as [number, number][],
    distance: Math.round((route.distance / 1609.34) * 10) / 10, // metres to miles
    duration: Math.round(route.duration),
  };
}

/**
 * Get routes between each consecutive pair of waypoints.
 * This allows us to splice green lane segments between road sections.
 */
export async function getSegmentedRoute(
  waypoints: { lat: number; lng: number }[]
): Promise<RoutingResult[]> {
  const segments: RoutingResult[] = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const segment = await getRoute([waypoints[i], waypoints[i + 1]]);
    segments.push(segment);
  }
  return segments;
}

/**
 * Find the nearest point on any green lane to a given coordinate.
 * Used for snapping dragged waypoints to green lanes.
 */
export function findNearestGreenLane(
  lat: number,
  lng: number,
  features: any[],
  maxDistKm: number = 0.5
): { featureId: string; point: [number, number]; distance: number } | null {
  let nearest: { featureId: string; point: [number, number]; distance: number } | null = null;

  for (const feature of features) {
    const coords = feature.geometry.coordinates as [number, number][];
    for (const coord of coords) {
      const dist = haversineQuick(lat, lng, coord[1], coord[0]);
      if (dist < maxDistKm && (!nearest || dist < nearest.distance)) {
        nearest = {
          featureId: feature.properties.id,
          point: coord,
          distance: dist,
        };
      }
    }
  }

  return nearest;
}

function haversineQuick(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
