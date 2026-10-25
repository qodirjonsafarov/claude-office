/**
 * Navigation types. The app has one view, the office ("single"); the
 * upstream building/floor/Command Center views were removed. Floor config
 * types stay for the backend's /floors endpoint.
 */

/** Current view mode */
export type ViewMode = "single";

/** Sentinel floor ID for the lobby (unmatched sessions) */
export const LOBBY_FLOOR_ID = "__lobby__";

/** Room configuration mapped to a repository */
export interface RoomConfig {
  id: string;
  repoName: string;
}

/** Floor configuration from building config */
export interface FloorConfig {
  id: string;
  name: string;
  floorNumber: number;
  accent: string;
  icon: string;
  rooms: RoomConfig[];
}

/** Full building configuration */
export interface BuildingConfig {
  buildingName: string;
  floors: FloorConfig[];
}
