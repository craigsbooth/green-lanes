"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { RoutePlanner, Waypoint, RouteWarning } from "@/components/RoutePlanner";
import { greenLanes, OsmRoute } from "@/data/routes";
import { getRoute, RoutingResult, buildStitchedRoute } from "@/lib/routing";
import { generateGPX, downloadFile } from "@/lib/geo";
import { SpatialGrid } from "@/lib/spatial-index";

const PlannerMap = dynamic(() => import("@/components/PlannerMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-gray-100">
      <div className="animate-spin h-8 w-8 border-4 border-green-200 border-t-green-600 rounded-full"></div>
    </div>
  ),
});

export default function PlannerPage() {
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [clickMode, setClickMode] = useState<"none" | "start" | "end" | "via">("none");
  const [routeResult, setRouteResult] = useState<RoutingResult | null>(null);
  const [fullRouteCoords, setFullRouteCoords] = useState<[number, number][] | null>(null);
  const [greenLaneSegments, setGreenLaneSegments] = useState<{ lane: OsmRoute; startIdx: number; endIdx: number }[]>([]);
  const [warnings, setWarnings] = useState<RouteWarning[]>([]);
  const [isRouting, setIsRouting] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  // Refs to avoid stale closures in map callbacks
  const waypointsRef = useRef(waypoints);
  waypointsRef.current = waypoints;
  const clickModeRef = useRef(clickMode);
  clickModeRef.current = clickMode;

  const filteredRoutes = useMemo(() => greenLanes, []);

  // Build spatial index once for fast green lane lookups on drag
  const spatialGrid = useMemo(() => {
    const grid = new SpatialGrid(0.005); // ~550m cells
    grid.buildIndex(greenLanes.features as any);
    return grid;
  }, []);

  // Fast green lane detection using spatial index
  const detectGreenLane = useCallback((lat: number, lng: number): OsmRoute | undefined => {
    const nearest = spatialGrid.findNearest(lat, lng, 0.1); // 100m
    if (nearest) {
      return greenLanes.features.find((f) => f.properties.id === nearest.featureId);
    }
    return undefined;
  }, [spatialGrid]);

  const calculateRoute = useCallback(async (wps: Waypoint[]) => {
    if (wps.length < 2) {
      setRouteResult(null);
      setFullRouteCoords(null);
      return;
    }

    setIsRouting(true);
    setRouteError(null);
    try {
      // Use stitched routing: road segments via OSRM, green lane segments use actual geometry
      const result = await buildStitchedRoute(
        wps.map((w) => ({ lat: w.lat, lng: w.lng, greenLane: w.greenLane }))
      );
      if (result.coordinates.length === 0) {
        setRouteError("Could not calculate route. The routing service may be unavailable — try again in a moment.");
        setRouteResult(null);
        setFullRouteCoords(null);
      } else {
        setRouteResult(result);
        setFullRouteCoords(result.coordinates);
        generateWarnings(wps);
      }
    } catch (err) {
      setRouteError("Routing failed. Check your internet connection or try again later.");
      setRouteResult(null);
      setFullRouteCoords(null);
    }
    setIsRouting(false);
  }, []);

  const generateWarnings = (wps: Waypoint[]) => {
    const newWarnings: RouteWarning[] = [];
    for (const wp of wps) {
      if (wp.greenLane) {
        const props = wp.greenLane.properties;
        if (props.legalStatus === "tro_restricted" || props.motor_vehicle === "no") {
          newWarnings.push({
            waypointId: wp.id,
            type: "tro",
            message: "Traffic Regulation Order restricts motor vehicles. Check current status with the council.",
            laneName: props.name,
            overridden: false,
          });
        }
        if (props.surface === "unknown") {
          newWarnings.push({
            waypointId: wp.id,
            type: "unknown_surface",
            message: "Surface condition unknown. May be impassable in wet weather.",
            laneName: props.name,
            overridden: false,
          });
        }
      }
    }
    setWarnings(newWarnings);
  };

  const handleMapClick = useCallback((lat: number, lng: number) => {
    if (clickMode === "start") {
      const lane = detectGreenLane(lat, lng);
      const newWp: Waypoint = { id: "start", lat, lng, label: "Start", greenLane: lane };
      const updated = [newWp, ...waypoints.filter((w) => w.id !== "start")];
      setWaypoints(updated);
      setClickMode("none");
      calculateRoute(updated);
    } else if (clickMode === "end") {
      const lane = detectGreenLane(lat, lng);
      const newWp: Waypoint = { id: "end", lat, lng, label: "End", greenLane: lane };
      const updated = [...waypoints.filter((w) => w.id !== "end"), newWp];
      setWaypoints(updated);
      setClickMode("none");
      calculateRoute(updated);
    }
  }, [clickMode, waypoints, calculateRoute]);

  const handleGreenLaneClick = useCallback((routeId: string, lat: number, lng: number) => {
    // Don't add green lanes when we're in start/end click mode
    if (clickModeRef.current !== "none") return;

    // Need both start and end before adding via-points
    const wps = waypointsRef.current;
    const hasStart = wps.some((w) => w.id === "start");
    const hasEnd = wps.some((w) => w.id === "end");
    if (!hasStart || !hasEnd) return;

    const lane = greenLanes.features.find((f) => f.properties.id === routeId);
    if (!lane) return;

    // Don't add duplicate
    if (wps.find((w) => w.greenLane?.properties.id === routeId)) return;

    const wpId = `via-${Date.now()}`;
    const newWp: Waypoint = { id: wpId, lat, lng, label: lane.properties.name, greenLane: lane };

    const endIdx = wps.findIndex((w) => w.id === "end");
    let updated: Waypoint[];
    if (endIdx >= 0) {
      updated = [...wps.slice(0, endIdx), newWp, ...wps.slice(endIdx)];
    } else {
      updated = [...wps, newWp];
    }

    setWaypoints(updated);
    setGreenLaneSegments((prev) => [...prev, { lane, startIdx: 0, endIdx: 0 }]);
    calculateRoute(updated);
  }, [calculateRoute]);

  // DRAG: existing waypoint dragged to new position
  const handleWaypointDrag = useCallback((id: string, lat: number, lng: number) => {
    const wps = waypointsRef.current;
    const lane = detectGreenLane(lat, lng);
    const updated = wps.map((wp) =>
      wp.id === id ? { ...wp, lat, lng, greenLane: lane, label: lane ? lane.properties.name : wp.label } : wp
    );
    setWaypoints(updated);

    const lanes = updated.filter((w) => w.greenLane).map((w) => ({ lane: w.greenLane!, startIdx: 0, endIdx: 0 }));
    setGreenLaneSegments(lanes);

    calculateRoute(updated);
  }, [calculateRoute]);

  // DRAG: midpoint between waypoints dragged to create new via-point
  const handleRouteLineDrag = useCallback((lat: number, lng: number, segmentIndex: number) => {
    const wps = waypointsRef.current;
    const lane = detectGreenLane(lat, lng);
    const newWp: Waypoint = {
      id: `via-${Date.now()}`,
      lat,
      lng,
      label: lane ? lane.properties.name : "Via point",
      greenLane: lane,
    };

    const updated = [
      ...wps.slice(0, segmentIndex + 1),
      newWp,
      ...wps.slice(segmentIndex + 1),
    ];

    setWaypoints(updated);

    const lanes = updated.filter((w) => w.greenLane).map((w) => ({ lane: w.greenLane!, startIdx: 0, endIdx: 0 }));
    setGreenLaneSegments(lanes);

    calculateRoute(updated);
  }, [calculateRoute]);

  const handleOverrideWarning = useCallback((waypointId: string) => {
    setWarnings((prev) => prev.map((w) => w.waypointId === waypointId ? { ...w, overridden: true } : w));
  }, []);

  const handleExport = useCallback(() => {
    if (!fullRouteCoords) return;
    const laneNames = greenLaneSegments.map((s) => s.lane.properties.name).join(", ");
    const desc = `Planned route${laneNames ? " via " + laneNames : ""}. Total: ${routeResult?.distance || 0} miles.`;
    const gpx = generateGPX("Green Lane Route", desc, fullRouteCoords);
    downloadFile(gpx, "green-lane-route.gpx", "application/gpx+xml");
  }, [fullRouteCoords, greenLaneSegments, routeResult]);

  const handleClear = useCallback(() => {
    setWaypoints([]);
    setRouteResult(null);
    setFullRouteCoords(null);
    setGreenLaneSegments([]);
    setWarnings([]);
  }, []);

  const totalDistance = routeResult?.distance || 0;

  return (
    <main className="h-screen flex flex-col md:flex-row">
      <aside className="w-full md:w-96 bg-white shadow-lg z-10 overflow-y-auto border-r border-gray-200 md:max-h-screen max-h-[40vh]">
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h1 className="font-bold text-gray-800">Route Planner</h1>
            <p className="text-xs text-gray-400">Drag the route to reshape it</p>
          </div>
          <a href="/" className="text-xs text-blue-500 hover:underline">← Back to map</a>
        </div>
        <RoutePlanner
          waypoints={waypoints}
          routeResult={routeResult}
          greenLaneSegments={greenLaneSegments}
          warnings={warnings}
          isRouting={isRouting}
          onSetStart={() => setClickMode("start")}
          onSetEnd={() => setClickMode("end")}
          onClearRoute={handleClear}
          onOverrideWarning={handleOverrideWarning}
          onExport={handleExport}
          totalDistance={totalDistance}
        />
      </aside>

      <div className="flex-1 relative">
        {clickMode !== "none" && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium">
            Click the map to set {clickMode === "start" ? "start point" : "end point"}
          </div>
        )}

        {routeError && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium max-w-sm text-center">
            {routeError}
            <button onClick={() => setRouteError(null)} className="ml-2 underline text-red-100">Dismiss</button>
          </div>
        )}

        {waypoints.length >= 2 && !isRouting && clickMode === "none" && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-lg shadow text-xs text-gray-600">
            Drag the white circles on the route to reshape it · Click green lanes to route through them
          </div>
        )}

        <PlannerMap
          routes={filteredRoutes}
          plannedRoute={fullRouteCoords}
          waypoints={waypoints}
          clickMode={clickMode}
          onMapClick={handleMapClick}
          onGreenLaneClick={handleGreenLaneClick}
          onWaypointDrag={handleWaypointDrag}
          onRouteLineDrag={handleRouteLineDrag}
          selectedRouteId={null}
        />
      </div>
    </main>
  );
}
