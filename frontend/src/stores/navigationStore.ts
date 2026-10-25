"use client";

import { create } from "zustand";
import type { ViewMode, BuildingConfig, FloorConfig } from "@/types/navigation";

// ============================================================================
// TYPES
// ============================================================================

/**
 * What is left of the upstream building/floor navigation: the app always
 * shows the single office (one session at a time). The floor config is still
 * loaded so the office can label its elevator if a floor is ever selected.
 */
interface NavigationState {
  /** Always the office. */
  view: ViewMode;
  /** Selected floor ID (null: no floor; the office is not inside a building) */
  floorId: string | null;
  /** Building configuration loaded from backend */
  buildingConfig: BuildingConfig | null;
  /** Whether config is loading */
  isLoading: boolean;
}

interface NavigationActions {
  /** Store the building config from the API. Never changes the view. */
  setBuildingConfig: (config: BuildingConfig) => void;
  /** Set loading state */
  setLoading: (loading: boolean) => void;
  /** Get the currently selected floor config */
  getCurrentFloor: () => FloorConfig | null;
}

type NavigationStore = NavigationState & NavigationActions;

// ============================================================================
// STORE
// ============================================================================

export const useNavigationStore = create<NavigationStore>()((set, get) => ({
  view: "single",
  floorId: null,
  buildingConfig: null,
  isLoading: false,

  setBuildingConfig: (config) =>
    set({ buildingConfig: config, isLoading: false }),

  setLoading: (loading) => set({ isLoading: loading }),

  getCurrentFloor: () => {
    const { buildingConfig, floorId } = get();
    if (!buildingConfig || !floorId) return null;
    return buildingConfig.floors.find((f) => f.id === floorId) ?? null;
  },
}));
