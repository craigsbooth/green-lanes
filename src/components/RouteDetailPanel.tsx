"use client";
import { OsmRoute } from "@/data/routes";
import { getDifficulty } from "@/data/difficulty";
import { RouteImages } from "./RouteImages";

interface Props {
  feature: OsmRoute;
  onClose: () => void;
}

export function RouteDetailPanel({ feature, onClose }: Props) {
  const route = feature.properties;
  const coords = feature.geometry.coordinates;
  const difficulty = getDifficulty(route);

  const midIdx = Math.floor(coords.length / 2);
  const midCoord = coords[midIdx];
  const lat = midCoord[1];
  const lng = midCoord[0];

  const streetViewUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;
  const mapillaryUrl = `https://www.mapillary.com/app/?lat=${lat}&lng=${lng}&z=15`;
  const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(route.name + " green lane byway")}`;
  const youtubeUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(route.name + " green lane")}`;

  const diffColors: Record<string, string> = {
    unknown: "bg-gray-100 text-gray-700",
    easy: "bg-green-100 text-green-800",
    moderate: "bg-yellow-100 text-yellow-800",
    challenging: "bg-orange-100 text-orange-800",
    extreme: "bg-red-100 text-red-800",
  };

  return (
    <div className="p-4">
      <div className="flex items-start justify-between mb-3">
        <h2 className="text-lg font-bold text-gray-800">{route.name}</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl" aria-label="Close">&times;</button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">{route.type}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full ${diffColors[difficulty]}`}>{difficulty}</span>
        {route.legalStatus === "tro_restricted" && <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full">TRO Restricted</span>}
        {route.legalStatus === "open" && <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">Open</span>}
      </div>

      <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
        <p className="text-xs text-green-700 font-medium">{route.legalBasis}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <Stat label="Highway" value={route.highway || "\u2014"} />
        <Stat label="Surface" value={route.surface || "unknown"} />
        <Stat label="Tracktype" value={route.tracktype || "\u2014"} />
        <Stat label="Access" value={route.access || "\u2014"} />
        <Stat label="Motor vehicles" value={route.motor_vehicle || "\u2014"} />
        <Stat label="Ref" value={route.ref || "\u2014"} />
      </div>

      <div className="mb-4 p-3 bg-gray-50 rounded-md">
        <p className="text-xs text-gray-500 font-medium mb-1">Difficulty: {difficulty}</p>
        <p className="text-xs text-gray-400">Based on OSM surface/tracktype tags. Community ratings override when available.</p>
      </div>

      {route.note && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
          <p className="text-xs text-amber-700">{route.note}</p>
        </div>
      )}

      {route.legalStatus === "tro_restricted" && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800 font-medium">TRO in effect</p>
          <p className="text-xs text-red-600 mt-1">Motor vehicles restricted. Check current status with the council before driving.</p>
        </div>
      )}

      {/* Images from Wikimedia Commons - searches along the actual track */}
      <RouteImages coordinates={coords} routeName={route.name} />

      {/* External links */}
      <div className="mb-4">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Links &amp; Media</h3>
        <div className="space-y-2">
          <ExtLink href={streetViewUrl} label="Google Street View" icon="🛣️" />
          <ExtLink href={mapillaryUrl} label="Mapillary (street-level photos)" icon="📸" />
          <ExtLink href={googleSearchUrl} label="Search for articles / reports" icon="🔍" />
          <ExtLink href={youtubeUrl} label="YouTube videos" icon="▶️" />
          <ExtLink href={`https://www.openstreetmap.org/way/${route.osmId}`} label="OpenStreetMap" icon="🗺️" />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-md p-2">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-medium text-gray-800">{value}</p>
    </div>
  );
}

function ExtLink({ href, label, icon }: { href: string; label: string; icon: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm rounded-md transition-colors">
      <span>{icon}</span>
      <span>{label}</span>
    </a>
  );
}
