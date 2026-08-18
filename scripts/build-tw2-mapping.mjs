/**
 * Matches TW2 routes to our OSM routes by proximity.
 * Input: src/data/tw2-routes.json (from bookmarklet)
 * Output: src/data/tw2-mapping.json (OSM ID -> TW2 GUID)
 */

import { readFileSync, writeFileSync } from "fs";

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Convert EPSG:3857 to lat/lng
function fromMercator(x, y) {
  const lng = (x / 20037508.34) * 180;
  let lat = (y / 20037508.34) * 180;
  lat = (180 / Math.PI) * (2 * Math.atan(Math.exp((lat * Math.PI) / 180)) - Math.PI / 2);
  return { lat, lng };
}

const osmRoutes = JSON.parse(readFileSync("src/data/osm-routes.json", "utf-8"));
let tw2Routes;
try {
  tw2Routes = JSON.parse(readFileSync("src/data/tw2-routes.json", "utf-8"));
} catch {
  console.error("Error: src/data/tw2-routes.json not found.");
  console.error("Run the bookmarklet on TW2 first to generate this file.");
  process.exit(1);
}

console.log(`OSM routes: ${osmRoutes.features.length}`);
console.log(`TW2 routes: ${tw2Routes.length}`);

const mapping = {};
let matched = 0;

for (const osm of osmRoutes.features) {
  const coords = osm.geometry.coordinates;
  const mid = coords[Math.floor(coords.length / 2)];
  const [osmLng, osmLat] = mid;

  let bestMatch = null;
  let bestDist = Infinity;

  for (const tw2 of tw2Routes) {
    if (!tw2.lat || !tw2.lng) continue;
    const dist = haversine(osmLat, osmLng, tw2.lat, tw2.lng);
    if (dist < bestDist) {
      bestDist = dist;
      bestMatch = tw2;
    }
  }

  // Match if within 200m
  if (bestMatch && bestDist < 0.2) {
    mapping[osm.properties.id] = {
      guid: bestMatch.guid,
      twuid: bestMatch.twuid,
      name: bestMatch.name,
      distance: Math.round(bestDist * 1000),
    };
    matched++;
  }
}

writeFileSync("src/data/tw2-mapping.json", JSON.stringify(mapping, null, 2));
console.log(`\nMatched ${matched} routes (within 200m)`);
console.log(`Unmatched: ${osmRoutes.features.length - matched}`);
console.log("Written to src/data/tw2-mapping.json");
