"use client";

import { useState, useCallback, useRef } from "react";
import {
  History,
  Trash2,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { GitStatusPanel } from "@/components/layout/GitStatusPanel";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Session } from "@/hooks/useSessions";
import { getProjectKey, groupSessionsByProject } from "@/utils/sessionGroups";
import { usageLabel } from "@/utils/tokenUsage";
import { useDragResize } from "@/hooks/useDragResize";
import { fluidPanelWidth, LEFT_PANEL } from "@/utils/panelWidth";
import { useGameStore, selectGitStatus } from "@/stores/gameStore";
import { useTranslation } from "@/hooks/useTranslation";

// ============================================================================
// CONSTANTS
// ============================================================================

const SIDEBAR_MIN_WIDTH = 180;
const SIDEBAR_MAX_WIDTH = 500;
/** The default width: a share of the window (utils/panelWidth.ts). */
const defaultWidth = () =>
  fluidPanelWidth(
    typeof window === "undefined" ? 0 : window.innerWidth,
    LEFT_PANEL,
  );
/** The folded panel: just the button that opens it again. */
const COLLAPSED_WIDTH = 52;
const SESSIONS_MIN_HEIGHT = 80;
const SESSIONS_DEFAULT_HEIGHT = 280;

/** Max height is 70% of viewport to prevent overflow on smaller screens */
const getMaxPanelHeight = () => Math.floor(window.innerHeight * 0.7);

// ============================================================================
// TYPES
// ============================================================================

interface SessionSidebarProps {
  sessions: Session[];
  sessionsLoading: boolean;
  sessionId: string;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
  onSessionSelect: (id: string) => Promise<void>;
  onDeleteSession: (session: Session) => void;
  onRenameSession: (sessionId: string, newName: string) => Promise<void>;
}

// ============================================================================
// COMPONENT
// ============================================================================

/** Editable session name — double-click to rename, Enter/blur to save, Escape to cancel. */
function EditableName({
  session,
  isEditing,
  onStartEdit,
  onCommit,
  onCancel,
  className,
}: {
  session: Session;
  isEditing: boolean;
  onStartEdit: () => void;
  onCommit: (name: string) => void;
  onCancel: () => void;
  className?: string;
}): React.ReactNode {
  const [draft, setDraft] = useState(
    () => session.displayName ?? getProjectKey(session),
  );
  const committedRef = useRef(false);

  if (isEditing) {
    return (
      <input
        type="text"
        value={draft}
        autoFocus
        maxLength={64}
        className="flex-1 min-w-0 h-7 -my-1 px-2 rounded-[9px] bg-panel text-[13.5px] font-extrabold text-ink outline-none border border-accent"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            committedRef.current = true;
            onCommit(draft);
          } else if (e.key === "Escape") {
            e.preventDefault();
            committedRef.current = true;
            onCancel();
          }
        }}
        onBlur={() => {
          if (!committedRef.current) {
            onCommit(draft);
          }
        }}
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  const displayName = session.displayName ?? getProjectKey(session);

  return (
    <span
      className={className}
      onDoubleClick={(e) => {
        e.stopPropagation();
        committedRef.current = false;
        setDraft(session.displayName ?? getProjectKey(session));
        onStartEdit();
      }}
      title={session.displayName ? "Double-click to rename" : undefined}
    >
      {displayName}
    </span>
  );
}

/**
 * Desktop left sidebar containing the collapsible session browser and git
 * status panel. Supports drag-to-resize both the sidebar width (right edge)
 * and the sessions panel height (divider between sessions and git status).
 */
export function SessionSidebar({
  sessions,
  sessionsLoading,
  sessionId,
  isCollapsed,
  onToggleCollapsed,
  onSessionSelect,
  onDeleteSession,
  onRenameSession,
}: SessionSidebarProps): React.ReactNode {
  const { t } = useTranslation();

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);

  const toggleGroup = useCallback((key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const {
    size: sidebarWidth,
    isDragging: isWidthDragging,
    handleDragStart: handleWidthDragStart,
  } = useDragResize({
    initialSize: defaultWidth,
    minSize: SIDEBAR_MIN_WIDTH,
    maxSize: SIDEBAR_MAX_WIDTH,
    direction: "horizontal",
    edge: "right",
    storageKey: "qo-left-width",
  });

  const {
    size: sessionsHeight,
    isDragging: isHeightDragging,
    handleDragStart: handleHeightDragStart,
  } = useDragResize({
    initialSize: SESSIONS_DEFAULT_HEIGHT,
    minSize: SESSIONS_MIN_HEIGHT,
    maxSize: getMaxPanelHeight,
    direction: "vertical",
    edge: "down",
    storageKey: "qo-left-split",
  });

  const isDragging = isWidthDragging || isHeightDragging;
  // No repository (or no status yet): no Git panel, the sessions take the room.
  const hasGit = useGameStore(selectGitStatus) !== null;

  const groups = groupSessionsByProject(sessions);

  const toggleLabel = isCollapsed
    ? t("sessions.expandSidebar")
    : t("sessions.collapseSidebar");
  const ago = (iso: string) =>
    formatDistanceToNow(new Date(iso), { addSuffix: true });

  return (
    <aside
      className={`qo-panel relative flex-shrink-0 ${
        isDragging
          ? "select-none"
          : "transition-[width] duration-300 motion-reduce:transition-none"
      }`}
      style={{ width: isCollapsed ? COLLAPSED_WIDTH : sidebarWidth }}
    >
      {isCollapsed ? (
        /* Folded: only the way back, at the top of a slim card */
        <div className="flex flex-col items-center gap-2 py-2">
          <button
            onClick={onToggleCollapsed}
            className="qo-icon-btn-sm"
            title={toggleLabel}
            aria-label={toggleLabel}
            aria-expanded={false}
          >
            <PanelLeftOpen size={18} />
          </button>
          <span className="qo-count" title={t("sessions.title")}>
            {sessions.length}
          </span>
        </div>
      ) : (
        <>
          {/* Session Browser */}
          <section
            className={`flex flex-col min-h-0 ${
              hasGit ? "flex-shrink-0" : "flex-1"
            }`}
            style={hasGit ? { height: sessionsHeight } : undefined}
          >
            <div className="qo-panel-head">
              <h2 className="qo-title">{t("sessions.title")}</h2>
              <span className="qo-count">{sessions.length}</span>
              <button
                onClick={onToggleCollapsed}
                className="qo-icon-btn-sm ml-auto"
                title={toggleLabel}
                aria-label={toggleLabel}
                aria-expanded={true}
              >
                <PanelLeftClose size={18} />
              </button>
            </div>

            <div className="overflow-y-auto overscroll-contain flex-grow min-h-0 px-2 pb-2">
              {sessionsLoading && sessions.length === 0 ? (
                <div className="flex items-center justify-center gap-3 py-8 text-[13px] font-bold text-ink-faint">
                  <span className="qo-spinner" aria-hidden="true" />
                  {t("sessions.loading")}
                </div>
              ) : sessions.length === 0 ? (
                <EmptyState icon={History} title={t("sessions.noSessions")} />
              ) : (
                <div className="flex flex-col gap-1">
                  {[...groups.entries()].map(([projectKey, groupSessions]) => {
                    const hasActive = groupSessions.some(
                      (s) => s.status === "active",
                    );
                    const isActiveSelected = groupSessions.some(
                      (s) => s.id === sessionId,
                    );
                    const isExpanded =
                      expandedGroups.has(projectKey) || isActiveSelected;
                    const primary = groupSessions[0];
                    const rest = groupSessions.slice(1);
                    const selected = primary.id === sessionId;

                    return (
                      <div key={projectKey} className="flex flex-col">
                        {/* Primary session card (always visible) */}
                        <div
                          role="button"
                          tabIndex={0}
                          aria-current={selected ? "true" : undefined}
                          className="qo-row group relative cursor-pointer"
                          onClick={() => onSessionSelect(primary.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              onSessionSelect(primary.id);
                            }
                          }}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              aria-hidden="true"
                              className={`qo-live-dot flex-shrink-0 ${
                                hasActive ? "" : "qo-live-dot-idle"
                              }`}
                            />
                            <EditableName
                              session={primary}
                              isEditing={editingSessionId === primary.id}
                              onStartEdit={() =>
                                setEditingSessionId(primary.id)
                              }
                              onCommit={(name) => {
                                setEditingSessionId(null);
                                onRenameSession(primary.id, name);
                              }}
                              onCancel={() => setEditingSessionId(null)}
                              className={`text-[13.5px] font-extrabold truncate flex-1 min-w-0 ${
                                selected ? "text-accent" : "text-ink"
                              }`}
                            />
                          </div>
                          <div
                            className="mt-1 pl-[18px] text-[12px] font-semibold text-ink-faint truncate"
                            title={primary.id}
                          >
                            {[
                              ago(primary.updatedAt),
                              t("sessions.events", {
                                count: primary.eventCount,
                              }),
                              usageLabel(primary.tokenUsage),
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </div>
                          {/* The danger action: only on the open session
                              (hover or focus elsewhere), quiet until hovered */}
                          <div
                            className={`mt-2 pl-[12px] ${
                              selected
                                ? "flex"
                                : "hidden group-hover:flex group-focus-within:flex"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteSession(primary);
                              }}
                              className="qo-btn !h-8 !px-2.5 !gap-1.5 !text-[12.5px] text-danger hover:bg-danger-dim"
                              aria-label={`${t("sessions.deleteSession")} ${primary.id}`}
                            >
                              <Trash2 size={14} />
                              {t("sessions.deleteSession")}
                            </button>
                          </div>
                        </div>

                        {/* Expand/collapse for older sessions */}
                        {rest.length > 0 && (
                          <>
                            <button
                              type="button"
                              onClick={() => toggleGroup(projectKey)}
                              aria-expanded={isExpanded}
                              className="self-start flex items-center gap-1.5 h-8 ml-[22px] px-2 rounded-[10px] text-[12px] font-bold text-ink-faint hover:text-ink hover:bg-panel-2 transition-colors"
                            >
                              {isExpanded ? (
                                <ChevronDown size={13} />
                              ) : (
                                <ChevronRight size={13} />
                              )}
                              {t("sessions.older", { count: rest.length })}
                            </button>

                            {isExpanded &&
                              rest.map((session) => (
                                <div
                                  role="button"
                                  tabIndex={0}
                                  key={session.id}
                                  aria-current={
                                    session.id === sessionId
                                      ? "true"
                                      : undefined
                                  }
                                  className="qo-row group relative !py-2 !pl-[30px] cursor-pointer"
                                  onClick={() => onSessionSelect(session.id)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      onSessionSelect(session.id);
                                    }
                                  }}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span
                                      className={`text-[12.5px] font-bold truncate flex-1 min-w-0 ${
                                        session.id === sessionId
                                          ? "text-accent"
                                          : "text-ink-soft"
                                      }`}
                                    >
                                      {session.displayName ??
                                        session.id.slice(0, 12)}
                                    </span>
                                    <span className="flex-shrink-0 text-[11.5px] font-bold text-ink-faint group-hover:hidden group-focus-within:hidden">
                                      {ago(session.updatedAt)}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onDeleteSession(session);
                                      }}
                                      className="hidden group-hover:inline-flex group-focus-within:inline-flex items-center justify-center w-7 h-7 -my-1 rounded-[9px] text-ink-faint hover:text-danger hover:bg-danger-dim transition-colors"
                                      aria-label={`${t("sessions.deleteSession")} ${session.id}`}
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {hasGit && (
            <>
              {/* The line between sessions and git: drag to move it */}
              <div
                className="qo-split"
                onMouseDown={handleHeightDragStart}
                title={t("sessions.dragToResize")}
              />

              {/* Git Status Panel */}
              <div className="flex-grow min-h-0">
                <GitStatusPanel />
              </div>
            </>
          )}

          {/* Horizontal Resize Handle (right edge) */}
          <div
            className="qo-resize-x right-0"
            onMouseDown={handleWidthDragStart}
            title={t("sessions.dragToResize")}
          />
        </>
      )}
    </aside>
  );
}
