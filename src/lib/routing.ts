/**
 * Routing service using OSRM for road segments.
 * Green lane segments use their actual OSM geometry directly.
 */

const OSRM_URL = "https://router.project-osrm.org/route/v1/driving";

export interface RoutingResult {
  coordinates: [number, number][]; // [lng, lat][]
  distance: number; // miles
  duration: number; // seconds
}

/**
 * Get a road route between two points using OSRM.
 */
export async function getRoute(waypoints: { lat: number; lng: number }[]): Promise<RoutingResult> {
  if (waypoints.length < 2) throw new Error("Need at least 2 waypoints");

  const coords = waypoints.map((w) => `${w.lng},${w.lat}`).join(";");
  const url = `${OSRM_URL}/${coords}?overview=full&geometries=geojson&steps=false`;

  const response = await fetch(url);
  if (!response.ok) throw new Error("Routing service unavailable");

  const data = await response.json();
  if (data.code !== "Ok" || !data.routes?.[0]) throw new Error("No route found");

  const route = data.routes[0];
  return {
    coordinates: route.geometry.coordinates as [number, number][],
    distance: Math.round((route.distance / 1609.34) * 10) / 10,
    duration: Math.round(route.duration),
  };
}

/**
 * Get a road route between just two points.
 */
export async function getSegmentRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): Promise<RoutingResult> {
  return getRoute([from, to]);
}

/**
 * Find the nearest point on any green lane to a given coordinate.
 */
export function findNearestGreenLane(
  lat: number,
  lng: number,
  features: any[],
  maxDistKm: number = 0.1
): { featureId: string; point: [number, number]; distance: number } | null {
  let nearest: { featureId: string; point: [number, number]; distance: number } | null = null;

  for (const feature of features) {
    const coords = feature.geometry.coordinates as [number, number][];
    for (const coord of coords) {
      const dist = haversineQuick(lat, lng, coord[1], coord[0]);
      if (dist < maxDistKm && (!nearest || dist < nearest.distance)) {
        nearest = { featureId: feature.properties.id, point: coord, distance: dist };
      }
    }
  }
  return nearest;
}

function haversineQuick(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Build a complete route that stitches road segments (OSRM) with green lane geometry.
 * 
 * For each segment between waypoints:
 *   - If the next waypoint is a green lane: route road to lane start, then use lane geometry
 *   - If it's a normal point: route road to road
 */
export async function buildStitchedRoute(
  waypoints: { lat: number; lng: number; greenLane?: any }[]
): Promise<{ coordinates: [number, number][]; distance: number; duration: number }> {
  const allCoords: [number, number][] = [];
  let totalDistance = 0;
  let totalDuration = 0;

  for (let i = 0; i < waypoints.length - 1; i++) {
    const from = waypoints[i];
    const to = waypoints[i + 1];

    if (to.greenLane) {
      // Route from current point to the START of the green lane via road
      const laneCoords = to.greenLane.geometry.coordinates as [number, number][];
      const laneStart = laneCoords[0]; // [lng, lat]
      const laneEnd = laneCoords[laneCoords.length - 1];

      // Determine which end of the lane is closer to "from"
      const distToStart = haversineQuick(from.lat, from.lng, laneStart[1], laneStart[0]);
      const distToEnd = haversineQuick(from.lat, from.lng, laneEnd[1], laneEnd[0]);
      const useReverse = distToEnd < distToStart;
      const entryPoint = useReverse ? laneEnd : laneStart;

      try {
        // Road route to the lane entry
        const roadToLane = await getSegmentRoute(
          { lat: from.lat, lng: from.lng },
          { lat: entryPoint[1], lng: entryPoint[0] }
        );
        allCoords.push(...roadToLane.coordinates);
        totalDistance += roadToLane.distance;
        totalDuration += roadToLane.duration;
      } catch {
        // If road routing fails, just connect directly
      }

      // Add the green lane geometry itself
      const orderedLane = useReverse ? [...laneCoords].reverse() : laneCoords;
      allCoords.push(...orderedLane);

      // Estimate lane distance (crude: count coord pairs)
      const laneDistKm = laneCoords.reduce((sum, coord, idx) => {
        if (idx === 0) return 0;
        const prev = laneCoords[idx - 1];
        return sum + haversineQuick(prev[1], prev[0], coord[1], coord[0]);
      }, 0);
      totalDistance += Math.round((laneDistKm / 1.609) * 10) / 10; // km to miles
    } else {
      // Normal road routing
      try {
        const roadSeg = await getSegmentRoute(
          { lat: from.lat, lng: from.lng },
          { lat: to.lat, lng: to.lng }
        );
        allCoords.push(...roadSeg.coordinates);
        totalDistance += roadSeg.distance;
        totalDuration += roadSeg.duration;
      } catch {
        // Direct line fallback
        allCoords.push([from.lng, from.lat], [to.lng, to.lat]);
      }
    }
  }

  // If last waypoint is a green lane, route from lane exit to nothing (it's the end)
  // Handle: route from last green lane exit back to road if there's a non-lane waypoint after
  const lastWp = waypoints[waypoints.length - 1];
  if (lastWp.greenLane && waypoints.length > 1) {
    // Already handled in the loop above
  }

  return {
    coordinates: allCoords,
    distance: Math.round(totalDistance * 10) / 10,
    duration: totalDuration,
  };
}
