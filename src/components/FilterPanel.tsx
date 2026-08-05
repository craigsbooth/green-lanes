"use client";

import { FilterState, RouteType, Difficulty } from "@/types/route";

interface FilterPanelProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  totalRoutes: number;
  visibleRoutes: number;
  surfaces: string[];
}

export function FilterPanel({ filters, onChange, totalRoutes, visibleRoutes, surfaces }: FilterPanelProps) {
  const update = (partial: Partial<FilterState>) => {
    onChange({ ...filters, ...partial });
  };

  const resetFilters = () => {
    onChange({ type: "all", surface: "all", difficulty: "all", searchText: "", hideRestricted: false });
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-800">Green Lanes</h2>
        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
          {visibleRoutes}/{totalRoutes}
        </span>
      </div>

      <p className="text-xs text-gray-500 mb-4">
        Legal byways (BOATs &amp; UCRs) in County Durham &amp; Yorkshire. Data from OpenStreetMap.
      </p>

      {/* Search */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
        <input
          type="text"
          value={filters.searchText}
          onChange={(e) => update({ searchText: e.target.value })}
          placeholder="Search by name or ref..."
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
      </div>

      {/* Difficulty */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
        <select
          value={filters.difficulty}
          onChange={(e) => update({ difficulty: e.target.value as Difficulty | "all" })}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
        >
          <option value="all">All Difficulties</option>
          <option value="easy">Easy (graded track, compacted surface)</option>
          <option value="moderate">Moderate (gravel, unpaved)</option>
          <option value="challenging">Challenging (dirt, earth, grass)</option>
          <option value="extreme">Extreme (mud, bog, grade 5)</option>
          <option value="unknown">Unknown (no surface data)</option>
        </select>
        <p className="text-xs text-gray-400 mt-1">
          Based on OSM surface/tracktype tags. Community ratings override when available.
        </p>
      </div>

      {/* Route Type */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Route Type</label>
        <select
          value={filters.type}
          onChange={(e) => update({ type: e.target.value as RouteType | "all" })}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
        >
          <option value="all">All Types</option>
          <option value="BOAT">BOAT (Byway Open to All Traffic)</option>
          <option value="UCR">UCR (Unclassified County Road)</option>
        </select>
      </div>

      {/* Surface */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Surface</label>
        <select
          value={filters.surface}
          onChange={(e) => update({ surface: e.target.value })}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
        >
          <option value="all">All Surfaces</option>
          {surfaces.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Hide restricted */}
      <div className="mb-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.hideRestricted}
            onChange={(e) => update({ hideRestricted: e.target.checked })}
            className="rounded border-gray-300 text-green-600 focus:ring-green-500"
          />
          <span className="text-sm text-gray-700">Hide restricted routes</span>
        </label>
      </div>

      <button
        onClick={resetFilters}
        className="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-md transition-colors"
      >
        Reset Filters
      </button>

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Difficulty Legend</h3>
        <div className="space-y-1">
          <LegendItem color="#2d6a4f" label="Easy" />
          <LegendItem color="#e9c46a" label="Moderate" />
          <LegendItem color="#f4845f" label="Challenging" />
          <LegendItem color="#e63946" label="Extreme" />
          <LegendItem color="#888888" label="Unknown" />
          <LegendItem color="#264653" label="Selected" />
        </div>
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-6 h-1 rounded" style={{ backgroundColor: color }} />
      <span className="text-xs text-gray-600">{label}</span>
    </div>
  );
}
