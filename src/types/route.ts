export type RouteType = "BOAT" | "UCR";
export type Difficulty = "unknown" | "easy" | "moderate" | "challenging" | "extreme";

export interface FilterState {
  type: RouteType | "all";
  surface: string;
  difficulty: Difficulty | "all";
  searchText: string;
  hideRestricted: boolean;
}
