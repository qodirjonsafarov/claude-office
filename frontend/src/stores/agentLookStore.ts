/**
 * The people sheet each agent wears in the office right now
 * (systems/agentLooks.ts): set by OfficeGame, read by the portraits in the
 * agent card and the team list so they show the same person.
 */

import { create } from "zustand";

interface AgentLookState {
  looks: ReadonlyMap<string, string>;
  setLooks: (looks: ReadonlyMap<string, string>) => void;
}

export const useAgentLooks = create<AgentLookState>()((set) => ({
  looks: new Map(),
  setLooks: (looks) =>
    set((state) => (state.looks === looks ? state : { looks })),
}));
