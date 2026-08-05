import { Difficulty } from "@/types/route";
import { OsmRouteProperties } from "./routes";

/**
 * Derives a difficulty estimate from OSM tags.
 * This is a baseline heuristic - real difficulty should come from user reports.
 *
 * Factors considered:
 * - surface tag (mud, grass = harder; gravel, compacted = easier)
 * - tracktype (grade1 = easy; grade5 = extreme)
 * - motor_vehicle access restrictions hint at rough terrain
 */
export function estimateDifficulty(props: OsmRouteProperties): Difficulty {
  const surface = props.surface.toLowerCase();
  const tracktype = props.tracktype.toLowerCase();

  // Tracktype is the most reliable indicator in OSM
  if (tracktype === "grade1") return "easy";
  if (tracktype === "grade2") return "easy";
  if (tracktype === "grade3") return "moderate";
  if (tracktype === "grade4") return "challenging";
  if (tracktype === "grade5") return "extreme";

  // Fall back to surface
  if (["asphalt", "paved", "concrete", "compacted"].includes(surface)) return "easy";
  if (["gravel", "fine_gravel", "pebblestone"].includes(surface)) return "moderate";
  if (["dirt", "earth", "sand", "grass"].includes(surface)) return "challenging";
  if (["mud", "bog"].includes(surface)) return "extreme";
  if (surface === "unpaved" || surface === "ground") return "moderate";

  // If highway=track with no surface info, assume moderate
  if (props.highway === "track") return "moderate";

  return "unknown";
}

/**
 * Community difficulty overrides.
 * Key = OSM way ID, value = reported difficulty from real users.
 * Sources: TW2 user reports, forum posts, greenlaning community feedback.
 *
 * Add entries here as real feedback is gathered.
 */
export const communityRatings: Record<number, {
  difficulty: Difficulty;
  source: string;
  notes?: string;
}> = {
  // Examples based on well-known routes discussed in community forums:
  // Sleightholme Moor Road area
  // Cam High Road area
  // These would be populated from real user feedback
};

/**
 * Get the best available difficulty for a route.
 * Prefers community rating over OSM-derived estimate.
 */
export function getDifficulty(props: OsmRouteProperties): Difficulty {
  const communityRating = communityRatings[props.osmId];
  if (communityRating) return communityRating.difficulty;
  return estimateDifficulty(props);
}
