"use client";

import { Graphics, Container } from "pixi.js";
import {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import {
  useGameStore,
  selectDebugMode,
  selectSessionId,
} from "@/stores/gameStore";

import {
  URL_TIME_OVERRIDE,
  sceneClock,
  useSceneHours,
} from "@/systems/sceneClock";

import { scenePalette } from "@/systems/scenePalette";
import { useTheme } from "@/systems/themeStore";

// City sub-modules
import {
  computeTimeState,
  getSeasonalTimes,
  hashString,
} from "./city/timeUtils";
import {
  getInterpolatedSkyColors,
  drawSkyGradient,
  drawStars,
  drawMoon,
  drawSunAndClouds,
  drawWindowDividers,
} from "./city/skyRenderer";
import {
  drawBuildings,
  DEFAULT_BUILDINGS,
  BUILDING_WINDOW_COUNTS,
} from "./city/buildingRenderer";

// ============================================================================
// CONSTANTS
// ============================================================================

const FRAME_WIDTH = 200;
const FRAME_HEIGHT = 160;
const FRAME_THICKNESS = 8;
const INNER_WIDTH = FRAME_WIDTH - FRAME_THICKNESS * 2;
const INNER_HEIGHT = FRAME_HEIGHT - FRAME_THICKNESS * 2;

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Check if sessionId represents a real (non-simulation) session.
 */
function isRealSession(sessionId: string): boolean {
  return sessionId !== "None" && sessionId !== "sim_session_123";
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * CityWindow — Window decoration showing city skyline.
 *
 * Displays a view of a city skyline that smoothly transitions based on real
 * time.  Features animated sky gradients, building silhouettes, and window
 * lights.
 *
 * Rendering logic is delegated to:
 *   - `city/timeUtils.ts`    — Phase and seasonal time calculations
 *   - `city/skyRenderer.ts`  — Sky gradient, sun, moon, stars, clouds
 *   - `city/buildingRenderer.ts` — Building silhouettes and windows
 */
export function CityWindow(): ReactNode {
  const [time, setTime] = useState(new Date());
  const palette = scenePalette(useTheme());
  const [debugHour, setDebugHour] = useState(0);
  const [fastTimeToggle, setFastTimeToggle] = useState(false);
  const debugMode = useGameStore(selectDebugMode);
  const sessionId = useGameStore(selectSessionId);

  // Stable seed derived from sessionId (or daily date for simulations)
  const citySeed = useMemo(() => {
    if (isRealSession(sessionId)) {
      return hashString(sessionId);
    }
    const now = new Date();
    return hashString(
      `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`,
    );
  }, [sessionId]);

  // Toggled window lights (key: "buildingIdx-row-col")
  const [toggledWindows, setToggledWindows] = useState<Set<string>>(
    () => new Set(),
  );

  // Animated cloud x-offsets
  const [cloudOffsets, setCloudOffsets] = useState({ top: 0, bottom: 0 });

  // Refs for PixiJS masking
  const maskRef = useRef<Graphics>(null);
  const contentContainerRef = useRef<Container>(null);

  // Fast time is active only when debug mode is on AND the toggle is enabled
  const fastTimeEnabled = debugMode && fastTimeToggle;

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Keyboard shortcut: press 'T' in debug mode to toggle fast time
  useEffect(() => {
    if (!debugMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "t" || e.key === "T") {
        setFastTimeToggle((prev) => {
          if (!prev) {
            const now = new Date();
            setDebugHour(now.getHours() + now.getMinutes() / 60);
          }
          return !prev;
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [debugMode]);

  // Time updates: normal = every minute; fast = every 50 ms (full day in ~12 s)
  useEffect(() => {
    if (fastTimeEnabled) {
      const interval = setInterval(() => {
        setDebugHour((h) => (h + 0.1) % 24);
      }, 50);
      return () => clearInterval(interval);
    } else {
      const interval = setInterval(() => setTime(new Date()), 60000);
      return () => clearInterval(interval);
    }
  }, [fastTimeEnabled]);

  // Apply mask to content container
  useEffect(() => {
    if (maskRef.current && contentContainerRef.current) {
      contentContainerRef.current.mask = maskRef.current;
    }
  }, []);

  // Cloud drift animation (~20 FPS)
  useEffect(() => {
    const interval = setInterval(() => {
      setCloudOffsets((prev) => ({
        top: (prev.top + 0.0375) % (INNER_WIDTH + 60),
        bottom: (prev.bottom + 0.075) % (INNER_WIDTH + 60),
      }));
    }, 50);
    return () => clearInterval(interval);
  }, []);

  // Randomly toggle a window light every 1–3 minutes
  useEffect(() => {
    const scheduleNextToggle = (): ReturnType<typeof setTimeout> => {
      const delay = 60000 + Math.random() * 120000;
      return setTimeout(() => {
        const buildingIdx = Math.floor(
          Math.random() * BUILDING_WINDOW_COUNTS.length,
        );
        const { rows, cols } = BUILDING_WINDOW_COUNTS[buildingIdx];
        const row = Math.floor(Math.random() * rows);
        const col = Math.floor(Math.random() * cols);
        const key = `${buildingIdx}-${row}-${col}`;

        setToggledWindows((prev) => {
          const next = new Set(prev);
          if (next.has(key)) {
            next.delete(key);
          } else {
            next.add(key);
          }
          return next;
        });

        timeoutRef = scheduleNextToggle();
      }, delay);
    };

    let timeoutRef = scheduleNextToggle();
    return () => clearTimeout(timeoutRef);
  }, []);

  // ============================================================================
  // DERIVED STATE
  // ============================================================================

  // The office tint and lamps follow the same hours (systems/sceneClock.ts)
  const sceneHours = useSceneHours();
  useEffect(() => {
    if (!fastTimeEnabled) return;
    sceneClock.getState().setOverride(debugHour);
  }, [fastTimeEnabled, debugHour]);
  useEffect(() => {
    if (fastTimeEnabled) return;
    sceneClock.getState().setOverride(URL_TIME_OVERRIDE);
  }, [fastTimeEnabled]);

  const timeState = useMemo(() => {
    const hour = fastTimeEnabled ? debugHour : sceneHours;
    return computeTimeState(hour, time);
  }, [time, debugHour, fastTimeEnabled, sceneHours]);

  // ============================================================================
  // DRAW CALLBACKS
  // ============================================================================

  const drawMask = useCallback((g: Graphics) => {
    g.clear();
    g.rect(FRAME_THICKNESS, FRAME_THICKNESS, INNER_WIDTH, INNER_HEIGHT);
    g.fill(0xffffff);
  }, []);

  const drawFrame = useCallback(
    (g: Graphics) => {
      g.clear();
      const m = palette.materials;
      const t = FRAME_THICKNESS;
      // Frame: four bars with the shared outline, lit top-left, the glass
      // set back (a shade line inside)
      g.rect(0, 0, FRAME_WIDTH, t);
      g.rect(0, FRAME_HEIGHT - t, FRAME_WIDTH, t);
      g.rect(0, 0, t, FRAME_HEIGHT);
      g.rect(FRAME_WIDTH - t, 0, t, FRAME_HEIGHT);
      g.fill(palette.frame);
      g.rect(0, 0, FRAME_WIDTH, FRAME_HEIGHT);
      g.stroke({ width: 1, color: m.outline, alignment: 1 });
      g.rect(t - 1, t - 1, INNER_WIDTH + 2, INNER_HEIGHT + 2);
      g.stroke({ width: 1, color: m.outline, alignment: 1 });
      g.rect(1, 1, FRAME_WIDTH - 2, 1);
      g.rect(1, 1, 1, FRAME_HEIGHT - 2);
      g.fill(palette.frameLight);
      g.rect(t, t, INNER_WIDTH, 2);
      g.fill({ color: 0x000000, alpha: 0.25 });
      // Glass glints
      g.poly([t + 10, t + 2, t + 22, t + 2, t + 2, t + 30, t + 2, t + 16]);
      g.fill({ color: 0xffffff, alpha: 0.1 });
      // Sill
      g.rect(-6, FRAME_HEIGHT - 2, FRAME_WIDTH + 12, 7);
      g.fill(m.outline);
      g.rect(-5, FRAME_HEIGHT - 1, FRAME_WIDTH + 10, 5);
      g.fill(m.woodLight);
      g.rect(-5, FRAME_HEIGHT - 1, FRAME_WIDTH + 10, 1);
      g.fill(palette.bevelLight);
      g.rect(-4, FRAME_HEIGHT + 5, FRAME_WIDTH + 10, 3);
      g.fill(palette.shadow);
    },
    [palette],
  );

  const drawContent = useCallback(
    (g: Graphics) => {
      g.clear();

      const skyX = FRAME_THICKNESS;
      const skyY = FRAME_THICKNESS;
      const { phase, progress } = timeState;
      const bounds = {
        skyX,
        skyY,
        innerWidth: INNER_WIDTH,
        innerHeight: INNER_HEIGHT,
      };

      // Sky gradient
      const skyColors = getInterpolatedSkyColors(phase, progress);
      drawSkyGradient(g, bounds, skyColors);

      // Celestial bodies
      drawStars(g, bounds, timeState, time, skyColors);
      drawMoon(g, bounds, timeState, time, skyColors);
      drawSunAndClouds(g, bounds, timeState, time, skyColors, cloudOffsets);

      // Buildings
      drawBuildings(
        g,
        DEFAULT_BUILDINGS,
        timeState,
        skyX,
        skyY,
        INNER_HEIGHT,
        FRAME_THICKNESS,
        citySeed,
        toggledWindows,
      );

      // Window pane dividers (cross pattern)
      drawWindowDividers(g, bounds, palette.frame);

      // Seasonal times are used inside drawStars/drawMoon/drawSunAndClouds;
      // we also need them for the drawContent dependency array.
      void getSeasonalTimes(time);
    },
    [timeState, time, toggledWindows, citySeed, cloudOffsets, palette],
  );

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <pixiContainer>
      {/* Mask clips content to window interior */}
      <pixiGraphics ref={maskRef} draw={drawMask} />
      {/* Content container with mask applied */}
      <pixiContainer ref={contentContainerRef}>
        <pixiGraphics draw={drawContent} />
      </pixiContainer>
      {/* Frame drawn on top (not masked) */}
      <pixiGraphics draw={drawFrame} />
    </pixiContainer>
  );
}
