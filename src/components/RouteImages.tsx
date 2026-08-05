"use client";

import { useEffect, useState } from "react";

interface ImageResult {
  title: string;
  thumbUrl: string;
  pageUrl: string;
  dist: number;
}

interface Props {
  coordinates: [number, number][]; // full route line [lng, lat][]
  routeName: string;
}

/**
 * Searches for images along the actual route line, not just a single point.
 * Samples multiple points along the route and uses a tight 100m radius
 * so we only get images that are genuinely ON the track.
 */
export function RouteImages({ coordinates, routeName }: Props) {
  const [images, setImages] = useState<ImageResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setImages([]);

    fetchImagesAlongRoute(coordinates)
      .then((results) => {
        setImages(results);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [coordinates]);

  if (loading) {
    return (
      <div className="mb-4">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Route Images</h3>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <div className="animate-spin h-3 w-3 border-2 border-gray-300 border-t-gray-600 rounded-full"></div>
          Searching for images along this route...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-4">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Route Images</h3>
        <p className="text-xs text-gray-400">Could not load images.</p>
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="mb-4">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Route Images</h3>
        <p className="text-xs text-gray-400">No images found on this route (within 100m of the track).</p>
        <a
          href={`https://commons.wikimedia.org/w/index.php?search=${encodeURIComponent(routeName)}&title=Special:MediaSearch&type=image`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-500 hover:underline mt-1 inline-block"
        >
          Search Wikimedia Commons manually
        </a>
      </div>
    );
  }

  return (
    <div className="mb-4">
      <h3 className="text-sm font-medium text-gray-700 mb-2">
        Route Images ({images.length})
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {images.map((img, idx) => (
          <a
            key={idx}
            href={img.pageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block aspect-video bg-gray-100 rounded-md overflow-hidden hover:opacity-90 transition-opacity"
            title={img.title}
          >
            <img
              src={img.thumbUrl}
              alt={img.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </a>
        ))}
      </div>
      <p className="text-xs text-gray-400 mt-2">
        Images within 100m of the track (Wikimedia Commons, CC licensed).
      </p>
    </div>
  );
}

/**
 * Sample points along the route and search for images at each.
 * Uses tight 100m radius to ensure images are actually on/beside the track.
 */
async function fetchImagesAlongRoute(coords: [number, number][]): Promise<ImageResult[]> {
  // Sample up to 5 points evenly spaced along the route
  const sampleCount = Math.min(5, coords.length);
  const step = Math.max(1, Math.floor(coords.length / sampleCount));
  const samplePoints: [number, number][] = [];
  for (let i = 0; i < coords.length; i += step) {
    samplePoints.push(coords[i]);
    if (samplePoints.length >= sampleCount) break;
  }

  const seen = new Set<string>();
  const allResults: ImageResult[] = [];

  // Query each sample point (sequentially to avoid hammering the API)
  for (const [lng, lat] of samplePoints) {
    try {
      const results = await fetchWikimediaAtPoint(lat, lng);
      for (const r of results) {
        if (!seen.has(r.pageUrl)) {
          seen.add(r.pageUrl);
          allResults.push(r);
        }
      }
    } catch {
      // Skip failed points, continue with others
    }
    // Small delay between requests
    await new Promise((r) => setTimeout(r, 200));
  }

  // Sort by distance (closest to track first), limit to 8
  return allResults.sort((a, b) => a.dist - b.dist).slice(0, 8);
}

async function fetchWikimediaAtPoint(lat: number, lng: number): Promise<ImageResult[]> {
  // 100m radius - very tight, only gets images basically on the track
  const geoUrl = `https://commons.wikimedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}|${lng}&gsradius=100&gsnamespace=6&gslimit=5&format=json&origin=*`;

  const geoRes = await fetch(geoUrl);
  if (!geoRes.ok) return [];

  const geoData = await geoRes.json();
  const pages = geoData?.query?.geosearch || [];
  if (pages.length === 0) return [];

  const pageIds = pages.map((p: any) => p.pageid).join("|");
  const infoUrl = `https://commons.wikimedia.org/w/api.php?action=query&pageids=${pageIds}&prop=imageinfo&iiprop=url&iiurlwidth=400&format=json&origin=*`;

  const infoRes = await fetch(infoUrl);
  if (!infoRes.ok) return [];

  const infoData = await infoRes.json();
  const pagesMap = infoData?.query?.pages || {};

  const results: ImageResult[] = [];
  for (const geoPage of pages) {
    const page = pagesMap[geoPage.pageid];
    if (!page) continue;
    const info = page.imageinfo?.[0];
    if (!info) continue;
    // Skip non-photo files
    if (info.url?.endsWith(".svg") || info.url?.endsWith(".pdf") || info.url?.endsWith(".ogv")) continue;

    results.push({
      title: page.title?.replace("File:", "") || "Image",
      thumbUrl: info.thumburl || info.url,
      pageUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
      dist: geoPage.dist, // distance in metres from the sample point
    });
  }

  return results;
}
