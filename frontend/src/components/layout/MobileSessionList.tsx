"use client";

import { useState, useCallback } from "react";
import { ChevronDown, ChevronRight, Inbox } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { GitStatusPanel } from "@/components/layout/GitStatusPanel";
import { useTranslation } from "@/hooks/useTranslation";
import type { Session } from "@/hooks/useSessions";
import { groupSessionsByProject } from "@/utils/sessionGroups";
import { usageLabel } from "@/utils/tokenUsage";

// ============================================================================
// TYPES
// ============================================================================

interface MobileSessionListProps {
  sessions: Session[];
  sessionsLoading: boolean;
  sessionId: string;
  /** Picks a session; the sheet closes after. */
  onSessionSelect: (id: string) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * The phone's session browser (the content of the "Sessions" sheet): sessions
 * grouped by project, the newest of each group as a card, older ones folded
 * under it; the git status of the current session below.
 */
export function MobileSessionList({
  sessions,
  sessionsLoading,
  sessionId,
  onSessionSelect,
}: MobileSessionListProps): React.ReactNode {
  const { t } = useTranslation();

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = useCallback((key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const groups = groupSessionsByProject(sessions);
  const ago = (iso: string) =>
    formatDistanceToNow(new Date(iso), {
      addSuffix: true,
    });

  return (
    <div className="flex flex-col gap-4">
      {sessionsLoading && sessions.length === 0 ? (
        <div className="flex items-center justify-center gap-3 py-8 text-[13px] font-bold text-ink-faint">
          <span className="qo-spinner" aria-hidden="true" />
          {t("sessions.loading")}
        </div>
      ) : sessions.length === 0 ? (
        <div className="py-8 px-4 flex flex-col items-center gap-2.5 text-center text-[13px] font-bold text-ink-faint border border-dashed border-line-strong rounded-xl2">
          <Inbox size={24} aria-hidden="true" />
          {t("sessions.noSessions")}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {[...groups.entries()].map(([projectKey, groupSessions]) => {
            const hasActive = groupSessions.some((s) => s.status === "active");
            const isActiveSelected = groupSessions.some(
              (s) => s.id === sessionId,
            );
            const isExpanded =
              expandedGroups.has(projectKey) || isActiveSelected;
            const primary = groupSessions[0];
            const rest = groupSessions.slice(1);
            const selected = primary.id === sessionId;

            return (
              <li key={projectKey} className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => onSessionSelect(primary.id)}
                  aria-current={selected ? "true" : undefined}
                  className={`w-full min-h-[56px] px-4 py-3 rounded-xl2 border text-left transition-colors ${
                    selected
                      ? "bg-accent-dim border-transparent"
                      : "bg-panel-2 border-line hover:border-line-strong"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      aria-hidden="true"
                      className={`qo-live-dot ${hasActive ? "" : "qo-live-dot-idle"}`}
                    />
                    <span
                      className={`text-[15px] font-extrabold truncate flex-1 ${
                        selected ? "text-accent" : "text-ink"
                      }`}
                    >
                      {primary.displayName ?? projectKey}
                    </span>
                    <span className="flex-shrink-0 text-[12px] font-bold text-ink-faint">
                      {ago(primary.updatedAt)}
                    </span>
                  </div>
                  {/* Its own line, wrapping if needed: the tokens are never cut. */}
                  <div className="mt-1 pl-[18px] text-[12px] font-bold text-ink-faint">
                    {[
                      t("sessions.events", { count: primary.eventCount }),
                      usageLabel(primary.tokenUsage),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </button>

                {rest.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => toggleGroup(projectKey)}
                      aria-expanded={isExpanded}
                      className="self-start flex items-center gap-1.5 min-h-[44px] px-3 text-[12px] font-bold text-ink-faint hover:text-ink transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronDown size={14} />
                      ) : (
                        <ChevronRight size={14} />
                      )}
                      {t("sessions.older", { count: rest.length })}
                    </button>

                    {isExpanded &&
                      rest.map((session) => (
                        <button
                          type="button"
                          key={session.id}
                          onClick={() => onSessionSelect(session.id)}
                          aria-current={
                            session.id === sessionId ? "true" : undefined
                          }
                          className={`ml-4 min-h-[44px] px-3 rounded-xl flex items-center gap-2 text-left transition-colors ${
                            session.id === sessionId
                              ? "bg-accent-dim text-accent"
                              : "text-ink-soft hover:bg-panel-2"
                          }`}
                        >
                          <span className="text-[12.5px] font-mono truncate flex-1">
                            {session.displayName ?? session.id.slice(0, 12)}
                          </span>
                          <span className="text-[12px] text-ink-faint flex-shrink-0">
                            {ago(session.updatedAt)}
                          </span>
                        </button>
                      ))}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="h-[280px]">
        <GitStatusPanel />
      </div>
    </div>
  );
}
