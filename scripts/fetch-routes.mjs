/**
 * Fetches ONLY legally driveable routes from OpenStreetMap.
 * Split into two queries to avoid timeouts.
 */

const OVERPASS_URLS = [
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];

const BBOX = "53.3,-2.9,55.0,-0.7";

// Query 1: Designated routes (BOATs and designated UCRs)
const query1 = `[out:json][timeout:180];
(
  way["designation"="byway_open_to_all_traffic"](${BBOX});
  way["designation"="public_byway"](${BBOX});
  way["designation"="unclassified_county_road"](${BBOX});
  way["designation"="unclassified_highway"](${BBOX});
  way["highway"="byway"](${BBOX});
);
out body;
>;
out skel qt;`;

// Query 2: Unsurfaced unclassified roads (legal highways on List of Streets)
const query2 = `[out:json][timeout:180];
(
  way["highway"="unclassified"]["surface"="unpaved"](${BBOX});
  way["highway"="unclassified"]["surface"="gravel"](${BBOX});
  way["highway"="unclassified"]["surface"="dirt"](${BBOX});
  way["highway"="unclassified"]["surface"="earth"](${BBOX});
  way["highway"="unclassified"]["surface"="grass"](${BBOX});
  way["highway"="unclassified"]["surface"="ground"](${BBOX});
  way["highway"="unclassified"]["surface"="fine_gravel"](${BBOX});
  way["highway"="unclassified"]["surface"="mud"](${BBOX});
  way["highway"="unclassified"]["surface"="compacted"]["tracktype"](${BBOX});
);
out body;
>;
out skel qt;`;

async function tryFetch(url, query, label) {
  console.log(`  [${label}] Trying ${url}...`);
  const params = new URLSearchParams();
  params.set("data", query);
  const response = await fetch(url, { method: "POST", body: params });
  if (!response.ok) throw new Error(`${response.status}`);
  return response.json();
}

async function runQuery(query, label) {
  for (const url of OVERPASS_URLS) {
    try {
      const data = await tryFetch(url, query, label);
      console.log(`  [${label}] Success! (${data.elements.length} elements)`);
      return data;
    } catch (err) {
      console.log(`  [${label}] Failed: ${err.message}`);
    }
  }
  throw new Error(`All endpoints failed for ${label}`);
}

async function fetchOverpass() {
  console.log("Fetching LEGAL vehicle routes from OpenStreetMap...");
  console.log(`Coverage: County Durham + Yorkshire (${BBOX})\n`);

  // Run query 1
  const data1 = await runQuery(query1, "BOATs+designated");
  
  // Small delay to be polite
  await new Promise(r => setTimeout(r, 5000));
  
  // Run query 2
  const data2 = await runQuery(query2, "Unsurfaced UCRs");

  // Merge elements
  const allElements = [...data1.elements, ...data2.elements];
  console.log(`\nTotal elements: ${allElements.length}`);

  const nodes = {};
  for (const el of allElements) {
    if (el.type === "node") nodes[el.id] = [el.lon, el.lat];
  }

  const seen = new Set();
  const features = [];

  for (const el of allElements) {
    if (el.type !== "way") continue;
    if (seen.has(el.id)) continue;
    seen.add(el.id);

    const coords = el.nodes.map((nid) => nodes[nid]).filter(Boolean);
    if (coords.length < 2) continue;

    const tags = el.tags || {};

    // STRICT: Exclude private access
    if (tags.access === "private") continue;
    // Exclude non-designated routes where motor vehicles banned
    if (tags.motor_vehicle === "no" && !tags.designation) continue;

    const designation = tags.designation || "";

    let routeType;
    let legalBasis;

    if (designation === "byway_open_to_all_traffic" || designation === "public_byway" || tags.highway === "byway") {
      routeType = "BOAT";
      legalBasis = "Definitive Map - Byway Open to All Traffic";
    } else if (designation === "unclassified_county_road" || designation === "unclassified_highway") {
      routeType = "UCR";
      legalBasis = "Definitive Map - Unclassified County Road";
    } else if (tags.highway === "unclassified") {
      routeType = "UCR";
      legalBasis = "List of Streets - Unsurfaced public highway";
    } else {
      continue;
    }

    let legalStatus = "open";
    if (tags.motor_vehicle === "no") legalStatus = "tro_restricted";
    else if (tags.motor_vehicle === "destination") legalStatus = "destination_only";

    const name = tags.name || tags.ref || `${routeType} (OSM ${el.id})`;

    features.push({
      type: "Feature",
      geometry: { type: "LineString", coordinates: coords },
      properties: {
        id: `osm-${el.id}`,
        osmId: el.id,
        name,
        type: routeType,
        legalBasis,
        legalStatus,
        designation,
        highway: tags.highway || "",
        surface: tags.surface || "unknown",
        tracktype: tags.tracktype || "",
        access: tags.access || "",
        motor_vehicle: tags.motor_vehicle || "",
        foot: tags.foot || "",
        horse: tags.horse || "",
        bicycle: tags.bicycle || "",
        ref: tags.ref || "",
        note: tags.note || "",
        source: "OpenStreetMap",
      },
    });
  }

  const geojson = {
    type: "FeatureCollection",
    metadata: {
      source: "OpenStreetMap via Overpass API",
      legal_note: "BOATs from definitive map designation, UCRs from List of Streets / definitive map. All confirmed legal for vehicles.",
      query_bbox: BBOX,
      fetched_at: new Date().toISOString(),
      total_ways: features.length,
    },
    features,
  };

  const boats = features.filter((f) => f.properties.type === "BOAT").length;
  const ucrs = features.filter((f) => f.properties.type === "UCR").length;
  const open = features.filter((f) => f.properties.legalStatus === "open").length;
  const tro = features.filter((f) => f.properties.legalStatus === "tro_restricted").length;

  console.log(`\n=== RESULTS ===`);
  console.log(`Total legal routes: ${features.length}`);
  console.log(`  BOATs: ${boats}`);
  console.log(`  UCRs: ${ucrs}`);
  console.log(`  Open to vehicles: ${open}`);
  console.log(`  TRO restricted: ${tro}`);

  const fs = await import("fs");
  fs.writeFileSync("src/data/osm-routes.json", JSON.stringify(geojson, null, 2));
  console.log(`\nWritten to src/data/osm-routes.json`);
}

fetchOverpass().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
