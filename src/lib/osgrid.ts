/**
 * Convert WGS84 lat/lng to Ordnance Survey National Grid Reference.
 * Used to generate TW2-compatible TWUIDs for deep linking.
 */

/**
 * Convert lat/lng (WGS84) to OS Grid Easting/Northing.
 */
export function latLngToOSGrid(lat: number, lng: number): { easting: number; northing: number } {
  const a = 6377563.396; // Airy 1830 semi-major axis
  const b = 6356256.909; // semi-minor axis
  const F0 = 0.9996012717;
  const lat0 = (49 * Math.PI) / 180;
  const lng0 = (-2 * Math.PI) / 180;
  const N0 = -100000;
  const E0 = 400000;
  const e2 = 1 - (b * b) / (a * a);
  const n = (a - b) / (a + b);

  // Convert WGS84 to OSGB36 (simplified Helmert transform)
  const dLat = -0.00004172222;
  const dLng = 0.00006861111;
  const oLat = ((lat + dLat) * Math.PI) / 180;
  const oLng = ((lng + dLng) * Math.PI) / 180;

  const sinLat = Math.sin(oLat);
  const cosLat = Math.cos(oLat);
  const tanLat = Math.tan(oLat);

  const nu = a * F0 / Math.sqrt(1 - e2 * sinLat * sinLat);
  const rho = a * F0 * (1 - e2) / Math.pow(1 - e2 * sinLat * sinLat, 1.5);
  const eta2 = nu / rho - 1;

  const Ma = (1 + n + (5/4) * n*n + (5/4) * n*n*n) * (oLat - lat0);
  const Mb = (3*n + 3*n*n + (21/8)*n*n*n) * Math.sin(oLat - lat0) * Math.cos(oLat + lat0);
  const Mc = ((15/8)*n*n + (15/8)*n*n*n) * Math.sin(2*(oLat - lat0)) * Math.cos(2*(oLat + lat0));
  const Md = (35/24)*n*n*n * Math.sin(3*(oLat - lat0)) * Math.cos(3*(oLat + lat0));
  const M = b * F0 * (Ma - Mb + Mc - Md);

  const dLng2 = oLng - lng0;
  const cos3 = cosLat * cosLat * cosLat;
  const cos5 = cos3 * cosLat * cosLat;
  const tan2 = tanLat * tanLat;
  const tan4 = tan2 * tan2;

  const I = M + N0;
  const II = (nu / 2) * sinLat * cosLat;
  const III = (nu / 24) * sinLat * cos3 * (5 - tan2 + 9 * eta2);
  const IIIA = (nu / 720) * sinLat * cos5 * (61 - 58 * tan2 + tan4);
  const IV = nu * cosLat;
  const V = (nu / 6) * cos3 * (nu / rho - tan2);
  const VI = (nu / 120) * cos5 * (5 - 18 * tan2 + tan4 + 14 * eta2 - 58 * tan2 * eta2);

  const northing = I + II * dLng2 * dLng2 + III * Math.pow(dLng2, 4) + IIIA * Math.pow(dLng2, 6);
  const easting = E0 + IV * dLng2 + V * Math.pow(dLng2, 3) + VI * Math.pow(dLng2, 5);

  return { easting: Math.round(easting), northing: Math.round(northing) };
}

/**
 * Convert OS Grid easting/northing to a grid reference string (e.g. "NZ0401").
 */
export function osGridToRef(easting: number, northing: number, digits: number = 4): string {
  const e100k = Math.floor(easting / 100000);
  const n100k = Math.floor(northing / 100000);

  // National Grid letter pairs
  let l1 = (19 - n100k) - (19 - n100k) % 5 + Math.floor((e100k + 10) / 5);
  let l2 = (19 - n100k) * 5 % 25 + e100k % 5;

  if (l1 < 0 || l1 > 24 || l2 < 0 || l2 > 24) return "";

  const letters = "ABCDEFGHJKLMNOPQRSTUVWXYZ";
  const gridRef = letters[l1] + letters[l2];

  const d = Math.pow(10, 5 - digits / 2);
  const e = Math.floor((easting % 100000) / d).toString().padStart(digits / 2, "0");
  const n = Math.floor((northing % 100000) / d).toString().padStart(digits / 2, "0");

  return gridRef + e + n;
}

/**
 * Get the 4-digit grid square reference for TW2 TWUID format.
 * TW2 TWUIDs look like "NZ0400-02" — the grid square (NZ0400) plus a sequence number.
 * We can only generate the grid square part; the sequence number is TW2-internal.
 */
export function getTW2GridSquare(lat: number, lng: number): string {
  const { easting, northing } = latLngToOSGrid(lat, lng);
  return osGridToRef(easting, northing, 4);
}
