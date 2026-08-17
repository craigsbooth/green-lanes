/**
 * Simple grid-based spatial index for fast nearest-green-lane lookups.
 * Divides the map into grid cells and indexes which features have coordinates in each cell.
 * Lookup is O(1) for the grid cell + O(n) only within that cell's features.
 */

interface IndexedFeature {
  featureId: string;
  coord: [number, number]; // [lng, lat]
}

interface GridCell {
  features: IndexedFeature[];
}

export class SpatialGrid {
  private grid: Map<string, GridCell> = new Map();
  private cellSize: number;

  /**
   * @param cellSize Size of each grid cell in degrees (0.01 ~ 1.1km)
   */
  constructor(cellSize: number = 0.01) {
    this.cellSize = cellSize;
  }

  private getCellKey(lat: number, lng: number): string {
    const row = Math.floor(lat / this.cellSize);
    const col = Math.floor(lng / this.cellSize);
    return `${row},${col}`;
  }

  /**
   * Index all features. Call once at startup.
   */
  buildIndex(features: { properties: { id: string }; geometry: { coordinates: [number, number][] } }[]): void {
    this.grid.clear();
    for (const feature of features) {
      const coords = feature.geometry.coordinates;
      // Sample every 3rd coordinate to keep index smaller
      for (let i = 0; i < coords.length; i += 3) {
        const [lng, lat] = coords[i];
        const key = this.getCellKey(lat, lng);
        if (!this.grid.has(key)) {
          this.grid.set(key, { features: [] });
        }
        this.grid.get(key)!.features.push({
          featureId: feature.properties.id,
          coord: coords[i],
        });
      }
    }
  }

  /**
   * Find the nearest feature to a given point.
   * Searches the cell and its 8 neighbours.
   * Returns null if nothing within maxDistKm.
   */
  findNearest(
    lat: number,
    lng: number,
    maxDistKm: number = 0.1
  ): { featureId: string; point: [number, number]; distance: number } | null {
    const row = Math.floor(lat / this.cellSize);
    const col = Math.floor(lng / this.cellSize);

    let nearest: { featureId: string; point: [number, number]; distance: number } | null = null;

    // Check 3x3 grid of cells around the point
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const key = `${row + dr},${col + dc}`;
        const cell = this.grid.get(key);
        if (!cell) continue;

        for (const entry of cell.features) {
          const dist = this.haversine(lat, lng, entry.coord[1], entry.coord[0]);
          if (dist < maxDistKm && (!nearest || dist < nearest.distance)) {
            nearest = { featureId: entry.featureId, point: entry.coord, distance: dist };
          }
        }
      }
    }

    return nearest;
  }

  private haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}
