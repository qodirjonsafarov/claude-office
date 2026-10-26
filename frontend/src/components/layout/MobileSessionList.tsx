"use client";

import { useState, useCallback } from "react";
import { ChevronDown, ChevronRight, History } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { GitStatusPanel } from "@/components/layout/GitStatusPanel";
import { EmptyState } from "@/components/ui/EmptyState";
import { useTranslation } from "@/hooks/useTranslation";
import { useGameStore, selectGitStatus } from "@/stores/gameStore";
import type { Session } from "@/hooks/useSessions";
import {
  groupSessionsByProject,
  splitSessionGroup,
} from "@/utils/sessionGroups";
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

  const hasGit = useGameStore(selectGitStatus) !== null;
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
        <EmptyState icon={History} title={t("sessions.noSessions")} />
      ) : (
        <ul className="m-0 p-0 list-none flex flex-col gap-1">
          {[...groups.entries()].map(([projectKey, groupSessions]) => {
            // Every running session is a card; ended ones fold.
            const { cards, older: rest } = splitSessionGroup(groupSessions);
            const isExpanded =
              expandedGroups.has(projectKey) ||
              rest.some((s) => s.id === sessionId);

            return (
              <li key={projectKey} className="flex flex-col gap-1">
                {cards.map((primary) => {
                  const selected = primary.id === sessionId;
                  return (
                    <button
                      key={primary.id}
                      type="button"
                      onClick={() => onSessionSelect(primary.id)}
                      aria-current={selected ? "true" : undefined}
                      className="qo-row min-h-[60px] !px-3.5 !py-3"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          aria-hidden="true"
                          className={`qo-live-dot ${primary.status === "active" ? "" : "qo-live-dot-idle"}`}
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
                      <div className="mt-1 pl-[18px] text-[12.5px] font-semibold text-ink-faint">
                        {[
                          t("sessions.events", { count: primary.eventCount }),
                          usageLabel(primary.tokenUsage),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </button>
                  );
                })}

                {rest.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => toggleGroup(projectKey)}
                      aria-expanded={isExpanded}
                      className="self-start flex items-center gap-1.5 min-h-[44px] ml-[22px] px-2 text-[13px] font-bold text-ink-faint hover:text-ink transition-colors"
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
                          className={`qo-row min-h-[44px] !pl-[32px] flex items-center gap-2 ${
                            session.id === sessionId
                              ? "text-accent"
                              : "text-ink-soft"
                          }`}
                        >
                          <span className="text-[13.5px] font-bold truncate flex-1">
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

      {/* A repository fills a fixed card; without one only its line shows */}
      <div className={`qo-card overflow-hidden ${hasGit ? "h-[300px]" : ""}`}>
        <GitStatusPanel />
      </div>
    </div>
  );
}
