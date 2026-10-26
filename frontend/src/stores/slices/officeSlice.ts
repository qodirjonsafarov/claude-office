/**
 * Office slice (ARC-005).
 *
 * Session/scalar office state: desks, elevator, phone, compaction animation
 * phase, todos, git status, event log, conversation. Self-contained apart
 * from the @/types shapes it carries.
 */
import type { StateCreator } from "zustand";
import type { GameStore } from "../gameStore";
import type {
  ElevatorState,
  PhoneState,
  TodoItem,
  GitStatus,
  WebSocketMessage,
  ConversationEntry,
} from "@/types";
import type { EventLogEntry, CompactionAnimationPhase } from "./types";
import { MIN_DESK_COUNT } from "@/constants/positions";
import {
  agentUsageMap,
  parseTokenUsage,
  sameTokenTotals,
  type TokenTotals,
} from "@/utils/tokenUsage";

const MAX_EVENT_LOG = 500;
/** How much of the backend's history fills the log on (re)connect. */
const HISTORY_SEED = 200;

type LogEvent = NonNullable<WebSocketMessage["event"]>;

/** One event, whichever path (history or live stream) brought it. */
function eventKey(e: { id: string; type: string; agentId?: string | null }) {
  return `${e.id}|${e.type}|${e.agentId || "main"}`;
}

function toEntry(event: LogEvent): EventLogEntry {
  const timestamp = event.timestamp ? new Date(event.timestamp) : new Date();
  return { ...event, timestamp };
}

function hasDetail(e: { detail?: object | null }): boolean {
  return !!e.detail && Object.keys(e.detail).length > 0;
}

export type OfficeSlice = {
  sessionId: string;
  deskCount: number;
  elevatorState: ElevatorState;
  phoneState: PhoneState;
  contextUtilization: number;
  toolUsesSinceCompaction: number;
  isCompacting: boolean;
  compactionPhase: CompactionAnimationPhase;
  printReport: boolean;
  todos: TodoItem[];
  gitStatus: GitStatus | null;
  eventLog: EventLogEntry[];
  conversation: ConversationEntry[];
  tokenUsage: TokenTotals | null;
  /** Per-person usage ("boss" and agent ids); people without usage are absent. */
  agentUsage: ReadonlyMap<string, TokenTotals>;

  setSessionId: (id: string) => void;
  setElevatorState: (state: ElevatorState) => void;
  setPhoneState: (state: PhoneState) => void;
  setDeskCount: (count: number) => void;
  setContextUtilization: (utilization: number) => void;
  setToolUsesSinceCompaction: (count: number) => void;
  triggerCompaction: () => void;
  setCompactionPhase: (phase: CompactionAnimationPhase) => void;
  setIsCompacting: (isCompacting: boolean) => void;
  setTodos: (todos: TodoItem[]) => void;
  setPrintReport: (printReport: boolean) => void;
  setGitStatus: (status: GitStatus | null) => void;
  addEventLog: (event: NonNullable<WebSocketMessage["event"]>) => void;
  /** Add the newest backend history entries the log does not have yet. */
  mergeEventHistory: (history: readonly LogEvent[] | null | undefined) => void;
  setConversation: (conversation: ConversationEntry[]) => void;
  /** Store the backend's optional office `tokenUsage` (raw, parsed here). */
  setTokenUsage: (raw: unknown) => void;
  /** Store `boss.tokenUsage` and each `agents[i].tokenUsage` of a state update. */
  syncAgentUsage: (state: Parameters<typeof agentUsageMap>[0]) => void;
};

export const initialOfficeState = {
  sessionId: "None",
  deskCount: MIN_DESK_COUNT,
  elevatorState: "closed" as ElevatorState,
  phoneState: "idle" as PhoneState,
  contextUtilization: 0.0,
  toolUsesSinceCompaction: 0,
  isCompacting: false,
  compactionPhase: "idle" as CompactionAnimationPhase,
  printReport: false,
  todos: [] as TodoItem[],
  gitStatus: null as GitStatus | null,
  eventLog: [] as EventLogEntry[],
  conversation: [] as ConversationEntry[],
  tokenUsage: null as TokenTotals | null,
  agentUsage: new Map() as ReadonlyMap<string, TokenTotals>,
};

export const createOfficeSlice: StateCreator<GameStore, [], [], OfficeSlice> = (
  set,
) => ({
  ...initialOfficeState,

  setSessionId: (id) => set({ sessionId: id }),
  setElevatorState: (elevatorState) => set({ elevatorState }),
  setPhoneState: (phoneState) => set({ phoneState }),
  setDeskCount: (deskCount) => set({ deskCount }),
  setContextUtilization: (contextUtilization) =>
    // Only update context utilization - don't reset compaction state
    // The compaction animation system controls when compaction ends via setCompactionPhase
    set({ contextUtilization }),
  setToolUsesSinceCompaction: (toolUsesSinceCompaction) =>
    set({ toolUsesSinceCompaction }),
  triggerCompaction: () => {
    // Start compaction animation - boss will walk to trash can and jump on it
    set({
      isCompacting: true,
      toolUsesSinceCompaction: 0,
      compactionPhase: "walking_to_trash",
    });
  },
  setCompactionPhase: (compactionPhase) => set({ compactionPhase }),
  setIsCompacting: (isCompacting) => set({ isCompacting }),
  setTodos: (todos) => set({ todos }),
  setPrintReport: (printReport) => set({ printReport }),
  setGitStatus: (gitStatus) => set({ gitStatus }),

  addEventLog: (event) =>
    set((state) => {
      const key = eventKey(event);
      const index = state.eventLog.findIndex((e) => eventKey(e) === key);
      if (index !== -1) {
        // Already brought by the history: only take a richer detail.
        if (!hasDetail(event) || hasDetail(state.eventLog[index]!)) {
          return state;
        }
        const eventLog = [...state.eventLog];
        eventLog[index] = toEntry(event);
        return { eventLog };
      }
      return {
        eventLog: [
          toEntry(event),
          ...state.eventLog.slice(0, MAX_EVENT_LOG - 1),
        ],
      };
    }),

  mergeEventHistory: (history) =>
    set((state) => {
      if (!history || history.length === 0) return state;
      const known = new Set(state.eventLog.map(eventKey));
      const fresh = history
        .slice(-HISTORY_SEED)
        .filter((e) => !known.has(eventKey(e)))
        .map(toEntry);
      if (fresh.length === 0) return state;
      const eventLog = [...state.eventLog, ...fresh]
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, MAX_EVENT_LOG);
      return { eventLog };
    }),

  setConversation: (conversation) => set({ conversation }),

  setTokenUsage: (raw) =>
    set((state) => {
      const tokenUsage = parseTokenUsage(raw);
      return sameTokenTotals(state.tokenUsage, tokenUsage)
        ? state
        : { tokenUsage };
    }),

  syncAgentUsage: (backendState) =>
    set((state) => {
      const next = agentUsageMap(backendState);
      const prev = state.agentUsage;
      const same =
        next.size === prev.size &&
        [...next].every(([id, t]) => sameTokenTotals(prev.get(id) ?? null, t));
      return same ? state : { agentUsage: next };
    }),
});
