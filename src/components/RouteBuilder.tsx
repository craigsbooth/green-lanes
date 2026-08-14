"use client";

import { useState } from "react";
import { OsmRoute } from "@/data/routes";
import { calculateRouteLength, generateGPX, downloadFile } from "@/lib/geo";

interface Props {
  routes: OsmRoute[];
  onRemove: (id: string) => void;
  onClear: () => void;
}

export function RouteBuilder({ routes, onRemove, onClear }: Props) {
  const [tripName, setTripName] = useState("Green Lane Trip");

  const totalLength = routes.reduce((sum, r) => {
    return sum + calculateRouteLength(r.geometry.coordinates);
  }, 0);

  const handleExportGPX = () => {
    if (routes.length === 0) return;

    // Combine all route coordinates into a single track
    const allCoords: [number, number][] = [];
    routes.forEach((route) => {
      allCoords.push(...route.geometry.coordinates);
    });

    const routeNames = routes.map((r) => r.properties.name).join(" → ");
    const desc = `Green lane route: ${routeNames}. Total: ${Math.round(totalLength * 10) / 10} km. Export for use with OsmAnd, Locus Map, or Sygic on Android Auto.`;
    const gpx = generateGPX(tripName, desc, allCoords);
    const filename = tripName.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase() + ".gpx";
    downloadFile(gpx, filename, "application/gpx+xml");
  };

  if (routes.length === 0) {
    return (
      <div className="p-4 text-center">
        <p className="text-sm text-gray-500 mb-2">No routes added to trip yet.</p>
        <p className="text-xs text-gray-400">Click routes on the map, then use "Add to Trip" to build your route.</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Trip Name</label>
        <input
          type="text"
          value={tripName}
          onChange={(e) => setTripName(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
      </div>

      {/* Route list */}
      <div className="space-y-2 mb-4">
        {routes.map((route, idx) => (
          <div key={route.properties.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-md">
            <span className="text-xs font-bold text-gray-400 w-5">{idx + 1}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{route.properties.name}</p>
              <p className="text-xs text-gray-500">
                {calculateRouteLength(route.geometry.coordinates)} km · {route.properties.surface}
              </p>
            </div>
            <button
              onClick={() => onRemove(route.properties.id)}
              className="text-red-400 hover:text-red-600 text-sm"
              aria-label={`Remove ${route.properties.name}`}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className="flex justify-between items-center p-3 bg-green-50 rounded-md mb-4">
        <div>
          <p className="text-xs text-green-600">Total distance</p>
          <p className="text-sm font-bold text-green-800">{Math.round(totalLength * 10) / 10} km</p>
        </div>
        <div>
          <p className="text-xs text-green-600">Segments</p>
          <p className="text-sm font-bold text-green-800">{routes.length}</p>
        </div>
      </div>

      {/* Export */}
      <button
        onClick={handleExportGPX}
        className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-md transition-colors flex items-center justify-center gap-2 mb-2"
      >
        <span>📥</span> Export GPX for Navigation
      </button>

      <p className="text-xs text-gray-400 text-center mb-4">
        Open the GPX file in OsmAnd, Locus Map, or Sygic for Android Auto navigation.
      </p>

      {/* Clear */}
      <button
        onClick={onClear}
        className="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm rounded-md transition-colors"
      >
        Clear Trip
      </button>

      {/* Instructions */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Using with Android Auto</h3>
        <ol className="text-xs text-gray-500 space-y-1 list-decimal list-inside">
          <li>Export your route as GPX above</li>
          <li>Transfer the file to your phone</li>
          <li>Open in OsmAnd, Locus Map, or Sygic</li>
          <li>Start navigation — it works on Android Auto</li>
        </ol>
        <div className="mt-3 space-y-1">
          <ExtLink href="https://play.google.com/store/apps/details?id=net.osmand.plus" label="OsmAnd+ (recommended)" />
          <ExtLink href="https://play.google.com/store/apps/details?id=menion.android.locus" label="Locus Map" />
          <ExtLink href="https://play.google.com/store/apps/details?id=com.sygic.aura" label="Sygic GPS Navigation" />
        </div>
      </div>
    </div>
  );
}

function ExtLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="block text-xs text-blue-500 hover:underline">
      {label} →
    </a>
  );
}
