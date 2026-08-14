"use client";

import { useState, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { RoutePlanner, Waypoint, RouteWarning } from "@/components/RoutePlanner";
import { greenLanes, OsmRoute } from "@/data/routes";
import { getRoute, RoutingResult } from "@/lib/routing";
import { generateGPX, downloadFile, calculateRouteLength } from "@/lib/geo";

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

  const filteredRoutes = useMemo(() => greenLanes, []);

  // Calculate route whenever waypoints change
  const calculateRoute = useCallback(async (wps: Waypoint[]) => {
    if (wps.length < 2) {
      setRouteResult(null);
      setFullRouteCoords(null);
      return;
    }

    setIsRouting(true);
    try {
      const result = await getRoute(wps.map((w) => ({ lat: w.lat, lng: w.lng })));
      setRouteResult(result);
      setFullRouteCoords(result.coordinates);

      // Check for warnings on green lane waypoints
      const newWarnings: RouteWarning[] = [];
      for (const wp of wps) {
        if (wp.greenLane) {
          const props = wp.greenLane.properties;
          if (props.legalStatus === "tro_restricted" || props.motor_vehicle === "no") {
            newWarnings.push({
              waypointId: wp.id,
              type: "tro",
              message: `This route has a Traffic Regulation Order restricting motor vehicles. Check with the council for current status.`,
              laneName: props.name,
              overridden: false,
            });
          }
          if (props.surface === "unknown") {
            newWarnings.push({
              waypointId: wp.id,
              type: "unknown_surface",
              message: `Surface condition unknown. The route may be impassable in wet weather.`,
              laneName: props.name,
              overridden: false,
            });
          }
        }
      }
      setWarnings(newWarnings);
    } catch (err) {
      console.error("Routing failed:", err);
      setRouteResult(null);
      setFullRouteCoords(null);
    }
    setIsRouting(false);
  }, []);

  const handleMapClick = useCallback((lat: number, lng: number) => {
    if (clickMode === "start") {
      const newWp: Waypoint = { id: "start", lat, lng, label: "Start" };
      const updated = [newWp, ...waypoints.filter((w) => w.id !== "start")];
      setWaypoints(updated);
      setClickMode("none");
      calculateRoute(updated);
    } else if (clickMode === "end") {
      const newWp: Waypoint = { id: "end", lat, lng, label: "End" };
      const updated = [...waypoints.filter((w) => w.id !== "end"), newWp];
      setWaypoints(updated);
      setClickMode("none");
      calculateRoute(updated);
    }
  }, [clickMode, waypoints, calculateRoute]);

  const handleGreenLaneClick = useCallback((routeId: string, lat: number, lng: number) => {
    const lane = greenLanes.features.find((f) => f.properties.id === routeId);
    if (!lane) return;

    const wpId = `via-${routeId}`;
    // Don't add duplicate
    if (waypoints.find((w) => w.id === wpId)) return;

    const newWp: Waypoint = {
      id: wpId,
      lat,
      lng,
      label: lane.properties.name,
      greenLane: lane,
    };

    // Insert before the end waypoint
    const endIdx = waypoints.findIndex((w) => w.id === "end");
    let updated: Waypoint[];
    if (endIdx >= 0) {
      updated = [...waypoints.slice(0, endIdx), newWp, ...waypoints.slice(endIdx)];
    } else {
      updated = [...waypoints, newWp];
    }

    setWaypoints(updated);
    setGreenLaneSegments((prev) => [...prev, { lane, startIdx: 0, endIdx: 0 }]);
    calculateRoute(updated);
  }, [waypoints, calculateRoute]);

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
      {/* Sidebar */}
      <aside className="w-full md:w-96 bg-white shadow-lg z-10 overflow-y-auto border-r border-gray-200 md:max-h-screen max-h-[40vh]">
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h1 className="font-bold text-gray-800">Route Planner</h1>
            <p className="text-xs text-gray-400">Plan roads + green lanes together</p>
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

      {/* Map */}
      <div className="flex-1 relative">
        {clickMode !== "none" && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium">
            Click the map to set {clickMode === "start" ? "start point" : "end point"}
          </div>
        )}
        <PlannerMap
          routes={filteredRoutes}
          plannedRoute={fullRouteCoords}
          waypoints={waypoints}
          clickMode={clickMode}
          onMapClick={handleMapClick}
          onGreenLaneClick={handleGreenLaneClick}
          selectedRouteId={null}
        />
      </div>
    </main>
  );
}
