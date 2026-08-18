/**
 * Fetches TW2 route GUIDs by querying their WMS GetFeatureInfo endpoint.
 * Run this locally while logged into TW2 in your browser.
 * 
 * Usage: Copy your Identity.Application cookie from browser dev tools, then:
 *   node scripts/fetch-tw2-guids.mjs "YOUR_COOKIE_VALUE"
 *
 * This queries TW2's WMS at each of our route midpoints to find matching TW2 GUIDs.
 * Results are saved to src/data/tw2-mapping.json
 */

import { readFileSync, writeFileSync } from "fs";

const TW2_WMS = "https://www.trailwise2.co.uk/api/mapserver/trailwise";

// Convert lat/lng to EPSG:3857 (Web Mercator)
function toMercator(lat, lng) {
  const x = lng * 20037508.34 / 180;
  const y = Math.log(Math.tan((90 + lat) * Math.PI / 360)) / (Math.PI / 180);
  return { x, y: y * 20037508.34 / 180 };
}

async function queryTW2(lat, lng, cookie) {
  const merc = toMercator(lat, lng);
  // Create a small bbox around the point (roughly 50m)
  const delta = 50;
  const bbox = `${merc.x - delta},${merc.y - delta},${merc.x + delta},${merc.y + delta}`;
  
  const params = new URLSearchParams({
    SERVICE: "WMS",
    VERSION: "1.3.0",
    REQUEST: "GetFeatureInfo",
    FORMAT: "image/png",
    TRANSPARENT: "true",
    QUERY_LAYERS: "UCRLines,BOATLines",
    LAYERS: "UCRLines,BOATLines",
    HIDE_ROUTES_OF_NO_INTEREST: "0",
    INFO_FORMAT: "application/json",
    I: "50",
    J: "50",
    CRS: "EPSG:3857",
    STYLES: "",
    WIDTH: "101",
    HEIGHT: "101",
    BBOX: bbox,
  });

  const url = `${TW2_WMS}?${params}`;
  
  try {
    const res = await fetch(url, {
      headers: {
        Cookie: `Identity.Application=${cookie}`,
        Accept: "application/json",
      },
    });
    
    if (!res.ok) return null;
    
    const text = await res.text();
    // Try to parse as JSON - TW2 might return HTML or JSON
    try {
      const data = JSON.parse(text);
      return data;
    } catch {
      // Try to extract GUID from HTML response
      const guidMatch = text.match(/[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}/gi);
      const twuidMatch = text.match(/[A-Z]{2}\d{4}-\d{2}/g);
      if (guidMatch || twuidMatch) {
        return { guid: guidMatch?.[0] || null, twuid: twuidMatch?.[0] || null, raw: text.slice(0, 500) };
      }
      return null;
    }
  } catch (err) {
    return null;
  }
}

async function main() {
  const cookie = process.argv[2];
  if (!cookie) {
    console.log("Usage: node scripts/fetch-tw2-guids.mjs YOUR_IDENTITY_APPLICATION_COOKIE");
    console.log("");
    console.log("To get your cookie:");
    console.log("1. Log into TW2 in your browser");
    console.log("2. Open Dev Tools (F12) > Application > Cookies");
    console.log("3. Find 'Identity.Application' cookie for trailwise2.co.uk");
    console.log("4. Copy the value and paste it as the argument");
    process.exit(1);
  }

  // Load our routes
  const routes = JSON.parse(readFileSync("src/data/osm-routes.json", "utf-8"));
  console.log(`Loaded ${routes.features.length} routes`);

  const mapping = {};
  let found = 0;
  let failed = 0;

  // Query TW2 for each route's midpoint
  for (let i = 0; i < routes.features.length; i++) {
    const feature = routes.features[i];
    const coords = feature.geometry.coordinates;
    const mid = coords[Math.floor(coords.length / 2)];
    const [lng, lat] = mid;

    const result = await queryTW2(lat, lng, cookie);
    
    if (result && (result.guid || result.twuid)) {
      mapping[feature.properties.id] = {
        guid: result.guid,
        twuid: result.twuid,
      };
      found++;
      console.log(`[${i+1}/${routes.features.length}] ${feature.properties.name} -> ${result.twuid || result.guid}`);
    } else {
      failed++;
      if (i < 5 || i % 100 === 0) {
        console.log(`[${i+1}/${routes.features.length}] ${feature.properties.name} -> no match`);
      }
    }

    // Rate limit - 200ms between requests
    await new Promise(r => setTimeout(r, 200));
    
    // Save progress every 50 routes
    if (i % 50 === 0 && i > 0) {
      writeFileSync("src/data/tw2-mapping.json", JSON.stringify(mapping, null, 2));
      console.log(`  ... saved progress (${found} found, ${failed} no match)`);
    }
  }

  writeFileSync("src/data/tw2-mapping.json", JSON.stringify(mapping, null, 2));
  console.log(`\nDone! ${found} routes mapped to TW2, ${failed} not found.`);
  console.log("Written to src/data/tw2-mapping.json");
}

main();
