"use client";

/**
 * Whiteboard - Office whiteboard display with multiple modes.
 *
 * Click anywhere on the whiteboard to cycle through 12 display modes.
 * Keyboard shortcuts: 0-9 jump to that mode, T = Todo, B = Background Tasks, K = Kanban
 *
 * 0: Todo List (default)
 * 1: Remote Workers (background task status)
 * 2: Tool Pizza (pie chart of tool usage)
 * 3: Org Chart (boss + agents hierarchy)
 * 4: Stonks (fake stock tickers)
 * 5: Weather (success rate indicator)
 * 6: Safety Board (days since incident)
 * 7: Timeline (agent lifespans)
 * 8: News Ticker (scrolling headlines)
 * 9: Coffee (coffee cup tracker)
 * 10: Heat Map (file edit frequency) - click to reach from mode 9
 * 11: Kanban Board (task tracking with TODO/IN PROGRESS/DONE columns)
 */

import { Graphics } from "pixi.js";
import { useCallback, useEffect, useMemo, type ReactNode } from "react";
import type { TodoItem, WhiteboardMode, Agent } from "@/types";
import { useGameStore } from "@/stores/gameStore";
import { TodoListMode } from "./whiteboard/TodoListMode";
import { RemoteWorkersMode } from "./whiteboard/RemoteWorkersMode";
import { ToolPizzaMode } from "./whiteboard/ToolPizzaMode";
import { OrgChartMode } from "./whiteboard/OrgChartMode";
import { StonksMode } from "./whiteboard/StonksMode";
import { WeatherMode } from "./whiteboard/WeatherMode";
import { SafetyBoardMode } from "./whiteboard/SafetyBoardMode";
import { TimelineMode } from "./whiteboard/TimelineMode";
import { NewsTickerMode } from "./whiteboard/NewsTickerMode";
import { CoffeeMode } from "./whiteboard/CoffeeMode";
import { HeatMapMode } from "./whiteboard/HeatMapMode";
import { KanbanMode } from "./whiteboard/KanbanMode";
import { MODE_INFO } from "./whiteboard/WhiteboardModeRegistry";
import { scenePalette } from "@/systems/scenePalette";
import { useTheme } from "@/systems/themeStore";

// ============================================================================
// WHITEBOARD FRAME
// ============================================================================

interface WhiteboardFrameProps {
  children: ReactNode;
  onPointerDown: () => void;
  mode: WhiteboardMode;
}

/** Marker colors drawn in the whiteboard tray (Olymp danger, accent, info). */
const MARKER_COLORS = [0xff7a70, 0x4f8a1f, 0x74c7f5];
/** The board's white surface (slightly warm, not pure white). */
const BOARD = 0xfbfcf8;

function WhiteboardFrame({
  children,
  onPointerDown,
  mode,
}: WhiteboardFrameProps): ReactNode {
  const palette = scenePalette(useTheme());
  const drawWhiteboard = useCallback(
    (g: Graphics) => {
      g.clear();
      const m = palette.materials;

      // Board shadow on the wall, down-right
      g.roundRect(3, 4, 330, 205, 6);
      g.fill(palette.shadow);

      // Aluminium frame with the shared outline and a lit top-left edge
      g.roundRect(0, 0, 330, 205, 6);
      g.fill(m.outline);
      g.roundRect(1, 1, 328, 203, 5);
      g.fill(m.metal);
      g.rect(4, 1, 322, 1);
      g.rect(1, 4, 1, 197);
      g.fill({ color: 0xffffff, alpha: 0.35 });

      // Board surface, set back a pixel
      g.rect(5, 5, 320, 195);
      g.fill(BOARD);
      g.rect(5, 5, 320, 1);
      g.fill({ color: 0x000000, alpha: 0.12 });
      // A faint wiped streak
      g.poly([220, 150, 300, 60, 312, 60, 232, 150]);
      g.fill({ color: 0x000000, alpha: 0.025 });

      // Header bar: Olymp dark green with a lime underline
      g.roundRect(10, 10, 310, 24, 3);
      g.fill(palette.boardHeader);
      g.rect(10, 33, 310, 1);
      g.fill(palette.boardAccent);

      // Marker tray
      g.rect(112, 202, 106, 7);
      g.fill(m.outline);
      g.rect(113, 203, 104, 5);
      g.fill(m.metal);

      // Markers lying in the tray
      MARKER_COLORS.forEach((color, i) => {
        g.roundRect(124 + i * 26, 198, 20, 6, 2);
        g.fill(m.outline);
        g.roundRect(125 + i * 26, 199, 14, 4, 1);
        g.fill(color);
        g.rect(139 + i * 26, 199, 4, 4);
        g.fill(m.paper);
      });
    },
    [palette],
  );

  const modeInfo = MODE_INFO[mode];

  return (
    <pixiContainer eventMode="static" onPointerDown={onPointerDown}>
      <pixiGraphics draw={drawWhiteboard} />

      {/* Header - rendered at 2x for sharpness */}
      <pixiContainer x={165} y={22} scale={0.5}>
        <pixiText
          text={`${modeInfo.icon} ${modeInfo.name}`}
          anchor={0.5}
          style={{
            fontFamily: '"DejaVu Sans", Verdana, Arial, sans-serif',
            fontSize: 22,
            fontWeight: "bold",
            letterSpacing: 1,
            fill: "#f2f6f2",
          }}
        />
      </pixiContainer>

      {/* Mode indicator dots */}
      <pixiContainer x={165} y={193}>
        {Array.from({ length: 12 }).map((_, i) => (
          <pixiGraphics
            key={i}
            x={(i - 5.5) * 10}
            draw={(g: Graphics) => {
              g.clear();
              g.circle(0, 0, i === mode ? 3.5 : 2);
              g.fill(i === mode ? palette.accentInk : 0xc5cdbc);
            }}
          />
        ))}
      </pixiContainer>

      {/* Content area */}
      <pixiContainer y={38}>{children}</pixiContainer>
    </pixiContainer>
  );
}

// ============================================================================
// MAIN WHITEBOARD COMPONENT
// ============================================================================

export interface WhiteboardProps {
  todos: TodoItem[];
}

export function Whiteboard({ todos }: WhiteboardProps): ReactNode {
  const whiteboardData = useGameStore((s) => s.whiteboardData);
  const whiteboardMode = useGameStore((s) => s.whiteboardMode);
  const cycleMode = useGameStore((s) => s.cycleWhiteboardMode);
  const setMode = useGameStore((s) => s.setWhiteboardMode);
  const agentsMap = useGameStore((s) => s.agents);
  const bossTask = useGameStore((s) => s.boss.currentTask);

  // Keyboard hotkeys: T = Todo List (0), B = Background Tasks (1), 0-9 = modes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input field
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const key = e.key.toLowerCase();

      // Number keys 0-9 set mode directly
      if (key >= "0" && key <= "9") {
        setMode(parseInt(key, 10) as WhiteboardMode);
        return;
      }

      // Letter hotkeys
      switch (key) {
        case "t":
          setMode(0);
          break;
        case "b":
          setMode(1);
          break;
        case "k":
          setMode(11);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setMode]);

  // Convert agent animation state to basic Agent interface for OrgChart
  const agentList: Agent[] = useMemo(
    () =>
      Array.from(agentsMap.values()).map((a) => ({
        id: a.id,
        name: a.name ?? undefined,
        color: a.color,
        number: a.number,
        state: a.backendState,
        desk: a.desk ?? undefined,
        currentTask: a.currentTask ?? undefined,
        position: a.currentPosition,
      })),
    [agentsMap],
  );

  const handleClick = useCallback(() => {
    cycleMode();
  }, [cycleMode]);

  // Render the appropriate mode component
  const renderMode = (): ReactNode => {
    switch (whiteboardMode) {
      case 0:
        return <TodoListMode todos={todos} />;
      case 1:
        return <RemoteWorkersMode data={whiteboardData} />;
      case 2:
        return <ToolPizzaMode toolUsage={whiteboardData.toolUsage ?? {}} />;
      case 3:
        return <OrgChartMode agents={agentList} bossTask={bossTask} />;
      case 4:
        return <StonksMode data={whiteboardData} />;
      case 5:
        return <WeatherMode data={whiteboardData} />;
      case 6:
        return <SafetyBoardMode data={whiteboardData} />;
      case 7:
        return <TimelineMode data={whiteboardData} />;
      case 8:
        return <NewsTickerMode data={whiteboardData} />;
      case 9:
        return <CoffeeMode data={whiteboardData} />;
      case 10:
        return <HeatMapMode data={whiteboardData} />;
      case 11:
        return <KanbanMode data={whiteboardData} />;
      default:
        return <TodoListMode todos={todos} />;
    }
  };

  return (
    <WhiteboardFrame onPointerDown={handleClick} mode={whiteboardMode}>
      {renderMode()}
    </WhiteboardFrame>
  );
}
