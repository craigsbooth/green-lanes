"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { FilterPanel } from "@/components/FilterPanel";
import { RouteDetailPanel } from "@/components/RouteDetailPanel";
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
  const [showFilters, setShowFilters] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"none" | "filters" | "detail">("none");

  // URL sharing: load route from hash on mount
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

  // Update URL hash when route is selected
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
    setMobilePanel((prev) => (prev === "filters" ? "none" : "filters"));
  }, []);

  return (
    <main className="h-screen flex flex-col md:flex-row relative">
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

      {mobilePanel === "filters" && (
        <aside className="md:hidden fixed inset-0 z-30 bg-white overflow-y-auto">
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="font-bold text-gray-800">Filters</h2>
            <button
              onClick={() => setMobilePanel("none")}
              className="text-gray-500 hover:text-gray-700 text-xl"
              aria-label="Close filters"
            >
              &times;
            </button>
          </div>
          <FilterPanel
            filters={filters}
            onChange={setFilters}
            totalRoutes={greenLanes.features.length}
            visibleRoutes={filteredRoutes.length}
            surfaces={surfaces}
          />
        </aside>
      )}

      <div className="flex-1 relative">
        <div className="absolute top-4 left-4 z-20 flex gap-2">
          <button
            onClick={toggleFilters}
            className="bg-white px-3 py-2 rounded-lg shadow-md hover:bg-gray-50 text-sm font-medium"
            aria-label="Toggle filters"
          >
            {showFilters || mobilePanel === "filters" ? "Hide Filters" : "Filters"}
          </button>
          <div className="bg-white px-3 py-2 rounded-lg shadow-md text-xs text-gray-600 flex items-center">
            {filteredRoutes.length} routes
          </div>
        </div>

        <MapView
          routes={filteredCollection}
          onSelectRoute={handleSelectRoute}
          selectedRouteId={selectedFeature?.properties.id ?? null}
        />
      </div>

      {selectedFeature && (
        <aside className="hidden md:block w-96 bg-white shadow-lg z-10 overflow-y-auto route-panel border-l border-gray-200">
          <RouteDetailPanel
            feature={selectedFeature}
            onClose={handleCloseDetail}
          />
        </aside>
      )}

      {mobilePanel === "detail" && selectedFeature && (
        <aside className="md:hidden fixed inset-x-0 bottom-0 z-30 bg-white rounded-t-xl shadow-2xl max-h-[80vh] overflow-y-auto">
          <div className="sticky top-0 bg-white p-2 flex justify-center border-b">
            <div className="w-10 h-1 bg-gray-300 rounded-full"></div>
          </div>
          <RouteDetailPanel
            feature={selectedFeature}
            onClose={handleCloseDetail}
          />
        </aside>
      )}
    </main>
  );
}
