import osmData from "./osm-routes.json";

export interface OsmRouteProperties {
  id: string;
  osmId: number;
  name: string;
  type: "BOAT" | "UCR";
  legalBasis: string;
  legalStatus: string;
  designation: string;
  highway: string;
  surface: string;
  tracktype: string;
  access: string;
  motor_vehicle: string;
  foot: string;
  horse: string;
  bicycle: string;
  ref: string;
  note: string;
  source: string;
}

export interface OsmRoute {
  type: "Feature";
  geometry: {
    type: "LineString";
    coordinates: [number, number][];
  };
  properties: OsmRouteProperties;
}

export interface OsmRouteCollection {
  type: "FeatureCollection";
  metadata: {
    source: string;
    query_bbox: string;
    fetched_at: string;
    total_ways: number;
  };
  features: OsmRoute[];
}

export const greenLanes = osmData as unknown as OsmRouteCollection;
