"use client";

import { create } from "zustand";
import type { EventType } from "@/types";
import { usePreferencesStore } from "@/stores/preferencesStore";
import { apiFetch } from "@/utils/api";
import { cleanPromptText } from "@/utils/promptText";

// ============================================================================
// TYPES
// ============================================================================

export type UrgencyLevel = "critical" | "high" | "low" | "info";

export interface AttentionToast {
  id: string;
  agentId: string | null;
  agentName: string | null;
  eventType: EventType;
  urgency: number;
  urgencyLevel: UrgencyLevel;
  title: string;
  description: string;
  createdAt: number;
  autoDismissMs: number | null;
  dismissed: boolean;
}

export interface FocusPopupState {
  agentId: string;
  screenX: number;
  screenY: number;
}

interface AttentionState {
  // Toast queue
  toastQueue: AttentionToast[];
  // Command bar
  isCommandBarOpen: boolean;
  commandFilter: string;
  // Focus popup
  focusPopup: FocusPopupState | null;

  // Actions
  processEvent: (event: {
    type: EventType;
    agentId?: string | null;
    agentName?: string | null;
    taskDescription?: string | null;
    errorType?: string | null;
    message?: string | null;
    /** A resting agent came back (subagent_start): "<Name> is back". */
    resumed?: boolean;
  }) => void;
  dismissToast: (id: string) => void;
  /** The wait is over: dismiss this person's "Needs permission" toasts. */
  resolvePermission: (agentId: string | null) => void;
  clearAllToasts: () => void;
  openCommandBar: () => void;
  closeCommandBar: () => void;
  setCommandFilter: (filter: string) => void;
  openFocusPopup: (agentId: string, screenX: number, screenY: number) => void;
  closeFocusPopup: () => void;
  focusAgentTerminal: (
    sessionId: string,
    agentId: string | null,
  ) => Promise<void>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

// Two at most: more would cover the panels under them.
const MAX_VISIBLE_TOASTS = 2;

/** Map event types to urgency scores and auto-dismiss timing. */
function scoreEvent(eventType: EventType): {
  urgency: number;
  level: UrgencyLevel;
  autoDismissMs: number | null;
} {
  const prefs = usePreferencesStore.getState();
  switch (eventType) {
    case "permission_request":
      return { urgency: 90, level: "critical", autoDismissMs: null };
    case "error":
      return { urgency: 70, level: "high", autoDismissMs: null };
    // "stop" = Claude finished its turn: good news, not an alarm.
    case "stop":
    case "subagent_stop":
    case "task_completed":
      return {
        urgency: 30,
        level: "low",
        autoDismissMs: prefs.toastAutoDismissLow,
      };
    case "subagent_start":
    case "background_task_notification":
      return {
        urgency: 10,
        level: "info",
        autoDismissMs: prefs.toastAutoDismissInfo,
      };
    default:
      return {
        urgency: 5,
        level: "info",
        autoDismissMs: prefs.toastAutoDismissInfo,
      };
  }
}

/** Human titles for the toast headline (falls back to the event type). */
const TOAST_TITLES: Partial<Record<EventType, string>> = {
  permission_request: "Needs permission",
  error: "Error",
  task_completed: "Task done",
  subagent_start: "Agent joined",
  background_task_notification: "Background task",
};

/** "main" and no id are the boss. */
function personOf(agentId: string | null): string {
  return !agentId || agentId === "main" ? "boss" : agentId;
}

/** Dismissed toasts kept (the newest); older ones are dropped. */
const MAX_DISMISSED_TOASTS = 20;

/** Every active toast and only the newest dismissed ones, order kept. */
function pruneDismissed(queue: AttentionToast[]): AttentionToast[] {
  const dismissed = queue.filter((t) => t.dismissed);
  if (dismissed.length <= MAX_DISMISSED_TOASTS) return queue;
  const keep = new Set(
    [...dismissed]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, MAX_DISMISSED_TOASTS)
      .map((t) => t.id),
  );
  return queue.filter((t) => !t.dismissed || keep.has(t.id));
}

/** The headline: "Validator V finished", "Dev D · Needs permission". */
function toastTitle(type: EventType, agentName: string | null): string {
  if (type === "stop" || type === "subagent_stop") {
    return `${agentName ?? "Boss"} finished`;
  }
  const base = TOAST_TITLES[type] ?? type.replace(/_/g, " ");
  return agentName ? `${agentName} · ${base}` : base;
}

// ============================================================================
// STORE
// ============================================================================

export const useAttentionStore = create<AttentionState>()((set, get) => ({
  toastQueue: [],
  isCommandBarOpen: false,
  commandFilter: "",
  focusPopup: null,

  processEvent: (event) => {
    const { urgency, level, autoDismissMs } = scoreEvent(event.type);
    // Skip very low urgency events that aren't in our explicit list
    if (urgency <= 5) return;

    const toast: AttentionToast = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      agentId: event.agentId ?? null,
      agentName: event.agentName ?? null,
      eventType: event.type,
      urgency,
      urgencyLevel: level,
      title:
        event.resumed && event.agentName
          ? `${event.agentName} is back`
          : toastTitle(event.type, event.agentName ?? null),
      description: cleanPromptText(
        event.taskDescription ?? event.errorType ?? event.message ?? "",
      ),
      createdAt: Date.now(),
      autoDismissMs,
      dismissed: false,
    };

    set((state) => {
      const queue = [...state.toastQueue, toast];
      // Sort by urgency descending
      queue.sort((a, b) => b.urgency - a.urgency);
      // Auto-dismiss oldest low-urgency toasts if over max
      if (queue.filter((t) => !t.dismissed).length > MAX_VISIBLE_TOASTS) {
        const activeSorted = queue
          .filter((t) => !t.dismissed)
          .sort((a, b) => a.urgency - b.urgency);
        const toastId = activeSorted[0]?.id;
        const finalQueue = queue.map((t) =>
          t.id === toastId ? { ...t, dismissed: true } : t,
        );
        return { toastQueue: pruneDismissed(finalQueue) };
      }
      return { toastQueue: pruneDismissed(queue) };
    });
  },

  resolvePermission: (agentId) =>
    set((state) => {
      const who = personOf(agentId);
      if (
        !state.toastQueue.some(
          (t) =>
            !t.dismissed &&
            t.eventType === "permission_request" &&
            personOf(t.agentId) === who,
        )
      ) {
        return state;
      }
      return {
        toastQueue: pruneDismissed(
          state.toastQueue.map((t) =>
            t.eventType === "permission_request" && personOf(t.agentId) === who
              ? { ...t, dismissed: true }
              : t,
          ),
        ),
      };
    }),

  dismissToast: (id) =>
    set((state) => ({
      toastQueue: pruneDismissed(
        state.toastQueue.map((t) =>
          t.id === id ? { ...t, dismissed: true } : t,
        ),
      ),
    })),

  clearAllToasts: () =>
    set((state) => ({
      toastQueue: pruneDismissed(
        state.toastQueue.map((t) => ({ ...t, dismissed: true })),
      ),
    })),

  openCommandBar: () => set({ isCommandBarOpen: true, commandFilter: "" }),
  closeCommandBar: () => set({ isCommandBarOpen: false, commandFilter: "" }),
  setCommandFilter: (filter) => set({ commandFilter: filter }),

  openFocusPopup: (agentId, screenX, screenY) =>
    set({
      focusPopup: { agentId, screenX, screenY },
    }),

  closeFocusPopup: () => set({ focusPopup: null }),

  focusAgentTerminal: async (sessionId, _agentId) => {
    try {
      const res = await apiFetch(`/api/v1/sessions/${sessionId}/focus`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        get().processEvent({
          type: "error",
          message: `Focus terminal failed: ${res.statusText}`,
        });
      }
    } catch {
      get().processEvent({
        type: "error",
        message: "Cannot reach backend — is the server running?",
      });
    }
    get().closeFocusPopup();
  },
}));

// ============================================================================
// SELECTORS
// ============================================================================

export const selectActiveToasts = (state: AttentionState) =>
  state.toastQueue.filter((t) => !t.dismissed);

export const selectUnreadCount = (state: AttentionState) =>
  state.toastQueue.filter((t) => !t.dismissed).length;

export const selectFocusPopup = (state: AttentionState) => state.focusPopup;
