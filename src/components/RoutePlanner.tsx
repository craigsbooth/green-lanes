"use client";

import { useState, useCallback } from "react";
import { getRoute, RoutingResult } from "@/lib/routing";
import { generateGPX, downloadFile, calculateRouteLength } from "@/lib/geo";
import { OsmRoute } from "@/data/routes";

export interface Waypoint {
  id: string;
  lat: number;
  lng: number;
  label?: string;
  greenLane?: OsmRoute; // if this waypoint is on a green lane
}

export interface RouteWarning {
  waypointId: string;
  type: "tro" | "seasonal" | "restricted" | "unknown_surface";
  message: string;
  laneName: string;
  overridden: boolean;
}

interface Props {
  waypoints: Waypoint[];
  routeResult: RoutingResult | null;
  greenLaneSegments: { lane: OsmRoute; startIdx: number; endIdx: number }[];
  warnings: RouteWarning[];
  isRouting: boolean;
  onSetStart: () => void;
  onSetEnd: () => void;
  onClearRoute: () => void;
  onOverrideWarning: (waypointId: string) => void;
  onExport: () => void;
  totalDistance: number;
}

export function RoutePlanner({
  waypoints,
  routeResult,
  greenLaneSegments,
  warnings,
  isRouting,
  onSetStart,
  onSetEnd,
  onClearRoute,
  onOverrideWarning,
  onExport,
  totalDistance,
}: Props) {
  return (
    <div className="p-4">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-gray-800 mb-1">Route Planner</h2>
        <p className="text-xs text-gray-500">
          Click the map to set start/end, then drag the route onto green lanes.
        </p>
      </div>

      {/* Start/End buttons */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={onSetStart}
          className="flex-1 py-2 px-3 bg-green-100 hover:bg-green-200 text-green-800 text-sm font-medium rounded-md transition-colors"
        >
          📍 Set Start
        </button>
        <button
          onClick={onSetEnd}
          className="flex-1 py-2 px-3 bg-red-100 hover:bg-red-200 text-red-800 text-sm font-medium rounded-md transition-colors"
        >
          �� Set End
        </button>
      </div>

      {/* Waypoints list */}
      {waypoints.length > 0 && (
        <div className="mb-4 space-y-2">
          {waypoints.map((wp, idx) => (
            <div key={wp.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-md">
              <span className={`text-xs font-bold w-5 ${idx === 0 ? "text-green-600" : idx === waypoints.length - 1 ? "text-red-600" : "text-blue-600"}`}>
                {idx === 0 ? "A" : idx === waypoints.length - 1 ? "B" : String(idx)}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700 truncate">
                  {wp.label || `${wp.lat.toFixed(4)}, ${wp.lng.toFixed(4)}`}
                </p>
                {wp.greenLane && (
                  <p className="text-xs text-blue-600">{wp.greenLane.properties.name}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Loading */}
      {isRouting && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-blue-50 rounded-md">
          <div className="animate-spin h-4 w-4 border-2 border-blue-300 border-t-blue-600 rounded-full"></div>
          <p className="text-sm text-blue-700">Calculating route...</p>
        </div>
      )}

      {/* Route result */}
      {routeResult && !isRouting && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
          <div className="flex justify-between">
            <div>
              <p className="text-xs text-green-600">Total distance</p>
              <p className="text-lg font-bold text-green-800">{totalDistance} km</p>
            </div>
            <div>
              <p className="text-xs text-green-600">Est. time</p>
              <p className="text-lg font-bold text-green-800">{formatDuration(routeResult.duration)}</p>
            </div>
          </div>
          {greenLaneSegments.length > 0 && (
            <p className="text-xs text-green-600 mt-2">
              Includes {greenLaneSegments.length} green lane segment{greenLaneSegments.length > 1 ? "s" : ""}
            </p>
          )}
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="mb-4 space-y-2">
          <h3 className="text-sm font-medium text-red-700">⚠️ Route Warnings</h3>
          {warnings.map((warning) => (
            <div key={warning.waypointId} className={`p-3 rounded-md border ${warning.overridden ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200"}`}>
              <p className="text-sm font-medium text-gray-800">{warning.laneName}</p>
              <p className="text-xs text-gray-600 mt-1">{warning.message}</p>
              {!warning.overridden && (
                <button
                  onClick={() => onOverrideWarning(warning.waypointId)}
                  className="mt-2 text-xs text-amber-700 hover:text-amber-900 font-medium underline"
                >
                  I understand, use this route anyway
                </button>
              )}
              {warning.overridden && (
                <p className="mt-1 text-xs text-amber-600 italic">Warning overridden</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Green lanes in route */}
      {greenLaneSegments.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Green Lanes in Route</h3>
          <div className="space-y-1">
            {greenLaneSegments.map((seg, idx) => (
              <div key={idx} className="flex items-center gap-2 p-2 bg-blue-50 rounded-md">
                <span className="text-blue-600">🛤️</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 truncate">{seg.lane.properties.name}</p>
                  <p className="text-xs text-gray-500">{seg.lane.properties.surface} · {seg.lane.properties.type}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Export */}
      {routeResult && (
        <button
          onClick={onExport}
          className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-md transition-colors flex items-center justify-center gap-2 mb-2"
        >
          <span>📥</span> Export Full Route as GPX
        </button>
      )}

      {/* Clear */}
      {waypoints.length > 0 && (
        <button
          onClick={onClearRoute}
          className="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm rounded-md transition-colors"
        >
          Clear Route
        </button>
      )}

      {/* Instructions */}
      {waypoints.length === 0 && (
        <div className="mt-4 p-4 bg-gray-50 rounded-md">
          <h3 className="text-sm font-medium text-gray-700 mb-2">How to plan a route</h3>
          <ol className="text-xs text-gray-500 space-y-2 list-decimal list-inside">
            <li>Click <strong>Set Start</strong> then click the map</li>
            <li>Click <strong>Set End</strong> then click the map</li>
            <li>A road route will be calculated automatically</li>
            <li>Click on green lanes to add them as waypoints</li>
            <li>The route will recalculate through your green lanes</li>
            <li>Check warnings for any restrictions</li>
            <li>Export the full route as GPX for your sat nav</li>
          </ol>
        </div>
      )}
    </div>
  );
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
