"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { agentMachineService } from "@/machines/agentMachineService";
import { useGameStore } from "@/stores/gameStore";
import { useTranslation } from "@/hooks/useTranslation";
import {
  usePreferencesStore,
  selectAutoFollowNewSessions,
} from "@/stores/preferencesStore";
import { apiFetch } from "@/utils/api";
import { isLiveSession, pickSession } from "@/utils/sessionPick";

// ============================================================================
// TYPES
// ============================================================================

export interface Session {
  id: string;
  label: string | null;
  displayName: string | null;
  projectName: string | null;
  projectRoot: string | null;
  createdAt: string;
  updatedAt: string;
  status: string;
  eventCount: number;
  floorId: string | null;
  roomId: string | null;
  /** Token totals and cost (raw backend TokenUsage; parse with parseTokenUsage). */
  tokenUsage?: unknown;
}

// ============================================================================
// HOOK
// ============================================================================

interface UseSessionsResult {
  sessions: Session[];
  sessionsLoading: boolean;
  sessionId: string;
  /** Show a session the user chose (the office stays on it until it ends). */
  setSessionId: (id: string) => void;
  fetchSessions: () => Promise<Session[] | null>;
  showStatus: (text: string, type?: "info" | "error" | "success") => void;
}

/**
 * Manages session list fetching, auto-selection (utils/sessionPick.ts: the
 * most recently active running session, re-checked on every list refresh),
 * auto-follow, and session deletion event handling. Exposes fetchSessions so callers can trigger
 * a manual refresh (e.g., after delete or clear operations).
 */
export function useSessions(
  showStatus: (text: string, type?: "info" | "error" | "success") => void,
): UseSessionsResult {
  const [sessionId, setSessionId] = useState("");
  // The user chose the shown session (cleared by every automatic pick).
  const manualPick = useRef(false);
  // Whether the shown session was running when the list was last seen.
  const lastSeen = useRef<{ id: string; live: boolean }>({
    id: "",
    live: false,
  });
  const selectSession = useCallback((id: string) => {
    manualPick.current = true;
    setSessionId(id);
  }, []);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  const { t } = useTranslation();

  const autoFollowNewSessions = usePreferencesStore(
    selectAutoFollowNewSessions,
  );

  // Track known session IDs for auto-follow detection
  const knownSessionIds = useRef<Set<string>>(new Set());

  // Fetch sessions list
  const fetchSessions = useCallback(async (): Promise<Session[] | null> => {
    setSessionsLoading(true);
    try {
      const res = await apiFetch("/api/v1/sessions");
      if (res.ok) {
        const data = (await res.json()) as Session[];
        setSessions(data);
        return data;
      }
    } catch {
      // Silently fail
    } finally {
      setSessionsLoading(false);
    }
    return null;
  }, []);

  // Fetch sessions on mount and periodically. The first fetch is deferred by a
  // tick so its loading-state update does not render synchronously inside the
  // effect (react-hooks/set-state-in-effect).
  useEffect(() => {
    const timeout = setTimeout(fetchSessions, 0);
    const interval = setInterval(fetchSessions, 5000);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [fetchSessions]);

  // Listen for session deletion events from WebSocket
  useEffect(() => {
    const handleSessionDeleted = async (e: Event) => {
      const customEvent = e as CustomEvent<{ sessionId: string }>;
      const deletedSessionId = customEvent.detail.sessionId;

      // Refetch sessions to update the list
      const updatedSessions = await fetchSessions();

      // If the deleted session is the one we're viewing, switch to another
      if (deletedSessionId === sessionId) {
        if (updatedSessions && updatedSessions.length > 0) {
          const newSession =
            updatedSessions.find((s) => s.status === "active") ||
            updatedSessions[0];
          if (newSession) {
            setSessionId(newSession.id);
            showStatus(
              t("status.sessionDeletedSwitched", {
                sessionName:
                  newSession.label ||
                  newSession.projectName ||
                  newSession.id.slice(0, 8),
              }),
              "info",
            );
          }
        } else {
          showStatus(t("status.sessionDeletedNoOthers"), "info");
        }
      }
    };
    window.addEventListener("session-deleted", handleSessionDeleted);
    return () =>
      window.removeEventListener("session-deleted", handleSessionDeleted);
  }, [fetchSessions, sessionId, showStatus, t]);

  // Auto-select: on load (also after a backend restart or on a new device),
  // when the shown session ends, and (automatic choice only) when another
  // running session took over. Never away from a running manual pick.
  useEffect(() => {
    const current = sessions.find((s) => s.id === sessionId);
    const seen = lastSeen.current;
    const currentWasLive = current
      ? seen.id === sessionId
        ? seen.live
        : isLiveSession(current)
      : false;
    if (current)
      lastSeen.current = { id: sessionId, live: isLiveSession(current) };

    const nextId = pickSession({
      sessions,
      currentId: sessionId,
      manual: manualPick.current,
      currentWasLive,
      now: Date.now(),
    });
    const next = sessions.find((s) => s.id === nextId);
    if (!next || next.id === sessionId) return;

    const firstPick = sessionId === "";
    const statusText = t(
      firstPick ? "status.connectedTo" : "status.autoFollowed",
      {
        sessionName: next.label || next.projectName || next.id.slice(0, 8),
      },
    );
    // Deferred by a tick so the switch does not render synchronously
    // inside the effect (react-hooks/set-state-in-effect).
    const timeout = setTimeout(() => {
      if (!firstPick) {
        agentMachineService.reset();
        useGameStore.getState().resetForSessionSwitch();
      }
      manualPick.current = false;
      lastSeen.current = { id: next.id, live: isLiveSession(next) };
      setSessionId(next.id);
      showStatus(statusText, "info");
    }, 0);
    return () => clearTimeout(timeout);
  }, [sessions, sessionId, showStatus, t]);

  // Auto-follow new sessions in the current project
  useEffect(() => {
    if (!autoFollowNewSessions || sessions.length === 0) return;

    // Get current session's project root
    const currentSession = sessions.find((s) => s.id === sessionId);
    const currentProjectRoot = currentSession?.projectRoot;

    // Find new sessions that weren't in our known set
    const newSessions = sessions.filter(
      (s) => !knownSessionIds.current.has(s.id),
    );

    // Update known sessions set
    knownSessionIds.current = new Set(sessions.map((s) => s.id));

    // If no new sessions or no current project context, skip
    if (newSessions.length === 0 || !currentProjectRoot) return;

    // Find a new active session in the same project
    const newSessionInProject = newSessions.find(
      (s) => s.projectRoot === currentProjectRoot && s.status === "active",
    );

    if (newSessionInProject && newSessionInProject.id !== sessionId) {
      // Reset state machines and store for session switch
      agentMachineService.reset();
      useGameStore.getState().resetForSessionSwitch();

      // An automatic pick: the user did not choose this session.
      manualPick.current = false;
      setSessionId(newSessionInProject.id);
      showStatus(
        t("status.autoFollowed", {
          sessionName:
            newSessionInProject.label ||
            newSessionInProject.projectName ||
            newSessionInProject.id.slice(0, 8),
        }),
        "info",
      );
    }
  }, [sessions, sessionId, autoFollowNewSessions, showStatus, t]);

  return {
    sessions,
    sessionsLoading,
    sessionId,
    setSessionId: selectSession,
    fetchSessions,
    showStatus,
  };
}
