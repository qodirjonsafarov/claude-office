"use client";

import { useState } from "react";
import { AgentStatus } from "@/components/game/AgentStatus";
import { EventLog } from "@/components/layout/EventLog";
import { ConversationHistory } from "@/components/layout/ConversationHistory";
import { useDragResize } from "@/hooks/useDragResize";
import { useTranslation } from "@/hooks/useTranslation";
import { useAttentionStore } from "@/stores/attentionStore";

// ============================================================================
// CONSTANTS
// ============================================================================

const SIDEBAR_MIN_WIDTH = 200;
const SIDEBAR_MAX_WIDTH = 600;
const SIDEBAR_DEFAULT_WIDTH = 320; // equivalent to w-80
const AGENT_PANEL_MIN_HEIGHT = 60;
const AGENT_PANEL_DEFAULT_HEIGHT = 360;

/** Max height is 70% of viewport to prevent overflow on smaller screens */
const getMaxPanelHeight = () => Math.floor(window.innerHeight * 0.7);

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Desktop right sidebar containing the AgentStatus panel and a tabbed
 * Events / Conversation panel below it. Supports drag-to-resize both the
 * sidebar width (left edge) and the split between the two panels (divider).
 */
export function RightSidebar(): React.ReactNode {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"events" | "conversation">(
    "events",
  );
  // "Jump to log" on the agent card: show the events tab.
  const logJump = useAttentionStore((s) => s.logJump);
  if (logJump && activeTab !== "events") setActiveTab("events");

  const {
    size: sidebarWidth,
    isDragging: isWidthDragging,
    handleDragStart: handleWidthDragStart,
  } = useDragResize({
    initialSize: SIDEBAR_DEFAULT_WIDTH,
    minSize: SIDEBAR_MIN_WIDTH,
    maxSize: SIDEBAR_MAX_WIDTH,
    direction: "horizontal",
    edge: "left", // Left edge: dragging left increases width
  });

  const {
    size: agentPanelHeight,
    isDragging: isHeightDragging,
    handleDragStart: handleHeightDragStart,
  } = useDragResize({
    initialSize: AGENT_PANEL_DEFAULT_HEIGHT,
    minSize: AGENT_PANEL_MIN_HEIGHT,
    maxSize: getMaxPanelHeight,
    direction: "vertical",
    edge: "down",
  });

  const isDragging = isWidthDragging || isHeightDragging;

  return (
    <aside
      className={`relative flex flex-col gap-2 flex-shrink-0 overflow-hidden ${
        isDragging ? "select-none" : ""
      }`}
      style={{ width: sidebarWidth }}
    >
      {/* Horizontal Resize Handle (left edge) */}
      <div
        className="absolute left-0 top-0 w-1.5 h-full cursor-ew-resize z-10 hover:bg-accent/40 active:bg-accent/60 transition-colors"
        onMouseDown={handleWidthDragStart}
        title={t("sessions.dragToResize")}
      />

      {/* Agent Status */}
      <div
        className="min-h-0 flex-shrink-0"
        style={{ height: agentPanelHeight }}
      >
        <AgentStatus />
      </div>

      {/* Vertical Resize Handle (agent status ↕ events) */}
      <div
        className="flex-shrink-0 h-3 cursor-ns-resize flex items-center justify-center group -my-1"
        onMouseDown={handleHeightDragStart}
        title={t("sessions.dragToResize")}
      >
        <div className="w-10 h-1 rounded-full bg-line-strong group-hover:bg-accent group-active:bg-accent-dark transition-colors" />
      </div>

      {/* Events / Conversation tab panel */}
      <div className="min-h-0 flex flex-col flex-grow">
        {/* Tab header: an Olymp segmented switch */}
        <div role="tablist" className="qo-segmented mb-2 flex-shrink-0">
          <button
            role="tab"
            aria-selected={activeTab === "events"}
            onClick={() => setActiveTab("events")}
          >
            {t("sidebar.events")}
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "conversation"}
            onClick={() => setActiveTab("conversation")}
          >
            {t("sidebar.conversation")}
          </button>
        </div>

        {/* Tab content */}
        <div className="flex-grow min-h-0">
          {activeTab === "events" ? <EventLog /> : <ConversationHistory />}
        </div>
      </div>
    </aside>
  );
}
