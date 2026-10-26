"use client";

import { useEffect, useState } from "react";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { AgentStatus } from "@/components/game/AgentStatus";
import { EventLog } from "@/components/layout/EventLog";
import { ConversationHistory } from "@/components/layout/ConversationHistory";
import { useDragResize } from "@/hooks/useDragResize";
import { fluidPanelWidth, RIGHT_PANEL } from "@/utils/panelWidth";
import { useTranslation } from "@/hooks/useTranslation";
import { useAttentionStore } from "@/stores/attentionStore";
import {
  browserStorage,
  readStoredFlag,
  writeStoredFlag,
} from "@/utils/storedSize";

// ============================================================================
// CONSTANTS
// ============================================================================

const SIDEBAR_MIN_WIDTH = 200;
const SIDEBAR_MAX_WIDTH = 600;
/** The default width: a share of the window (utils/panelWidth.ts). */
const defaultWidth = () =>
  fluidPanelWidth(
    typeof window === "undefined" ? 0 : window.innerWidth,
    RIGHT_PANEL,
  );
const AGENT_PANEL_MIN_HEIGHT = 60;
const AGENT_PANEL_DEFAULT_HEIGHT = 360;
/** The collapsed panel: just the button that opens it again. */
const COLLAPSED_WIDTH = 52;
const COLLAPSED_KEY = "qo-right-collapsed";

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
    initialSize: defaultWidth,
    minSize: SIDEBAR_MIN_WIDTH,
    maxSize: SIDEBAR_MAX_WIDTH,
    direction: "horizontal",
    edge: "left", // Left edge: dragging left increases width
    storageKey: "qo-right-width",
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
    storageKey: "qo-right-split",
  });

  const isDragging = isWidthDragging || isHeightDragging;

  // Collapsed to a thin rail (remembered); the stage takes the room.
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const restore = () => {
      const stored = readStoredFlag(browserStorage(), COLLAPSED_KEY);
      if (stored !== null) setCollapsed(stored);
    };
    restore();
  }, []);
  const toggleCollapsed = () => {
    setCollapsed(!collapsed);
    writeStoredFlag(browserStorage(), COLLAPSED_KEY, !collapsed);
  };
  const toggleLabel = collapsed
    ? t("sidebar.expandPanel")
    : t("sidebar.collapsePanel");

  const foldButton = (
    <button
      type="button"
      onClick={toggleCollapsed}
      className="qo-icon-btn-sm"
      title={toggleLabel}
      aria-label={toggleLabel}
      aria-expanded={!collapsed}
    >
      {collapsed ? <PanelRightOpen size={18} /> : <PanelRightClose size={18} />}
    </button>
  );

  return (
    <aside
      className={`qo-panel relative flex-shrink-0 ${
        isDragging
          ? "select-none"
          : "transition-[width] duration-300 motion-reduce:transition-none"
      }`}
      style={{ width: collapsed ? COLLAPSED_WIDTH : sidebarWidth }}
    >
      {collapsed ? (
        /* Folded: only the way back, at the top of a slim card */
        <div className="flex flex-col items-center py-2">{foldButton}</div>
      ) : (
        <>
          {/* Horizontal Resize Handle (left edge) */}
          <div
            className="qo-resize-x left-0"
            onMouseDown={handleWidthDragStart}
            title={t("sessions.dragToResize")}
          />

          {/* Agent Status */}
          <section
            className="min-h-0 flex-shrink-0"
            style={{ height: agentPanelHeight }}
          >
            <AgentStatus headerAction={foldButton} />
          </section>

          {/* The line between the team and the log: drag to move it */}
          <div
            className="qo-split"
            onMouseDown={handleHeightDragStart}
            title={t("sessions.dragToResize")}
          />

          {/* Events / Conversation, switched at the top of the section */}
          <section className="min-h-0 flex flex-col flex-grow">
            <div className="px-3 pt-3 pb-1 flex-shrink-0">
              <div role="tablist" className="qo-segmented">
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
            </div>

            {/* Tab content */}
            <div className="flex-grow min-h-0">
              {activeTab === "events" ? <EventLog /> : <ConversationHistory />}
            </div>
          </section>
        </>
      )}
    </aside>
  );
}
