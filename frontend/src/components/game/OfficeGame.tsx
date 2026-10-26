/**
 * OfficeGame - Main Game Canvas
 *
 * Main visualization component using:
 * - Centralized Zustand store
 * - XState state machines
 * - Single animation tick loop
 *
 * The component is purely for rendering - all state logic is in the store/machines.
 */

"use client";

import { Application, extend } from "@pixi/react";
import {
  Container,
  Text,
  Graphics,
  Sprite,
  TextureSource,
  Application as PixiApplication,
} from "pixi.js";
import {
  useMemo,
  useEffect,
  useRef,
  useCallback,
  useState,
  type ReactNode,
} from "react";
import {
  TransformWrapper,
  TransformComponent,
  type ReactZoomPanPinchRef,
} from "react-zoom-pan-pinch";
import { useShallow } from "zustand/react/shallow";
import { performSoftReset, getHmrVersion } from "@/systems/hmrCleanup";

import {
  useGameStore,
  selectAgents,
  selectBoss,
  selectTodos,
  selectDebugMode,
  selectEventLog,
  selectShowPaths,
  selectShowQueueSlots,
  selectShowPhaseLabels,
  selectShowObstacles,
  selectElevatorState,
  selectContextUtilization,
  selectIsCompacting,
  selectPrintReport,
} from "@/stores/gameStore";
import { useAnimationSystem } from "@/systems/animationSystem";
import { wireGameRuntime, unwireGameRuntime } from "@/systems/gameRuntime";
import { useCompactionAnimation } from "@/systems/compactionAnimation";
import { CrowdLayoutCache } from "@/systems/crowdLayout";
import { bubbleSize, stackBubbles, type Box } from "@/systems/bubbleLayout";
import { truncateBubbleText } from "@/utils/bubbleText";
import { nameTagWidth } from "./NameTag";
import { AgentLookCache } from "@/systems/agentLooks";
import { SceneSignalsCache, type PersonSignals } from "@/systems/sceneSignals";
import { useOfficeTextures } from "@/hooks/useOfficeTextures";
import { sceneLayout, type SceneLayout } from "@/utils/sceneLayout";
import { sceneToClient, useSceneView } from "@/stores/sceneViewStore";
import { isReducedMotion } from "@/systems/reducedMotion";
import { scenePalette } from "@/systems/scenePalette";
import { useTheme } from "@/systems/themeStore";
import {
  EMPLOYEE_OF_MONTH_POSITION,
  CITY_WINDOW_POSITION,
  SAFETY_SIGN_POSITION,
  WALL_CLOCK_POSITION,
  WALL_OUTLET_POSITION,
  WHITEBOARD_POSITION,
  WATER_COOLER_POSITION,
  COFFEE_MACHINE_POSITION,
  PRINTER_STATION_POSITION,
  PLANT_POSITION,
  BOSS_RUG_POSITION,
  TRASH_CAN_OFFSET,
  DESKS_PER_ROW,
  MIN_DESK_COUNT,
} from "@/constants/positions";
import {
  AgentSprite,
  AgentArms,
  AgentHeadset,
  AgentLabel,
  Bubble as AgentBubble,
} from "./AgentSprite";
import { BossSprite, BossBubble, MobileBoss } from "./BossSprite";
import { useNavigationStore } from "@/stores/navigationStore";
import { usePreferencesStore } from "@/stores/preferencesStore";
import { useAttentionStore } from "@/stores/attentionStore";
import { LOBBY_FLOOR_ID } from "@/types/navigation";
import { ELEVATOR_POSITION, isInElevatorZone } from "@/systems/queuePositions";
import { TrashCanSprite } from "./TrashCanSprite";
import { WallClock } from "./WallClock";
import { Whiteboard } from "./Whiteboard";
import { SafetySign } from "./SafetySign";
import { CityWindow } from "./CityWindow";
import { EmployeeOfTheMonth } from "./EmployeeOfTheMonth";
import { OfficeDecor } from "./OfficeDecor";
import { Elevator, isAgentInElevator } from "./Elevator";
import { PrinterStation } from "./PrinterStation";
import { DebugOverlays } from "./DebugOverlays";
import { DayNightLayer } from "./DayNightLayer";
import {
  DeskSurfacesBase,
  DeskSurfacesTop,
  useDeskPositions,
} from "./DeskGrid";
import { ZoomControls } from "./ZoomControls";
import { LoadingScreen } from "./LoadingScreen";
import { OfficeBackground, type RoomExtent } from "./OfficeBackground";
import { OfficeWings } from "./OfficeWings";
import { officeWings, wingLights } from "@/utils/officeWings";

// Register PixiJS components
extend({ Container, Text, Graphics, Sprite });

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface SubagentDotProps {
  x: number;
  y: number;
  color: string;
}

function SubagentDot({ x, y, color }: SubagentDotProps): ReactNode {
  const drawDot = useCallback(
    (g: Graphics) => {
      g.clear();
      g.circle(0, 0, 4);
      // Safe hex parsing with fallback
      const hex = /^#[0-9a-fA-F]{6}$/.test(color)
        ? parseInt(color.slice(1), 16)
        : 0xf59e0b;
      g.fill({ color: hex });
      g.circle(0, 0, 4);
      g.stroke({ color: 0xffffff, alpha: 0.4, width: 1 });
    },
    [color],
  );

  return <pixiGraphics draw={drawDot} x={x} y={y} />;
}

function FloorSign({
  label,
  accent,
}: {
  label: string;
  accent: string;
}): ReactNode {
  const w = 120;
  const h = 24;
  const drawSign = useCallback(
    (g: Graphics) => {
      g.clear();
      // Backing plate
      g.roundRect(-w / 2, -h / 2, w, h, 4);
      g.fill({ color: 0x1e1e1e, alpha: 0.9 });
      // Border
      g.roundRect(-w / 2, -h / 2, w, h, 4);
      const hex = /^#[0-9a-fA-F]{6}$/.test(accent)
        ? parseInt(accent.slice(1), 16)
        : 0x6366f1;
      g.stroke({ color: hex, width: 1.5, alpha: 0.7 });
    },
    [accent],
  );

  return (
    <pixiContainer x={ELEVATOR_POSITION.x} y={ELEVATOR_POSITION.y - 88}>
      <pixiGraphics draw={drawSign} />
      <pixiContainer scale={0.5}>
        <pixiText
          text={label}
          anchor={0.5}
          style={{
            fontSize: 18,
            fill: "#ffffff",
            fontFamily: "monospace",
            fontWeight: "bold",
          }}
        />
      </pixiContainer>
    </pixiContainer>
  );
}

// Qodirjon: mipmaps keep sprites smooth when they are drawn smaller than
// their source image (posters, clock, whiteboard icons).
TextureSource.defaultOptions.autoGenerateMipmaps = true;

// Qodirjon: draw agents and the boss as LPC pixel-art office workers.
const USE_PEOPLE = true;

/**
 * Render the canvas at exactly the size it is shown on screen (times the
 * device pixel ratio and the current zoom), instead of rendering 1280x1024
 * and letting the browser shrink it. Text and vector shapes then rasterize
 * at their final size and stay sharp.
 */
function computeRenderResolution(
  container: HTMLElement | null,
  zoom: number,
  layout: SceneLayout,
): number {
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  if (!container) return dpr;
  const fit = Math.min(
    container.clientWidth / layout.width,
    container.clientHeight / layout.height,
  );
  if (!Number.isFinite(fit) || fit <= 0) return dpr;
  const target = dpr * fit * Math.max(1, zoom);
  return Math.min(Math.max(target, 0.5), dpr * 3);
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/** The whole canvas in room coordinates (the room is 0..1280 x 0..1024). */
function roomExtent(layout: SceneLayout): RoomExtent {
  return {
    left: -layout.offsetX,
    top: -layout.offsetY,
    right: layout.width - layout.offsetX,
    bottom: layout.height - layout.offsetY,
  };
}

/** Put the room at its place on the (wider or taller) canvas. */
function placeRoom(app: PixiApplication | null, layout: SceneLayout): void {
  app?.stage?.position.set(layout.offsetX, layout.offsetY);
}

/** Repaint the canvas behind the scene (a theme switch). */
function paintStage(app: PixiApplication | null, color: number): void {
  if (app?.renderer) app.renderer.background.color = color;
}

export function OfficeGame(): ReactNode {
  // Track PixiJS app for cleanup
  const appRef = useRef<PixiApplication | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef<ReactZoomPanPinchRef>(null);
  const zoomRef = useRef(1);
  const zoomTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The canvas takes the stage's shape; the room sits centred inside it.
  const layout = useSceneView((s) => s.layout);
  // The office grows with the stage: zones around the room (utils/officeWings.ts)
  const extent = useMemo(() => roomExtent(layout), [layout]);
  const wings = useMemo(() => officeWings(extent), [extent]);
  const wingPools = useMemo(() => wingLights(wings), [wings]);
  useEffect(() => {
    placeRoom(appRef.current, layout);
  }, [layout]);

  // Keep the renderer size and resolution matched to the on-screen size.
  const syncResolution = useCallback(() => {
    const app = appRef.current;
    if (!app?.renderer) return;
    const { layout: now } = useSceneView.getState();
    const next = computeRenderResolution(
      containerRef.current,
      zoomRef.current,
      now,
    );
    const current = app.renderer.resolution;
    const sized =
      app.renderer.width === now.width && app.renderer.height === now.height;
    if (sized && Math.abs(next - current) / current < 0.05) return;
    app.renderer.resolution = next;
    app.renderer.resize(now.width, now.height);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(syncResolution);
    });
    observer.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [syncResolution]);

  // The canvas behind the scene follows the theme without a reload.
  const stageColor = scenePalette(useTheme()).stage;
  useEffect(() => {
    paintStage(appRef.current, stageColor);
  }, [stageColor]);

  // HMR version for forcing remount
  const hmrVersion = getHmrVersion();

  // Load all office textures
  const { textures, loaded: spritesLoaded } = useOfficeTextures();

  // Start animation system
  useAnimationSystem();

  // Wire the animation tick's listener to the agent-machine service (ARC-017).
  // Lives here rather than in useAnimationSystem so animationSystem never
  // imports agentMachineService at runtime (breaks the machines↔systems cycle).
  useEffect(() => {
    wireGameRuntime();
    return () => unwireGameRuntime();
  }, []);

  // Cleanup on unmount (HMR or navigation)
  useEffect(() => {
    return () => {
      // @pixi/react Application handles Pixi app destruction.
      // Only reset game systems to avoid double-destroy of the WebGL context.
      appRef.current = null;
      performSoftReset();
    };
  }, []);

  // Subscribe to store state
  const agents = useGameStore(useShallow(selectAgents));
  const boss = useGameStore(selectBoss);
  const todos = useGameStore(selectTodos);
  const debugMode = useGameStore(selectDebugMode);
  const showPaths = useGameStore(selectShowPaths);
  const showQueueSlots = useGameStore(selectShowQueueSlots);
  const showPhaseLabels = useGameStore(selectShowPhaseLabels);
  const showObstacles = useGameStore(selectShowObstacles);
  const elevatorState = useGameStore(selectElevatorState);
  const contextUtilization = useGameStore(selectContextUtilization);
  const isCompacting = useGameStore(selectIsCompacting);
  const printReport = useGameStore(selectPrintReport);

  // Floor info for elevator label
  const floorId = useNavigationStore((s) => s.floorId);
  const buildingConfig = useNavigationStore((s) => s.buildingConfig);
  const floor = useMemo(() => {
    if (floorId === LOBBY_FLOOR_ID) {
      return { name: "Lobby", icon: "\u{1F6AA}", accent: "#94a3b8" };
    }
    return buildingConfig?.floors.find((f) => f.id === floorId) ?? null;
  }, [floorId, buildingConfig]);

  // Compaction animation state
  const compactionAnimation = useCompactionAnimation();

  // Use store's elevator state (controlled by state machine)
  const isElevatorOpen = elevatorState === "open";

  // Calculate occupied desks
  const occupiedDesks = useMemo(() => {
    const desks = new Set<number>();
    for (const agent of agents.values()) {
      if (agent.desk && agent.phase === "idle") {
        desks.add(agent.desk);
      }
    }
    return desks;
  }, [agents]);

  // Calculate desk tasks for marquee display
  const deskTasks = useMemo(() => {
    const tasks = new Map<number, string>();
    for (const agent of agents.values()) {
      if (agent.desk && agent.phase === "idle") {
        const label = agent.currentTask || agent.name || "";
        if (label) tasks.set(agent.desk, label);
      }
    }
    return tasks;
  }, [agents]);

  // Desk count
  const deskCount = useMemo(() => {
    return Math.max(
      MIN_DESK_COUNT,
      Math.ceil(agents.size / DESKS_PER_ROW) * DESKS_PER_ROW,
    );
  }, [agents.size]);

  // Desk positions for Y-sorted rendering
  const deskPositions = useDeskPositions(deskCount, occupiedDesks);

  // A tap on an occupied desk opens the card of the agent sitting there.
  const clickToFocusEnabled = usePreferencesStore((s) => s.clickToFocusEnabled);
  const openFocusPopup = useAttentionStore((s) => s.openFocusPopup);
  const handleDeskTap = useCallback(
    (desk: number, x: number, y: number) => {
      const agent = [...agents.values()].find(
        (a) => a.desk === desk && a.phase === "idle",
      );
      const at = agent ? sceneToClient(x, y) : null;
      if (agent && at) openFocusPopup(agent.id, at.x, at.y);
    },
    [agents, openFocusPopup],
  );

  // Render-only nudges so people never stand inside each other, and name
  // tag lifts so tags never overlap (systems/crowdLayout.ts)
  // Per-person activity, failures and current tool (systems/sceneSignals.ts)
  const eventLog = useGameStore(selectEventLog);
  // Cached: a person's object stays the same until their signals change,
  // so memoized sprites of everybody else skip re-rendering
  const [signalsCache] = useState(() => new SceneSignalsCache());
  const signals = useMemo(
    () => signalsCache.compute(eventLog),
    [eventLog, signalsCache],
  );
  const officeSignals = signals.get("*");
  const ownBossSignals = signals.get("boss");
  const bossSignals = useMemo<PersonSignals | undefined>(() => {
    const own = ownBossSignals;
    const office = officeSignals;
    if (!own && !office) return undefined;
    // The boss dozes off only when the whole office has been quiet
    return {
      lastEventAt: office?.lastEventAt ?? null,
      lastErrorAt: own?.lastErrorAt ?? null,
      tool: own?.tool ?? "other",
      failing: own?.failing ?? false,
    };
  }, [officeSignals, ownBossSignals]);

  // Desks whose worker is running a shell command (monitor glow)
  const terminalDesks = useMemo(() => {
    const desks = new Set<number>();
    for (const agent of agents.values()) {
      if (
        agent.desk &&
        agent.phase === "idle" &&
        agent.isTyping &&
        signals.get(agent.id)?.tool === "terminal"
      ) {
        desks.add(agent.desk);
      }
    }
    return desks;
  }, [agents, signals]);

  // Character look per agent by role (systems/agentLooks.ts)
  const [lookCache] = useState(() => new AgentLookCache());
  const agentLooks = useMemo(
    () => lookCache.compute(Array.from(agents.values())),
    [agents, lookCache],
  );

  const [crowdCache] = useState(() => new CrowdLayoutCache());
  const { crowdOffsets, labelPositions } = useMemo(
    () => crowdCache.compute(agents),
    [agents, crowdCache],
  );

  // Bubbles stack instead of covering each other and the name tags
  const bubbleLifts = useMemo(() => {
    const boxes: Array<Box & { id: string }> = [];
    const at = (id: string, x: number, y: number, text: string) => {
      const size = bubbleSize(truncateBubbleText(text));
      // SceneBubble draws at (x + 45, y - 80), growing up, badge top-left
      boxes.push({
        id,
        x: x + 45 - size.w / 2 - 22,
        y: y - 80 - size.h - 10,
        w: size.w + 22,
        h: size.h + 10,
      });
    };
    if (boss.bubble.content) {
      at("boss", boss.position.x, boss.position.y, boss.bubble.content.text);
    }
    const tags: Box[] = [
      { x: boss.position.x - 30, y: boss.position.y - 71, w: 60, h: 22 },
    ];
    for (const agent of agents.values()) {
      if (isInElevatorZone(agent.currentPosition)) continue;
      const pos = labelPositions.get(agent.id) ?? agent.currentPosition;
      if (agent.name) {
        const w = nameTagWidth(agent.name);
        tags.push({ x: pos.x - w / 2, y: pos.y - 83, w, h: 22 });
      }
      if (agent.bubble.content) {
        const x =
          agent.currentPosition.x + (crowdOffsets.get(agent.id)?.x ?? 0);
        at(agent.id, x, agent.currentPosition.y, agent.bubble.content.text);
      }
    }
    return stackBubbles(boxes, tags);
  }, [
    agents,
    boss.bubble.content,
    boss.position,
    labelPositions,
    crowdOffsets,
  ]);

  // Keyboard shortcuts for debug
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.querySelector("[role='dialog'][aria-modal='true']")) return;
      if (e.key === "d" || e.key === "D") {
        useGameStore.getState().setDebugMode(!debugMode);
      }
      if (debugMode) {
        if (e.key === "p" || e.key === "P") {
          useGameStore.getState().toggleDebugOverlay("paths");
        }
        if (e.key === "q" || e.key === "Q") {
          useGameStore.getState().toggleDebugOverlay("queueSlots");
        }
        if (e.key === "l" || e.key === "L") {
          useGameStore.getState().toggleDebugOverlay("phaseLabels");
        }
        if (e.key === "o" || e.key === "O") {
          useGameStore.getState().toggleDebugOverlay("obstacles");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [debugMode]);

  // Reset pan/zoom only on actual window resize — NOT on container reflows.
  // ResizeObserver was causing progressive canvas drift because the event log
  // and sidebar content changes triggered micro-resizes on every update.
  // Auto-fit: the canvas takes the panel's shape (the room whole and
  // centred, the extended room around it), so the fit is zoom 1 at the
  // origin. On load, resize, rotation and side panels moving; a manual zoom
  // is eased back (no easing with reduced motion).
  const fitScaleRef = useRef(1);
  const applyAutoFit = useCallback(() => {
    const el = containerRef.current;
    const ref = transformRef.current;
    if (!el || !ref) return;
    useSceneView
      .getState()
      .setLayout(sceneLayout(el.clientWidth, el.clientHeight));
    syncResolution();
    const { positionX, positionY, scale } = ref.state;
    if (positionX === 0 && positionY === 0 && scale === 1) return;
    ref.setTransform(0, 0, 1, isReducedMotion() ? 0 : 220, "easeOut");
  }, [syncResolution]);
  useEffect(() => {
    window.addEventListener("resize", applyAutoFit);
    // Also when the panel itself changes size (sidebars, a container that
    // had no size yet at load). Ignore sub-pixel reflows: they used to make
    // the canvas drift.
    const el = containerRef.current;
    let last = { w: el?.clientWidth ?? 0, h: el?.clientHeight ?? 0 };
    let frame = 0;
    const observer = new ResizeObserver(() => {
      const w = el?.clientWidth ?? 0;
      const h = el?.clientHeight ?? 0;
      if (Math.abs(w - last.w) < 2 && Math.abs(h - last.h) < 2) return;
      last = { w, h };
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(applyAutoFit);
    });
    if (el) observer.observe(el);
    return () => {
      window.removeEventListener("resize", applyAutoFit);
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [applyAutoFit]);
  useEffect(() => {
    if (spritesLoaded) requestAnimationFrame(applyAutoFit);
  }, [spritesLoaded, applyAutoFit]);

  return (
    <div ref={containerRef} className="w-full h-full overflow-hidden relative">
      <TransformWrapper
        ref={transformRef}
        initialScale={1}
        minScale={1}
        maxScale={3}
        centerZoomedOut={false}
        limitToBounds={false}
        wheel={{ step: 0.1 }}
        pinch={{ step: 5 }}
        doubleClick={{ mode: "reset" }}
        onTransform={(ref, state) => {
          if (state.scale !== zoomRef.current) {
            zoomRef.current = state.scale;
            if (zoomTimerRef.current) clearTimeout(zoomTimerRef.current);
            zoomTimerRef.current = setTimeout(syncResolution, 150);
          }
          // Zooming out below the fit (or "1:1") snaps back to the fit
          if (state.scale < fitScaleRef.current - 0.01) {
            applyAutoFit();
          }
        }}
      >
        <ZoomControls />
        <TransformComponent
          wrapperClass="w-full h-full"
          contentClass="w-full h-full"
        >
          <div className="pixi-canvas-container w-full h-full">
            <Application
              key={`pixi-app-${hmrVersion}`}
              width={layout.width}
              height={layout.height}
              backgroundColor={stageColor}
              autoDensity={true}
              resolution={
                typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1
              }
              onInit={(app) => {
                appRef.current = app;
                placeRoom(app, useSceneView.getState().layout);
                syncResolution();
              }}
            >
              {/* Loading screen - shown while sprites are loading */}
              {!spritesLoaded && <LoadingScreen />}

              {/* Office content - hidden while loading */}
              {spritesLoaded && (
                <>
                  {/* Floor and walls, extended to the canvas edges */}
                  <OfficeBackground
                    floorTileTexture={textures.floorTile}
                    extent={extent}
                  />

                  {/* Kitchen, lounge, library... on the extra canvas */}
                  <OfficeWings items={wings} plantTexture={textures.plant} />

                  {/* Boss area rug - rendered right after floor */}
                  {textures.bossRug && (
                    <pixiSprite
                      texture={textures.bossRug}
                      anchor={0.5}
                      x={BOSS_RUG_POSITION.x}
                      y={BOSS_RUG_POSITION.y}
                      scale={0.3}
                    />
                  )}

                  {/* Modern decor: neon sign and plants */}
                  <OfficeDecor plantTexture={textures.plant} />

                  {/* Wall decorations */}
                  <pixiContainer
                    x={EMPLOYEE_OF_MONTH_POSITION.x}
                    y={EMPLOYEE_OF_MONTH_POSITION.y}
                  >
                    <EmployeeOfTheMonth />
                  </pixiContainer>
                  <pixiContainer
                    x={CITY_WINDOW_POSITION.x}
                    y={CITY_WINDOW_POSITION.y}
                  >
                    <CityWindow />
                  </pixiContainer>
                  <pixiContainer
                    x={SAFETY_SIGN_POSITION.x}
                    y={SAFETY_SIGN_POSITION.y}
                  >
                    <SafetySign />
                  </pixiContainer>
                  <pixiContainer
                    x={WALL_CLOCK_POSITION.x}
                    y={WALL_CLOCK_POSITION.y}
                  >
                    <WallClock />
                  </pixiContainer>
                  {/* Wall outlet below clock */}
                  {textures.wallOutlet && (
                    <pixiSprite
                      texture={textures.wallOutlet}
                      anchor={0.5}
                      x={WALL_OUTLET_POSITION.x}
                      y={WALL_OUTLET_POSITION.y}
                      scale={0.04}
                    />
                  )}
                  <pixiContainer
                    x={WHITEBOARD_POSITION.x}
                    y={WHITEBOARD_POSITION.y}
                  >
                    <Whiteboard todos={todos} />
                  </pixiContainer>
                  {textures.waterCooler && (
                    <pixiSprite
                      texture={textures.waterCooler}
                      anchor={0.5}
                      x={WATER_COOLER_POSITION.x}
                      y={WATER_COOLER_POSITION.y}
                      scale={0.198}
                    />
                  )}
                  {/* Coffee machine - to the right of water cooler */}
                  {textures.coffeeMachine && (
                    <pixiSprite
                      texture={textures.coffeeMachine}
                      anchor={0.5}
                      x={COFFEE_MACHINE_POSITION.x}
                      y={COFFEE_MACHINE_POSITION.y}
                      scale={0.1}
                    />
                  )}

                  {/* Printer station - bottom left corner */}
                  {/* Only print after boss delivers the completion message */}
                  <PrinterStation
                    x={PRINTER_STATION_POSITION.x}
                    y={PRINTER_STATION_POSITION.y}
                    isPrinting={
                      printReport && !isCompacting && !!boss.bubble.content
                    }
                    deskTexture={textures.desk}
                    printerTexture={textures.printer}
                  />

                  {/* Plant - to the right of printer */}
                  {textures.plant && (
                    <pixiSprite
                      texture={textures.plant}
                      anchor={0.5}
                      x={PLANT_POSITION.x}
                      y={PLANT_POSITION.y}
                      scale={0.1}
                    />
                  )}

                  {/* Elevator with animated doors and agents inside */}
                  <Elevator
                    isOpen={isElevatorOpen}
                    agents={agents}
                    looks={agentLooks}
                    frameTexture={textures.elevatorFrame}
                    doorTexture={textures.elevatorDoor}
                    headsetTexture={textures.headset}
                    sunglassesTexture={textures.sunglasses}
                  />

                  {/* Floor sign above elevator */}
                  {floor && (
                    <FloorSign
                      label={`${floor.icon} ${floor.name}`}
                      accent={floor.accent}
                    />
                  )}

                  {/* Y-sorted layer: chairs and agents sorted by Y position (higher Y = in front) */}
                  <pixiContainer sortableChildren={true}>
                    {/* Desk chairs - zIndex based on chair seat back */}
                    {deskPositions.map((desk, i) => {
                      const chairZIndex = desk.y + 20;
                      return (
                        <pixiContainer
                          key={`chair-${i}`}
                          x={desk.x}
                          y={desk.y}
                          zIndex={chairZIndex}
                        >
                          {textures.chair && (
                            <pixiSprite
                              texture={textures.chair}
                              anchor={0.5}
                              x={0}
                              y={30}
                              scale={0.1386}
                            />
                          )}
                        </pixiContainer>
                      );
                    })}

                    {/* Agents outside elevator - zIndex based on feet Y position */}
                    {Array.from(agents.values())
                      .filter(
                        (agent) =>
                          !isAgentInElevator(
                            agent.currentPosition.x,
                            agent.currentPosition.y,
                          ),
                      )
                      .map((agent) => (
                        <pixiContainer
                          key={agent.id}
                          zIndex={
                            agent.currentPosition.y +
                            (crowdOffsets.get(agent.id)?.y ?? 0)
                          }
                        >
                          <AgentSprite
                            id={agent.id}
                            name={agent.name}
                            color={agent.color}
                            number={agent.number}
                            position={agent.currentPosition}
                            phase={agent.phase}
                            bubble={agent.bubble.content}
                            headsetTexture={textures.headset}
                            sunglassesTexture={textures.sunglasses}
                            renderBubble={false}
                            renderLabel={false}
                            isTyping={agent.isTyping}
                            desk={agent.desk}
                            backendState={agent.backendState}
                            sheet={agentLooks.get(agent.id)}
                            signals={signals.get(agent.id)}
                            offset={crowdOffsets.get(agent.id)}
                          />
                        </pixiContainer>
                      ))}
                  </pixiContainer>

                  {/* Desk surfaces and keyboards (behind agent arms) */}
                  <DeskSurfacesBase
                    deskCount={deskCount}
                    occupiedDesks={occupiedDesks}
                    deskTexture={textures.desk}
                    keyboardTexture={textures.keyboard}
                  />

                  {/* Agent arms - rendered after desk/keyboard, before headsets */}
                  {/* LPC workers have their own arms, so the capsule arms are off */}
                  {Array.from(agents.values())
                    .filter((agent) => agent.phase === "idle" && !USE_PEOPLE)
                    .map((agent) => (
                      <AgentArms
                        key={`arms-${agent.id}`}
                        position={agent.currentPosition}
                        isTyping={agent.isTyping}
                      />
                    ))}

                  {/* Agent headsets - rendered after arms so they appear on top */}
                  {textures.headset &&
                    !USE_PEOPLE &&
                    Array.from(agents.values())
                      .filter((agent) => agent.phase === "idle")
                      .map((agent) => (
                        <AgentHeadset
                          key={`headset-${agent.id}`}
                          position={agent.currentPosition}
                          headsetTexture={textures.headset!}
                        />
                      ))}

                  {/* Monitors and decorations (in front of agent arms) */}
                  <DeskSurfacesTop
                    deskCount={deskCount}
                    occupiedDesks={occupiedDesks}
                    deskTasks={deskTasks}
                    terminalDesks={terminalDesks}
                    monitorTexture={textures.monitor}
                    coffeeMugTexture={textures.coffeeMug}
                    staplerTexture={textures.stapler}
                    deskLampTexture={textures.deskLamp}
                    penHolderTexture={textures.penHolder}
                    magic8BallTexture={textures.magic8Ball}
                    rubiksCubeTexture={textures.rubiksCube}
                    rubberDuckTexture={textures.rubberDuck}
                    thermosTexture={textures.thermos}
                    onDeskTap={clickToFocusEnabled ? handleDeskTap : undefined}
                  />

                  {/* Boss */}
                  <BossSprite
                    position={boss.position}
                    state={boss.backendState}
                    bubble={boss.bubble.content}
                    inUseBy={boss.inUseBy}
                    currentTask={boss.currentTask}
                    chairTexture={textures.chair}
                    deskTexture={textures.desk}
                    keyboardTexture={textures.keyboard}
                    monitorTexture={textures.monitor}
                    phoneTexture={textures.phone}
                    headsetTexture={textures.headset}
                    sunglassesTexture={textures.sunglasses}
                    renderBubble={false}
                    isTyping={boss.isTyping}
                    progress={boss.progress}
                    signals={bossSignals}
                    isAway={compactionAnimation.phase !== "idle"}
                  />

                  {/* Mobile Boss (when walking to/from trash can) */}
                  {compactionAnimation.bossPosition && (
                    <MobileBoss
                      position={compactionAnimation.bossPosition}
                      jumpOffset={compactionAnimation.jumpOffset}
                      scale={compactionAnimation.bossScale}
                      sunglassesTexture={textures.sunglasses}
                      headsetTexture={textures.headset}
                    />
                  )}

                  {/* Trash Can (Context Utilization Indicator) - right of boss desk */}
                  <TrashCanSprite
                    x={boss.position.x + TRASH_CAN_OFFSET.x}
                    y={boss.position.y + TRASH_CAN_OFFSET.y}
                    contextUtilization={
                      compactionAnimation.phase !== "idle"
                        ? compactionAnimation.animatedContextUtilization
                        : contextUtilization
                    }
                    isCompacting={isCompacting}
                    isStomping={compactionAnimation.isStomping}
                  />

                  {/* Day / night grading (labels and bubbles stay untinted) */}
                  <DayNightLayer extent={extent} extraPools={wingPools} />

                  {/* Debug overlays */}
                  {debugMode && (
                    <DebugOverlays
                      showPaths={showPaths}
                      showQueueSlots={showQueueSlots}
                      showPhaseLabels={showPhaseLabels}
                      showObstacles={showObstacles}
                    />
                  )}

                  {/* Debug mode indicator */}
                  {debugMode && (
                    <pixiText
                      text="DEBUG MODE (D=toggle, P=paths, Q=queue, L=labels, O=obstacles, T=time)"
                      x={10}
                      y={10}
                      style={{
                        fontSize: 12,
                        fill: 0x00ff00,
                        fontFamily: "monospace",
                      }}
                    />
                  )}

                  {/* Labels Layer - rendered on top of most things */}
                  {Array.from(agents.values())
                    .filter(
                      (agent) =>
                        agent.name && !isInElevatorZone(agent.currentPosition),
                    )
                    .map((agent) => (
                      <AgentLabel
                        key={`label-${agent.id}`}
                        name={agent.name!}
                        position={
                          labelPositions.get(agent.id) ?? agent.currentPosition
                        }
                        color={agent.color}
                        progress={agent.progress}
                        failing={signals.get(agent.id)?.failing ?? false}
                      />
                    ))}

                  {/* Character Type Overlays - crown/badge/dot per agent type */}
                  {Array.from(agents.values())
                    .filter(
                      (agent) =>
                        agent.characterType &&
                        !isInElevatorZone(agent.currentPosition),
                    )
                    .map((agent) => (
                      <pixiContainer
                        key={`chartype-${agent.id}`}
                        zIndex={agent.currentPosition.y + 20}
                      >
                        {/* Lead crown overlay */}
                        {agent.characterType === "lead" && (
                          <pixiText
                            text="👑"
                            style={{ fontSize: 14 }}
                            x={agent.currentPosition.x - 8}
                            y={agent.currentPosition.y - 52}
                          />
                        )}

                        {/* Teammate badge + nameplate overlay */}
                        {agent.characterType === "teammate" && (
                          <>
                            <pixiText
                              text="🎖️"
                              style={{ fontSize: 10 }}
                              x={agent.currentPosition.x - 6}
                              y={agent.currentPosition.y - 46}
                            />
                            {agent.name && (
                              <pixiText
                                text={agent.name}
                                style={{
                                  fontSize: 7,
                                  fill: agent.color ?? "#3b82f6",
                                  fontFamily: "monospace",
                                  fontWeight: "bold",
                                }}
                                x={agent.currentPosition.x - 18}
                                y={agent.currentPosition.y - 34}
                              />
                            )}
                          </>
                        )}

                        {/* Subagent shoulder dot */}
                        {agent.characterType === "subagent" &&
                          (() => {
                            const parentAgent = agent.parentId
                              ? Array.from(agents.values()).find(
                                  (a) => a.id === agent.parentId,
                                )
                              : null;
                            const dotColor = parentAgent?.color ?? "#f59e0b";
                            return (
                              <SubagentDot
                                key={`dot-${agent.id}`}
                                x={agent.currentPosition.x + 10}
                                y={agent.currentPosition.y - 28}
                                color={dotColor}
                              />
                            );
                          })()}
                      </pixiContainer>
                    ))}

                  {/* Bubbles Layer - rendered on top of everything */}
                  {Array.from(agents.values())
                    .filter(
                      (agent) =>
                        agent.bubble.content &&
                        !isInElevatorZone(agent.currentPosition),
                    )
                    .map((agent) => (
                      <pixiContainer
                        key={`bubble-${agent.id}`}
                        x={
                          agent.currentPosition.x +
                          (crowdOffsets.get(agent.id)?.x ?? 0)
                        }
                        y={agent.currentPosition.y}
                      >
                        <AgentBubble
                          content={agent.bubble.content!}
                          yOffset={-80 + (bubbleLifts.get(agent.id) ?? 0)}
                        />
                      </pixiContainer>
                    ))}
                  {boss.bubble.content && (
                    <pixiContainer x={boss.position.x} y={boss.position.y}>
                      <BossBubble
                        content={boss.bubble.content}
                        yOffset={-80 + (bubbleLifts.get("boss") ?? 0)}
                      />
                    </pixiContainer>
                  )}
                </>
              )}
            </Application>
          </div>
        </TransformComponent>
      </TransformWrapper>
    </div>
  );
}
