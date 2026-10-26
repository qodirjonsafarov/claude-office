/**
 * DeskGrid Components
 *
 * Renders the desk grid (furniture drawn in shared/furniture.ts) with:
 * - Desk surfaces and keyboards (DeskSurfacesBase - behind the seated hands)
 * - Monitors with a soft screen glow and desk accessories (DeskSurfacesTop)
 * - Task marquees on occupied desks
 */

import { type ReactNode, useCallback, useMemo } from "react";
import { Graphics, Rectangle, Texture } from "pixi.js";
import { DeskMarquee } from "./DeskMarquee";
import { scenePalette, type ScenePalette } from "@/systems/scenePalette";
import { useTheme } from "@/systems/themeStore";
import {
  drawChair,
  drawDesk,
  drawRug,
  drawKeyboard,
  drawMonitor,
  drawScreenGlow,
  workDesk,
} from "./shared/furniture";

// ============================================================================
// TYPES
// ============================================================================

export interface DeskPosition {
  x: number;
  y: number;
  isEmpty: boolean;
}

type DeskItem =
  | "mug"
  | "stapler"
  | "lamp"
  | "penholder"
  | "8ball"
  | "rubiks"
  | "duck"
  | "thermos"
  | "none";

// ============================================================================
// CONSTANTS
// ============================================================================

// Desk grid layout
const ROW_SIZE = 4;
const DESK_START_X = 256;
const DESK_START_Y = 408;
const DESK_SPACING_X = 256;
const DESK_SPACING_Y = 192;

// Different colors for desk accessories (tinted onto grayscale sprites)
const ACCESSORY_TINTS = [
  0xffffff, // White (no tint) - desk 0
  0x87ceeb, // Sky blue - desk 1
  0x98fb98, // Pale green - desk 2
  0xffb6c1, // Light pink - desk 3
  0xffd700, // Gold - desk 4
  0xdda0dd, // Plum - desk 5
  0xf0e68c, // Khaki - desk 6
  0xadd8e6, // Light blue - desk 7
];

// Deterministic "random" desk items - precomputed shuffled sequence
// Avoids row patterns while ensuring good variety
const DESK_ITEM_SEQUENCE: DeskItem[] = [
  "lamp",
  "mug",
  "8ball",
  "stapler",
  "penholder",
  "thermos",
  "rubiks",
  "duck",
  "lamp",
  "none",
  "none",
  "lamp",
  "stapler",
  "penholder",
  "mug",
  "mug",
  "8ball",
  "thermos",
  "rubiks",
  "duck",
];

// ============================================================================
// HOOKS
// ============================================================================

/** The desk origins of a grid of `deskCount` desks (4 per row). */
export function deskSpots(deskCount: number): Array<{ x: number; y: number }> {
  const spots: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < deskCount; i++) {
    const row = Math.floor(i / ROW_SIZE);
    const col = i % ROW_SIZE;
    // Grid-aligned positions: X at multiples of 32 (256, 512, 768, 1024)
    // Y spacing of 192 (6×32) ensures desk centers align to grid
    spots.push({
      x: DESK_START_X + col * DESK_SPACING_X,
      y: DESK_START_Y + row * DESK_SPACING_Y,
    });
  }
  return spots;
}

/**
 * Hook to compute desk positions based on desk count and occupancy.
 */
export function useDeskPositions(
  deskCount: number,
  occupiedDesks: Set<number>,
): DeskPosition[] {
  return useMemo(
    () =>
      deskSpots(deskCount).map((spot, i) => ({
        ...spot,
        isEmpty: !occupiedDesks.has(i + 1),
      })),
    [deskCount, occupiedDesks],
  );
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getDeskItem(index: number): DeskItem {
  return DESK_ITEM_SEQUENCE[index % DESK_ITEM_SEQUENCE.length];
}

// ============================================================================
// COMPONENTS
// ============================================================================

interface DeskSurfacesBaseProps {
  deskCount: number;
}

/** All desks and keyboards in one Graphics (redrawn on theme or count). */
function drawDeskBases(
  g: Graphics,
  p: ScenePalette,
  desks: ReadonlyArray<{ x: number; y: number }>,
): void {
  g.clear();
  const look = workDesk(p.materials);
  for (const desk of desks) {
    g.setTransform(1, 0, 0, 1, desk.x, desk.y);
    drawDesk(g, p, look);
    drawKeyboard(g, p.materials);
  }
  g.resetTransform();
}

/** The rug under the boss's desk (372 x 180, centred on x, y). */
export function BossRug({ x, y }: { x: number; y: number }): ReactNode {
  const palette = scenePalette(useTheme());
  const draw = useCallback(
    (g: Graphics) => {
      g.clear();
      drawRug(g, palette, 372, 180);
    },
    [palette],
  );
  return <pixiGraphics draw={draw} x={x} y={y} />;
}

/** A desk chair's back (sorted with the people, behind its worker). */
export function DeskChair({ boss = false }: { boss?: boolean }): ReactNode {
  const palette = scenePalette(useTheme());
  const draw = useCallback(
    (g: Graphics) => {
      g.clear();
      drawChair(g, palette, boss);
    },
    [palette, boss],
  );
  return <pixiGraphics draw={draw} />;
}

/**
 * Renders desk surfaces and keyboards (behind the seated hands).
 */
export function DeskSurfacesBase({
  deskCount,
}: DeskSurfacesBaseProps): ReactNode {
  const palette = scenePalette(useTheme());
  // Desks only move with the desk count, not with who sits where
  const layout = useMemo(() => deskSpots(deskCount), [deskCount]);
  const draw = useCallback(
    (g: Graphics) => drawDeskBases(g, palette, layout),
    [palette, layout],
  );
  return <pixiGraphics draw={draw} />;
}

interface DeskSurfacesTopProps {
  deskCount: number;
  occupiedDesks: Set<number>;
  deskTasks: Map<number, string>;
  coffeeMugTexture: Texture | null;
  staplerTexture: Texture | null;
  deskLampTexture: Texture | null;
  penHolderTexture: Texture | null;
  magic8BallTexture: Texture | null;
  rubiksCubeTexture: Texture | null;
  rubberDuckTexture: Texture | null;
  thermosTexture: Texture | null;
  /** Desks (1-based) whose worker runs a shell command: green screen glow. */
  terminalDesks?: ReadonlySet<number>;
  /** A tap on an occupied desk (1-based number, desk centre on the canvas). */
  onDeskTap?: (desk: number, x: number, y: number) => void;
}

/**
 * Soft accent light spilling from a monitor running a terminal. Stacked
 * translucent ellipses in "add" blend: a glow without any Pixi filter.
 */
function drawTerminalGlow(g: Graphics, accent: number): void {
  g.clear();
  // Wider than the monitor, so the light shows around its edges
  for (let i = 0; i < 4; i++) {
    g.ellipse(0, 0, 48 - i * 8, 28 - i * 5);
    g.fill({ color: accent, alpha: 0.05 + i * 0.02 });
  }
}

/** The tap target of a desk: the whole desk, not just what is drawn on it. */
const DESK_HIT_AREA = new Rectangle(-70, 0, 140, 104);

/** Where the monitor stands on the desk (its centre x). */
const MONITOR_X = -45;

/** A desk's monitor, its LED on while somebody sits there. */
function Monitor({ palette, lit }: { palette: ScenePalette; lit: boolean }) {
  const draw = useCallback(
    (g: Graphics) => {
      g.clear();
      drawMonitor(g, palette.materials, MONITOR_X, lit);
    },
    [palette, lit],
  );
  return <pixiGraphics draw={draw} />;
}

/**
 * Renders monitors and desk decorations (in front of agent arms).
 */
export function DeskSurfacesTop({
  deskCount,
  occupiedDesks,
  deskTasks,
  coffeeMugTexture,
  staplerTexture,
  deskLampTexture,
  penHolderTexture,
  magic8BallTexture,
  rubiksCubeTexture,
  rubberDuckTexture,
  thermosTexture,
  terminalDesks,
  onDeskTap,
}: DeskSurfacesTopProps): ReactNode {
  const desks = useDeskPositions(deskCount, occupiedDesks);
  const palette = scenePalette(useTheme());
  const drawGlow = useCallback(
    (g: Graphics) => drawScreenGlow(g, palette.materials),
    [palette],
  );
  const drawTerminal = useCallback(
    (g: Graphics) => drawTerminalGlow(g, palette.materials.led),
    [palette],
  );

  return (
    <>
      {desks.map((desk, i) => (
        <pixiContainer
          key={i}
          x={desk.x}
          y={desk.y}
          hitArea={onDeskTap && !desk.isEmpty ? DESK_HIT_AREA : null}
          interactive={!!onDeskTap && !desk.isEmpty}
          cursor={onDeskTap && !desk.isEmpty ? "pointer" : undefined}
          onPointerTap={
            onDeskTap && !desk.isEmpty
              ? () => onDeskTap(i + 1, desk.x, desk.y)
              : undefined
          }
        >
          {/* Somebody works here: the screen lights up its worker */}
          {!desk.isEmpty && (
            <pixiGraphics
              draw={drawGlow}
              x={MONITOR_X + 12}
              y={2}
              blendMode="add"
            />
          )}
          {/* Terminal running: an accent light round the screen */}
          {terminalDesks?.has(i + 1) && (
            <pixiGraphics
              draw={drawTerminal}
              x={MONITOR_X}
              y={14}
              blendMode="add"
            />
          )}
          {/* Monitor - back of desk surface (far from chair) */}
          <Monitor palette={palette} lit={!desk.isEmpty} />
          {/* Desk accessory - right corner, cycles through items */}
          {getDeskItem(i) === "mug" && coffeeMugTexture && (
            <pixiSprite
              texture={coffeeMugTexture}
              anchor={0.5}
              x={50}
              y={40}
              scale={0.025}
              tint={ACCESSORY_TINTS[i % ACCESSORY_TINTS.length]}
            />
          )}
          {getDeskItem(i) === "stapler" && staplerTexture && (
            <pixiSprite
              texture={staplerTexture}
              anchor={0.5}
              x={50}
              y={43}
              scale={0.19}
            />
          )}
          {getDeskItem(i) === "lamp" && deskLampTexture && (
            <pixiSprite
              texture={deskLampTexture}
              anchor={0.5}
              x={50}
              y={29}
              scale={0.35}
            />
          )}
          {getDeskItem(i) === "penholder" && penHolderTexture && (
            <pixiSprite
              texture={penHolderTexture}
              anchor={0.5}
              x={54}
              y={38}
              scale={0.22}
            />
          )}
          {getDeskItem(i) === "8ball" && magic8BallTexture && (
            <pixiSprite
              texture={magic8BallTexture}
              anchor={0.5}
              x={54}
              y={42}
              scale={0.162}
            />
          )}
          {getDeskItem(i) === "rubiks" && rubiksCubeTexture && (
            <pixiSprite
              texture={rubiksCubeTexture}
              anchor={0.5}
              x={52}
              y={42}
              scale={0.16}
            />
          )}
          {getDeskItem(i) === "duck" && rubberDuckTexture && (
            <pixiSprite
              texture={rubberDuckTexture}
              anchor={0.5}
              x={52}
              y={42}
              scale={0.16}
            />
          )}
          {getDeskItem(i) === "thermos" && thermosTexture && (
            <pixiSprite
              texture={thermosTexture}
              anchor={0.5}
              x={52}
              y={40}
              scale={0.36}
            />
          )}
          {/* Task marquee on desk surface - only for occupied desks */}
          <DeskMarquee text={deskTasks.get(i + 1) ?? ""} />
        </pixiContainer>
      ))}
    </>
  );
}
