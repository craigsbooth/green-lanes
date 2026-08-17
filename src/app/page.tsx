"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { FilterPanel } from "@/components/FilterPanel";
import { RouteDetailPanel } from "@/components/RouteDetailPanel";
import { RouteBuilder } from "@/components/RouteBuilder";
import { FilterState } from "@/types/route";
import { greenLanes, OsmRoute } from "@/data/routes";
import { getDifficulty } from "@/data/difficulty";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <div className="animate-spin h-8 w-8 border-4 border-green-200 border-t-green-600 rounded-full mx-auto mb-3"></div>
        <p className="text-sm text-gray-600">Loading map...</p>
      </div>
    </div>
  ),
});

export default function Home() {
  const [filters, setFilters] = useState<FilterState>({
    type: "all", surface: "all", difficulty: "all", searchText: "", hideRestricted: false,
  });
  const [selectedFeature, setSelectedFeature] = useState<OsmRoute | null>(null);
  const [showFilters, setShowFilters] = useState(true);
  const [showTrip, setShowTrip] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"none" | "filters" | "detail" | "trip">("none");
  const [tripRoutes, setTripRoutes] = useState<OsmRoute[]>([]);

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash) {
      const feature = greenLanes.features.find((f) => f.properties.id === hash) || null;
      if (feature) { setSelectedFeature(feature); setMobilePanel("detail"); }
    }
  }, []);

  useEffect(() => {
    if (selectedFeature) window.history.replaceState(null, "", `#${selectedFeature.properties.id}`);
    else window.history.replaceState(null, "", window.location.pathname);
  }, [selectedFeature]);

  const filteredRoutes = useMemo(() => greenLanes.features.filter((feature) => {
    const p = feature.properties;
    if (filters.type !== "all" && p.type !== filters.type) return false;
    if (filters.surface !== "all" && p.surface !== filters.surface) return false;
    if (filters.difficulty !== "all" && getDifficulty(p) !== filters.difficulty) return false;
    if (filters.hideRestricted && (p.motor_vehicle === "no" || p.access === "private")) return false;
    if (filters.searchText) {
      const s = filters.searchText.toLowerCase();
      if (!p.name.toLowerCase().includes(s) && !p.ref.toLowerCase().includes(s) && !p.note.toLowerCase().includes(s)) return false;
    }
    return true;
  }), [filters]);

  const filteredCollection = useMemo(() => ({ ...greenLanes, features: filteredRoutes }), [filteredRoutes]);
  const surfaces = useMemo(() => Array.from(new Set(greenLanes.features.map((f) => f.properties.surface))).sort(), []);

  const handleSelectRoute = useCallback((routeId: string) => {
    setSelectedFeature(greenLanes.features.find((f) => f.properties.id === routeId) || null);
    setMobilePanel("detail");
  }, []);

  const handleCloseDetail = useCallback(() => { setSelectedFeature(null); setMobilePanel("none"); }, []);

  const toggleFilters = useCallback(() => {
    setShowFilters((p) => !p); setShowTrip(false);
    setMobilePanel((p) => p === "filters" ? "none" : "filters");
  }, []);

  const toggleTrip = useCallback(() => {
    setShowTrip((p) => !p); setShowFilters(false);
    setMobilePanel((p) => p === "trip" ? "none" : "trip");
  }, []);

  const addToTrip = useCallback((route: OsmRoute) => {
    setTripRoutes((prev) => prev.find((r) => r.properties.id === route.properties.id) ? prev : [...prev, route]);
    setShowTrip(true); setMobilePanel("trip");
  }, []);

  return (
    <main className="h-screen flex flex-col md:flex-row relative">
      {showFilters && (
        <aside className="hidden md:block w-80 bg-white shadow-lg z-10 overflow-y-auto filter-panel border-r border-gray-200">
          <FilterPanel filters={filters} onChange={setFilters} totalRoutes={greenLanes.features.length} visibleRoutes={filteredRoutes.length} surfaces={surfaces} />
        </aside>
      )}
      {showTrip && (
        <aside className="hidden md:block w-80 bg-white shadow-lg z-10 overflow-y-auto border-r border-gray-200">
          <div className="p-4 border-b"><h2 className="font-bold text-gray-800">Trip Builder</h2></div>
          <RouteBuilder routes={tripRoutes} onRemove={(id) => setTripRoutes((p) => p.filter((r) => r.properties.id !== id))} onClear={() => setTripRoutes([])} />
        </aside>
      )}
      {mobilePanel === "filters" && (
        <aside className="md:hidden fixed inset-0 z-30 bg-white overflow-y-auto">
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="font-bold">Filters</h2>
            <button onClick={() => setMobilePanel("none")} className="text-xl text-gray-500">&times;</button>
          </div>
          <FilterPanel filters={filters} onChange={setFilters} totalRoutes={greenLanes.features.length} visibleRoutes={filteredRoutes.length} surfaces={surfaces} />
        </aside>
      )}
      {mobilePanel === "trip" && (
        <aside className="md:hidden fixed inset-0 z-30 bg-white overflow-y-auto">
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="font-bold">Trip Builder</h2>
            <button onClick={() => setMobilePanel("none")} className="text-xl text-gray-500">&times;</button>
          </div>
          <RouteBuilder routes={tripRoutes} onRemove={(id) => setTripRoutes((p) => p.filter((r) => r.properties.id !== id))} onClear={() => setTripRoutes([])} />
        </aside>
      )}

      <div className="flex-1 relative">
        <div className="absolute top-4 right-4 z-20 flex gap-2">
          <div className="bg-white px-3 py-2 rounded-lg shadow-md text-xs text-gray-600">{filteredRoutes.length} routes</div>
          <button onClick={toggleFilters} className={`px-3 py-2 rounded-lg shadow-md text-sm font-medium ${showFilters ? "bg-green-600 text-white" : "bg-white"}`}>☰ Filters</button>
          <button onClick={toggleTrip} className={`px-3 py-2 rounded-lg shadow-md text-sm font-medium ${showTrip ? "bg-green-600 text-white" : "bg-white"}`}>🗺️ Trip{tripRoutes.length > 0 ? ` (${tripRoutes.length})` : ""}</button>
          <a href="/planner" className="px-3 py-2 rounded-lg shadow-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700">&#x1F6E3;&#xFE0F; Plan Route</a>
        </div>
        {filteredRoutes.length === 0 && (
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            <div className="bg-white/90 backdrop-blur-sm px-6 py-4 rounded-xl shadow-lg text-center pointer-events-auto">
              <p className="text-gray-700 font-medium mb-1">No routes match your filters</p>
              <button onClick={() => setFilters({ type: "all", surface: "all", difficulty: "all", searchText: "", hideRestricted: false })} className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 mt-2">Reset Filters</button>
            </div>
          </div>
        )}
        <MapView routes={filteredCollection} onSelectRoute={handleSelectRoute} selectedRouteId={selectedFeature?.properties.id ?? null} />
      </div>

      {selectedFeature && (
        <aside className="hidden md:block w-96 bg-white shadow-lg z-10 overflow-y-auto route-panel border-l border-gray-200">
          <RouteDetailPanel feature={selectedFeature} onClose={handleCloseDetail} onAddToTrip={addToTrip} isInTrip={tripRoutes.some((r) => r.properties.id === selectedFeature.properties.id)} />
        </aside>
      )}
      {mobilePanel === "detail" && selectedFeature && (
        <aside className="md:hidden fixed inset-x-0 bottom-0 z-30 bg-white rounded-t-xl shadow-2xl max-h-[80vh] overflow-y-auto">
          <div className="sticky top-0 bg-white pt-2 pb-1 flex justify-center border-b shadow-sm z-10"><div className="w-10 h-1 bg-gray-300 rounded-full"></div></div>
          <RouteDetailPanel feature={selectedFeature} onClose={handleCloseDetail} onAddToTrip={addToTrip} isInTrip={tripRoutes.some((r) => r.properties.id === selectedFeature.properties.id)} />
        </aside>
      )}
    </main>
  );
}
