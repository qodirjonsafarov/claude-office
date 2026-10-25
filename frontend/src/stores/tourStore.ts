"use client";

import { create } from "zustand";

// ============================================================================
// TYPES
// ============================================================================

export type TourStepType = "interactive" | "narrated";

export type AdvanceCondition =
  | { kind: "click"; targetTourId: string }
  | { kind: "timer"; durationMs: number }
  | { kind: "simulation-event"; event: string }
  | { kind: "focus-popup" };

export interface TourStep {
  id: string;
  type: TourStepType;
  targetTourId: string | null;
  titleKey: string;
  descriptionKey: string;
  advanceOn: AdvanceCondition;
  /** Hint label shown near the pointer ring */
  pointerLabel: string | null;
  /** If true, spotlight is wide/absent so user can see the full canvas */
  wideSpotlight: boolean;
}

interface TourState {
  isActive: boolean;
  currentStepIndex: number;
  steps: TourStep[];
  hasSeenTour: boolean;
  startTour: () => void;
  advanceStep: () => void;
  skipTour: () => void;
  completeTour: () => void;
  currentStep: () => TourStep | null;
  loadTourSeen: () => void;
}

// ============================================================================
// STEP DEFINITIONS — SINGLE SESSION MODE
// ============================================================================

const SINGLE_TOUR_STEPS: TourStep[] = [
  {
    id: "single-welcome",
    type: "interactive",
    targetTourId: null,
    titleKey: "tour.steps.singleWelcome.title",
    descriptionKey: "tour.steps.singleWelcome.description",
    advanceOn: { kind: "timer", durationMs: 4000 },
    pointerLabel: null,
    wideSpotlight: true,
  },

  {
    id: "single-inspect-agent",
    type: "interactive",
    targetTourId: "game-canvas",
    titleKey: "tour.steps.inspectAgent.title",
    descriptionKey: "tour.steps.inspectAgent.description",
    advanceOn: { kind: "focus-popup" },
    pointerLabel: "click a character",
    wideSpotlight: true,
  },
  {
    id: "single-focus-popup",
    type: "narrated",
    targetTourId: null,
    titleKey: "tour.steps.focusPopup.title",
    descriptionKey: "tour.steps.focusPopup.description",
    advanceOn: { kind: "timer", durationMs: 5000 },
    pointerLabel: null,
    wideSpotlight: true,
  },
  {
    id: "single-settings",
    type: "interactive",
    targetTourId: "settings-btn",
    titleKey: "tour.steps.settings.title",
    descriptionKey: "tour.steps.settings.description",
    advanceOn: { kind: "timer", durationMs: 6000 },
    pointerLabel: "settings here",
    wideSpotlight: false,
  },
];

// ============================================================================
// STORE
// ============================================================================

const TOUR_SEEN_KEY = "claude-office-tour-seen";

export const useTourStore = create<TourState>()((set, get) => ({
  isActive: false,
  currentStepIndex: 0,
  steps: SINGLE_TOUR_STEPS,
  hasSeenTour: false,

  startTour: () =>
    set({
      isActive: true,
      currentStepIndex: 0,
      steps: SINGLE_TOUR_STEPS,
    }),

  advanceStep: () => {
    const { currentStepIndex, steps } = get();
    const nextIndex = currentStepIndex + 1;
    if (nextIndex >= steps.length) {
      get().completeTour();
    } else {
      set({ currentStepIndex: nextIndex });
    }
  },

  skipTour: () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(TOUR_SEEN_KEY, "true");
    }
    set({ isActive: false, currentStepIndex: 0, hasSeenTour: true });
  },

  completeTour: () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(TOUR_SEEN_KEY, "true");
    }
    set({ isActive: false, currentStepIndex: 0, hasSeenTour: true });
  },

  currentStep: () => {
    const { isActive, currentStepIndex, steps } = get();
    if (!isActive || currentStepIndex >= steps.length) return null;
    return steps[currentStepIndex];
  },

  loadTourSeen: () => {
    if (typeof window === "undefined") return;
    const seen = localStorage.getItem(TOUR_SEEN_KEY) === "true";
    set({ hasSeenTour: seen });
  },
}));
