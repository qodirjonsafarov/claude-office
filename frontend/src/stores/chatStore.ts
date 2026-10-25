/**
 * Web chat state: whether the current session can take a message (backend
 * `state.chat`) and the sessions the owner already confirmed sending to.
 * Kept out of gameStore: the office reconciler does not need it.
 */
import { create } from "zustand";
import type { ChatStatus } from "@/types/generated";

const CONFIRMED_KEY = "claude-office-chat-confirmed";
const MAX_CONFIRMED = 50;

function loadConfirmed(): string[] {
  try {
    const raw = localStorage.getItem(CONFIRMED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return []; // no storage (SSR, private mode) or bad JSON
  }
}

function saveConfirmed(ids: string[]): void {
  try {
    localStorage.setItem(CONFIRMED_KEY, JSON.stringify(ids));
  } catch {
    // storage blocked: the confirmation lasts for this tab only
  }
}

interface ChatStore {
  status: ChatStatus | null;
  /** The session `status` belongs to. */
  sessionId: string | null;
  /** Session ids the owner confirmed sending to (newest last). */
  confirmed: string[];
  setStatus: (
    status: ChatStatus | null | undefined,
    sessionId: string | null,
  ) => void;
  confirmSession: (sessionId: string) => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  status: null,
  sessionId: null,
  confirmed: loadConfirmed(),
  setStatus: (status, sessionId) =>
    set((state) => {
      const next = status ?? null;
      const same =
        state.sessionId === sessionId &&
        (state.status === null) === (next === null) &&
        state.status?.canSend === next?.canSend &&
        state.status?.reason === next?.reason &&
        state.status?.label === next?.label;
      return same ? state : { status: next, sessionId };
    }),
  confirmSession: (sessionId) =>
    set((state) => {
      if (state.confirmed.includes(sessionId)) return state;
      const confirmed = [...state.confirmed, sessionId].slice(-MAX_CONFIRMED);
      saveConfirmed(confirmed);
      return { confirmed };
    }),
}));
