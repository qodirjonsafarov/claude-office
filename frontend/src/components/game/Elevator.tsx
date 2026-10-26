/**
 * Elevator Component
 *
 * Renders the elevator with animated doors, indicator light, and agents inside,
 * drawn in the theme's materials (brushed steel doors in a graphite portal,
 * a lime floor indicator). The elevator has three layers:
 * 1. Cabin interior (background)
 * 2. Agents inside (middle)
 * 3. Doors, portal and indicator (foreground)
 */

import {
  type ReactNode,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { Graphics, Texture } from "pixi.js";
import { scenePalette, type ScenePalette } from "@/systems/scenePalette";
import { useTheme } from "@/systems/themeStore";
import { box, wash } from "./shared/pixelDraw";
import { ELEVATOR_POSITION } from "@/systems/queuePositions";
import { AgentSprite } from "./AgentSprite";
import type { AgentAnimationState } from "@/stores/gameStore";

interface ElevatorProps {
  /** Whether the elevator doors are open */
  isOpen: boolean;
  /** Map of all agents to filter those inside elevator */
  agents: Map<string, AgentAnimationState>;
  /** People sheet per agent id (look by role) */
  looks?: Map<string, string>;
  /** Headset texture for agents */
  headsetTexture: Texture | null;
  /** Sunglasses texture for agents */
  sunglassesTexture: Texture | null;
}

/**
 * Check if an agent is inside the elevator bounds
 */
function isInsideElevator(
  agentX: number,
  agentY: number,
  elevatorX: number,
  elevatorY: number,
): boolean {
  const dx = Math.abs(agentX - elevatorX);
  const dy = Math.abs(agentY - elevatorY);
  return dx < 50 && dy < 80;
}

// Local geometry (the elevator's centre is ELEVATOR_POSITION)
const DOOR_TOP = -53;
const DOOR_BOTTOM = 71;
const DOOR_HALF = 50;
const PORTAL_HALF = 62;
const PORTAL_TOP = -74;
/** The closed door scale of the old sprite doors (kept as the animation range). */
const CLOSED_SCALE = 0.09;

/** The cabin behind the doors: back wall, handrail, ceiling light, floor. */
function drawCabin(g: Graphics, p: ScenePalette): void {
  const m = p.materials;
  g.clear();
  box(
    g,
    -DOOR_HALF,
    DOOR_TOP,
    DOOR_HALF * 2,
    DOOR_BOTTOM - DOOR_TOP,
    m.graphite,
  );
  // Back wall panels
  for (const px of [-44, -14, 16]) {
    box(g, px, DOOR_TOP + 10, 28, 84, m.graphiteLight);
    wash(g, px, DOOR_TOP + 10, 28, 1, p.bevelLight);
  }
  // Ceiling light and its glow
  box(g, -30, DOOR_TOP + 2, 60, 3, m.lampShade);
  wash(g, -40, DOOR_TOP + 5, 80, 8, { color: m.lampShade, alpha: 0.12 });
  // Handrail
  box(g, -46, DOOR_TOP + 60, 92, 3, m.metal, m.outline);
  // Floor
  box(g, -DOOR_HALF, DOOR_BOTTOM - 16, DOOR_HALF * 2, 16, m.metalDark);
  wash(g, -DOOR_HALF, DOOR_BOTTOM - 16, DOOR_HALF * 2, 1, p.bevelLight);
}

/** One brushed-steel door leaf, `w` wide, its edge toward the middle. */
function drawLeaf(g: Graphics, p: ScenePalette, side: -1 | 1, w: number): void {
  if (w < 1) return;
  const m = p.materials;
  const x = side < 0 ? -DOOR_HALF : DOOR_HALF - w;
  const h = DOOR_BOTTOM - DOOR_TOP;
  box(g, x, DOOR_TOP, w, h, m.metal, m.outline);
  // Brushed steel: a lit strip and a few fine vertical lines
  wash(g, x + 2, DOOR_TOP + 1, Math.max(1, w * 0.18), h - 2, p.bevelLight);
  for (let lx = x + 6; lx < x + w - 3; lx += 7) {
    wash(g, lx, DOOR_TOP + 4, 1, h - 8, { color: m.metalDark, alpha: 0.18 });
  }
  // Kick plate at the bottom
  box(g, x + 1, DOOR_BOTTOM - 12, w - 2, 11, m.metalDark);
}

/** The portal round the doors, the floor display and the call buttons. */
function drawPortal(g: Graphics, p: ScenePalette, open: boolean): void {
  const m = p.materials;
  g.clear();
  // Jambs and header in graphite with a lit inner edge
  box(
    g,
    -PORTAL_HALF,
    PORTAL_TOP,
    12,
    DOOR_BOTTOM - PORTAL_TOP + 2,
    m.graphiteLight,
    m.outline,
  );
  box(
    g,
    DOOR_HALF,
    PORTAL_TOP,
    12,
    DOOR_BOTTOM - PORTAL_TOP + 2,
    m.graphiteLight,
    m.outline,
  );
  box(
    g,
    -PORTAL_HALF,
    PORTAL_TOP,
    PORTAL_HALF * 2,
    DOOR_TOP - PORTAL_TOP,
    m.graphiteLight,
    m.outline,
  );
  wash(
    g,
    -PORTAL_HALF + 1,
    PORTAL_TOP + 1,
    PORTAL_HALF * 2 - 2,
    1,
    p.bevelLight,
  );
  wash(g, DOOR_HALF - 1, DOOR_TOP, 1, DOOR_BOTTOM - DOOR_TOP, p.bevelShade);
  wash(g, -DOOR_HALF, DOOR_TOP, 1, DOOR_BOTTOM - DOOR_TOP, p.bevelShade);
  // Floor display: a dark panel with the arrow (lit while open)
  box(g, -16, PORTAL_TOP + 5, 32, 12, m.screen, m.outline);
  const lit = open ? m.accent : m.metalDark;
  g.poly([-9, PORTAL_TOP + 14, -5, PORTAL_TOP + 8, -1, PORTAL_TOP + 14]);
  g.fill(lit);
  // The floor number "1"
  const digit = open ? m.accent : m.graphiteLight;
  box(g, 6, PORTAL_TOP + 8, 2, 6, digit);
  box(g, 4, PORTAL_TOP + 9, 2, 1, digit);
  box(g, 4, PORTAL_TOP + 13, 6, 1, digit);
  // Threshold plate on the floor
  box(
    g,
    -DOOR_HALF - 4,
    DOOR_BOTTOM - 1,
    DOOR_HALF * 2 + 8,
    4,
    m.metal,
    m.outline,
  );
  // Call buttons on the wall to the right
  box(g, PORTAL_HALF + 4, -6, 9, 20, m.metal, m.outline);
  box(g, PORTAL_HALF + 7, -2, 3, 3, open ? m.accent : m.metalDark);
  box(g, PORTAL_HALF + 7, 6, 3, 3, m.metalDark);
}

/**
 * Hook for animated door scale
 */
function useDoorAnimation(isOpen: boolean): number {
  const [doorScale, setDoorScale] = useState(CLOSED_SCALE);
  const doorScaleRef = useRef(CLOSED_SCALE);

  useEffect(() => {
    const targetScale = isOpen ? 0 : CLOSED_SCALE;
    const duration = 500; // 0.5 seconds
    const startScale = doorScaleRef.current;
    const startTime = performance.now();
    let animId: number;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic for smooth deceleration
      const eased = 1 - Math.pow(1 - progress, 3);
      const newScale = startScale + (targetScale - startScale) * eased;

      doorScaleRef.current = newScale;
      setDoorScale(newScale);

      if (progress < 1) {
        animId = requestAnimationFrame(animate);
      }
    };

    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [isOpen]);

  return doorScale;
}

export function Elevator({
  isOpen,
  agents,
  looks,
  headsetTexture,
  sunglassesTexture,
}: ElevatorProps): ReactNode {
  const doorScale = useDoorAnimation(isOpen);
  const palette = scenePalette(useTheme());
  const leafWidth = Math.round((DOOR_HALF * doorScale) / CLOSED_SCALE);
  const drawCabinCallback = useCallback(
    (g: Graphics) => drawCabin(g, palette),
    [palette],
  );
  const drawDoorsCallback = useCallback(
    (g: Graphics) => {
      g.clear();
      drawLeaf(g, palette, -1, leafWidth);
      drawLeaf(g, palette, 1, leafWidth);
    },
    [palette, leafWidth],
  );
  const drawPortalCallback = useCallback(
    (g: Graphics) => drawPortal(g, palette, isOpen),
    [palette, isOpen],
  );

  // Filter agents that are inside the elevator
  const agentsInside = Array.from(agents.values()).filter((agent) =>
    isInsideElevator(
      agent.currentPosition.x,
      agent.currentPosition.y,
      ELEVATOR_POSITION.x,
      ELEVATOR_POSITION.y,
    ),
  );

  return (
    <>
      {/* Cabin interior (background) */}
      <pixiContainer x={ELEVATOR_POSITION.x} y={ELEVATOR_POSITION.y}>
        <pixiGraphics draw={drawCabinCallback} />
      </pixiContainer>

      {/* Agents inside elevator (behind doors) */}
      {agentsInside.map((agent) => (
        <AgentSprite
          key={agent.id}
          id={agent.id}
          name={agent.name}
          color={agent.color}
          number={agent.number}
          position={agent.currentPosition}
          phase={agent.phase}
          bubble={agent.bubble.content}
          headsetTexture={headsetTexture}
          sunglassesTexture={sunglassesTexture}
          renderBubble={false}
          isTyping={agent.isTyping}
          desk={agent.desk}
          backendState={agent.backendState}
          sheet={looks?.get(agent.id)}
        />
      ))}

      {/* Doors, portal and indicator (in front of agents inside) */}
      <pixiContainer x={ELEVATOR_POSITION.x} y={ELEVATOR_POSITION.y}>
        <pixiGraphics draw={drawDoorsCallback} />
        <pixiGraphics draw={drawPortalCallback} />
      </pixiContainer>
    </>
  );
}

/**
 * Check if an agent is inside the elevator (for external use)
 */
export function isAgentInElevator(agentX: number, agentY: number): boolean {
  return isInsideElevator(
    agentX,
    agentY,
    ELEVATOR_POSITION.x,
    ELEVATOR_POSITION.y,
  );
}
