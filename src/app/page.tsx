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
    type: "all",
    surface: "all",
    difficulty: "all",
    searchText: "",
    hideRestricted: false,
  });

  const [selectedFeature, setSelectedFeature] = useState<OsmRoute | null>(null);
  const [showFilters, setShowFilters] = useState(true);
  const [mobilePanel, setMobilePanel] = useState<"none" | "filters" | "detail" | "trip">("none");
  const [tripRoutes, setTripRoutes] = useState<OsmRoute[]>([]);
  const [showTrip, setShowTrip] = useState(false);

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash) {
      const feature = greenLanes.features.find((f) => f.properties.id === hash) || null;
      if (feature) {
        setSelectedFeature(feature);
        setMobilePanel("detail");
      }
    }
  }, []);

  useEffect(() => {
    if (selectedFeature) {
      window.history.replaceState(null, "", `#${selectedFeature.properties.id}`);
    } else {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [selectedFeature]);

  const filteredRoutes = useMemo(() => {
    return greenLanes.features.filter((feature) => {
      const p = feature.properties;
      if (filters.type !== "all" && p.type !== filters.type) return false;
      if (filters.surface !== "all" && p.surface !== filters.surface) return false;
      if (filters.difficulty !== "all" && getDifficulty(p) !== filters.difficulty) return false;
      if (filters.hideRestricted && (p.motor_vehicle === "no" || p.access === "private")) return false;
      if (filters.searchText) {
        const search = filters.searchText.toLowerCase();
        if (!p.name.toLowerCase().includes(search) && !p.ref.toLowerCase().includes(search) && !p.note.toLowerCase().includes(search)) return false;
      }
      return true;
    });
  }, [filters]);

  const filteredCollection = useMemo(() => ({
    ...greenLanes,
    features: filteredRoutes,
  }), [filteredRoutes]);

  const surfaces = useMemo(() => {
    const set = new Set(greenLanes.features.map((f) => f.properties.surface));
    return Array.from(set).sort();
  }, []);

  const handleSelectRoute = useCallback((routeId: string) => {
    const feature = greenLanes.features.find((f) => f.properties.id === routeId) || null;
    setSelectedFeature(feature);
    setMobilePanel("detail");
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedFeature(null);
    setMobilePanel("none");
  }, []);

  const toggleFilters = useCallback(() => {
    setShowFilters((prev) => !prev);
    setShowTrip(false);
    setMobilePanel((prev) => (prev === "filters" ? "none" : "filters"));
  }, []);

  const toggleTrip = useCallback(() => {
    setShowTrip((prev) => !prev);
    setShowFilters(false);
    setMobilePanel((prev) => (prev === "trip" ? "none" : "trip"));
  }, []);

  const addToTrip = useCallback((route: OsmRoute) => {
    setTripRoutes((prev) => {
      if (prev.find((r) => r.properties.id === route.properties.id)) return prev;
      return [...prev, route];
    });
    setShowTrip(true);
    setMobilePanel("trip");
  }, []);

  const removeFromTrip = useCallback((id: string) => {
    setTripRoutes((prev) => prev.filter((r) => r.properties.id !== id));
  }, []);

  const clearTrip = useCallback(() => {
    setTripRoutes([]);
  }, []);

  return (
    <main className="h-screen flex flex-col md:flex-row relative">
      {/* Desktop filter panel - defaults open */}
      {showFilters && (
        <aside className="hidden md:block w-80 bg-white shadow-lg z-10 overflow-y-auto filter-panel border-r border-gray-200">
          <FilterPanel
            filters={filters}
            onChange={setFilters}
            totalRoutes={greenLanes.features.length}
            visibleRoutes={filteredRoutes.length}
            surfaces={surfaces}
          />
        </aside>
      )}

      {/* Desktop trip builder panel */}
      {showTrip && (
        <aside className="hidden md:block w-80 bg-white shadow-lg z-10 overflow-y-auto filter-panel border-r border-gray-200">
          <div className="p-4 border-b">
            <h2 className="font-bold text-gray-800">Trip Builder</h2>
            <p className="text-xs text-gray-400 mt-1">Build a route for Android Auto navigation</p>
          </div>
          <RouteBuilder routes={tripRoutes} onRemove={removeFromTrip} onClear={clearTrip} />
        </aside>
      )}

      {/* Mobile filter panel (full overlay) */}
      {mobilePanel === "filters" && (
        <aside className="md:hidden fixed inset-0 z-30 bg-white overflow-y-auto">
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="font-bold text-gray-800">Filters</h2>
            <button onClick={() => setMobilePanel("none")} className="text-gray-500 hover:text-gray-700 text-xl" aria-label="Close filters">&times;</button>
          </div>
          <FilterPanel filters={filters} onChange={setFilters} totalRoutes={greenLanes.features.length} visibleRoutes={filteredRoutes.length} surfaces={surfaces} />
        </aside>
      )}

      {/* Mobile trip panel (full overlay) */}
      {mobilePanel === "trip" && (
        <aside className="md:hidden fixed inset-0 z-30 bg-white overflow-y-auto">
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="font-bold text-gray-800">Trip Builder</h2>
            <button onClick={() => setMobilePanel("none")} className="text-gray-500 hover:text-gray-700 text-xl" aria-label="Close trip">&times;</button>
          </div>
          <RouteBuilder routes={tripRoutes} onRemove={removeFromTrip} onClear={clearTrip} />
        </aside>
      )}

      {/* Map area */}
      <div className="flex-1 relative">
        {/* Top-right controls */}
        <div className="absolute top-4 right-4 z-20 flex gap-2">
          <div className="bg-white px-3 py-2 rounded-lg shadow-md text-xs text-gray-600 flex items-center">
            {filteredRoutes.length} routes
          </div>
          <button
            onClick={toggleFilters}
            className={`px-3 py-2 rounded-lg shadow-md text-sm font-medium ${showFilters ? "bg-green-600 text-white" : "bg-white hover:bg-gray-50"}`}
            aria-label="Toggle filters"
          >
            ☰ Filters
          </button>
          <button
            onClick={toggleTrip}
            className={`px-3 py-2 rounded-lg shadow-md text-sm font-medium ${showTrip ? "bg-green-600 text-white" : "bg-white hover:bg-gray-50"}`}
            aria-label="Toggle trip builder"
          >
            🗺️ Trip{tripRoutes.length > 0 ? ` (${tripRoutes.length})` : ""}
          </button>
        </div>

        {/* Empty state overlay */}
        {filteredRoutes.length === 0 && (
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            <div className="bg-white/90 backdrop-blur-sm px-6 py-4 rounded-xl shadow-lg text-center pointer-events-auto">
              <p className="text-gray-700 font-medium mb-1">No routes match your filters</p>
              <p className="text-sm text-gray-500 mb-3">Try broadening your search or resetting filters.</p>
              <button
                onClick={() => setFilters({ type: "all", surface: "all", difficulty: "all", searchText: "", hideRestricted: false })}
                className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
              >
                Reset Filters
              </button>
            </div>
          </div>
        )}

        <MapView
          routes={filteredCollection}
          onSelectRoute={handleSelectRoute}
          selectedRouteId={selectedFeature?.properties.id ?? null}
        />
      </div>

      {/* Desktop detail panel */}
      {selectedFeature && (
        <aside className="hidden md:block w-96 bg-white shadow-lg z-10 overflow-y-auto route-panel border-l border-gray-200">
          <RouteDetailPanel
            feature={selectedFeature}
            onClose={handleCloseDetail}
            onAddToTrip={addToTrip}
            isInTrip={tripRoutes.some((r) => r.properties.id === selectedFeature.properties.id)}
          />
        </aside>
      )}

      {/* Mobile detail panel (bottom sheet) */}
      {mobilePanel === "detail" && selectedFeature && (
        <aside className="md:hidden fixed inset-x-0 bottom-0 z-30 bg-white rounded-t-xl shadow-2xl max-h-[80vh] overflow-y-auto">
          <div className="sticky top-0 bg-white pt-2 pb-1 flex justify-center border-b shadow-sm z-10">
            <div className="w-10 h-1 bg-gray-300 rounded-full"></div>
          </div>
          <RouteDetailPanel
            feature={selectedFeature}
            onClose={handleCloseDetail}
            onAddToTrip={addToTrip}
            isInTrip={tripRoutes.some((r) => r.properties.id === selectedFeature.properties.id)}
          />
        </aside>
      )}
    </main>
  );
}
