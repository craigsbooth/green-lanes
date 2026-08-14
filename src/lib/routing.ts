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

async function getSegmentRoute(
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
 * Build a stitched route: road → green lane → road → green lane → road...
 *
 * Key insight: when a waypoint has a greenLane, we treat it as a SEGMENT to traverse,
 * not a point to pass through. The routing is:
 * 
 *   previous point --[road]--> lane ENTRY --[lane geometry]--> lane EXIT --[road]--> next point
 *
 * We figure out which end of the lane is the "entry" (closest to previous point)
 * and which is the "exit" (closest to next point).
 */
export async function buildStitchedRoute(
  waypoints: { lat: number; lng: number; greenLane?: any }[]
): Promise<{ coordinates: [number, number][]; distance: number; duration: number }> {
  const allCoords: [number, number][] = [];
  let totalDistance = 0;
  let totalDuration = 0;

  // Build a list of "effective points" that the route must pass through.
  // For green lane waypoints, we expand them into entry + exit points.
  interface EffectiveSegment {
    type: "road";
    from: { lat: number; lng: number };
    to: { lat: number; lng: number };
  }
  interface LaneSegment {
    type: "lane";
    coords: [number, number][];
  }

  const segments: (EffectiveSegment | LaneSegment)[] = [];

  // Current position tracks where we are after each segment
  let currentPos = { lat: waypoints[0].lat, lng: waypoints[0].lng };

  for (let i = 1; i < waypoints.length; i++) {
    const wp = waypoints[i];

    if (wp.greenLane) {
      const laneCoords = wp.greenLane.geometry.coordinates as [number, number][];
      const laneStart = laneCoords[0]; // [lng, lat]
      const laneEnd = laneCoords[laneCoords.length - 1]; // [lng, lat]

      // Which end is closer to where we currently are? That's the entry.
      const distToStart = haversineQuick(currentPos.lat, currentPos.lng, laneStart[1], laneStart[0]);
      const distToEnd = haversineQuick(currentPos.lat, currentPos.lng, laneEnd[1], laneEnd[0]);

      let entry: [number, number];
      let exit: [number, number];
      let orderedCoords: [number, number][];

      if (distToStart <= distToEnd) {
        entry = laneStart;
        exit = laneEnd;
        orderedCoords = laneCoords;
      } else {
        entry = laneEnd;
        exit = laneStart;
        orderedCoords = [...laneCoords].reverse();
      }

      // Road from current position to lane entry
      segments.push({
        type: "road",
        from: { lat: currentPos.lat, lng: currentPos.lng },
        to: { lat: entry[1], lng: entry[0] },
      });

      // The green lane itself
      segments.push({ type: "lane", coords: orderedCoords });

      // Update current position to lane exit
      currentPos = { lat: exit[1], lng: exit[0] };
    } else {
      // Normal road waypoint
      segments.push({
        type: "road",
        from: { lat: currentPos.lat, lng: currentPos.lng },
        to: { lat: wp.lat, lng: wp.lng },
      });
      currentPos = { lat: wp.lat, lng: wp.lng };
    }
  }

  // Now execute each segment
  for (const seg of segments) {
    if (seg.type === "road") {
      // Skip zero-distance segments
      const dist = haversineQuick(seg.from.lat, seg.from.lng, seg.to.lat, seg.to.lng);
      if (dist < 0.01) continue; // less than 10m, skip

      try {
        const result = await getSegmentRoute(seg.from, seg.to);
        allCoords.push(...result.coordinates);
        totalDistance += result.distance;
        totalDuration += result.duration;
      } catch {
        // Direct line fallback
        allCoords.push([seg.from.lng, seg.from.lat], [seg.to.lng, seg.to.lat]);
      }
    } else {
      // Lane geometry - add directly
      allCoords.push(...seg.coords);
      // Calculate lane distance
      let laneDist = 0;
      for (let j = 1; j < seg.coords.length; j++) {
        laneDist += haversineQuick(seg.coords[j-1][1], seg.coords[j-1][0], seg.coords[j][1], seg.coords[j][0]);
      }
      totalDistance += Math.round((laneDist / 1.609) * 10) / 10; // km to miles
      // Estimate duration at 15mph on green lane
      totalDuration += Math.round((laneDist / 1.609) / 15 * 3600);
    }
  }

  return {
    coordinates: allCoords,
    distance: Math.round(totalDistance * 10) / 10,
    duration: totalDuration,
  };
}
