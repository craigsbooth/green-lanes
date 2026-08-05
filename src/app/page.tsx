"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { FilterPanel } from "@/components/FilterPanel";
import { RouteDetailPanel } from "@/components/RouteDetailPanel";
import { FilterState } from "@/types/route";
import { greenLanes, OsmRouteProperties, OsmRoute } from "@/data/routes";
import { getDifficulty } from "@/data/difficulty";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

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

  const handleSelectRoute = (routeId: string) => {
    const feature = greenLanes.features.find((f) => f.properties.id === routeId) || null;
    setSelectedFeature(feature);
  };

  return (
    <main className="h-screen flex relative">
      {showFilters && (
        <aside className="w-80 bg-white shadow-lg z-10 overflow-y-auto filter-panel border-r border-gray-200">
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
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="absolute top-4 left-4 z-20 bg-white px-3 py-2 rounded-lg shadow-md hover:bg-gray-50 text-sm font-medium"
          aria-label={showFilters ? "Hide filters" : "Show filters"}
        >
          {showFilters ? "Hide Filters" : "Show Filters"}
        </button>
        <MapView
          routes={filteredCollection}
          onSelectRoute={handleSelectRoute}
          selectedRouteId={selectedFeature?.properties.id ?? null}
        />
      </div>

      {selectedFeature && (
        <aside className="w-96 bg-white shadow-lg z-10 overflow-y-auto route-panel border-l border-gray-200">
          <RouteDetailPanel
            feature={selectedFeature}
            onClose={() => setSelectedFeature(null)}
          />
        </aside>
      )}
    </main>
  );
}
