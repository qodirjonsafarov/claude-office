// @vitest-environment happy-dom
/**
 * Auto-follow (a new running session in the shown project) is an automatic
 * pick: it clears an earlier manual pick, so the followed session does not
 * stick as if the user had chosen it.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "../src/hooks/useSessions";

let listed: Session[] = [];
vi.mock("@/utils/api", () => ({
  apiFetch: vi.fn(async () => ({ ok: true, json: async () => listed })),
}));
vi.mock("@/machines/agentMachineService", () => ({
  agentMachineService: { reset: vi.fn() },
}));

const { useSessions } = await import("../src/hooks/useSessions");
const { usePreferencesStore } = await import("../src/stores/preferencesStore");

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const MIN = 60_000;
let now = 0;
const ago = (ms: number) => new Date(now - ms).toISOString();

function session(over: Partial<Session>): Session {
  return {
    id: "s",
    label: null,
    displayName: null,
    projectName: "p",
    projectRoot: "/r",
    createdAt: ago(60 * MIN),
    updatedAt: ago(0),
    status: "active",
    eventCount: 1,
    floorId: null,
    roomId: null,
    ...over,
  };
}

let api: ReturnType<typeof useSessions>;
function Probe() {
  api = useSessions(() => {});
  return null;
}

let root: Root;
let host: HTMLElement;

/** One list refresh (the hook polls every 5 s) and the deferred picks. */
async function refresh(sessions: Session[]) {
  listed = sessions;
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5000);
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  now = Date.now();
  usePreferencesStore.setState({ autoFollowNewSessions: true });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

describe("useSessions auto-follow", () => {
  it("an auto-followed session is an automatic pick, not a manual one", async () => {
    listed = [
      session({ id: "A", updatedAt: ago(30 * MIN) }),
      session({ id: "Z", projectRoot: "/q" }),
    ];
    act(() => root.render(<Probe />));
    await refresh(listed);
    expect(api.sessionId).toBe("Z");

    // The user opens A by hand; a new session B starts in A's project.
    act(() => api.setSessionId("A"));
    await refresh([
      session({ id: "A", updatedAt: ago(30 * MIN) }),
      session({ id: "Z", projectRoot: "/q" }),
      session({ id: "B" }),
    ]);
    expect(api.sessionId).toBe("B");

    // B goes quiet while Z keeps working: an automatic pick moves on.
    now = Date.now() + 5 * MIN;
    vi.setSystemTime(now);
    await refresh([
      session({ id: "A", updatedAt: ago(35 * MIN) }),
      session({ id: "Z", projectRoot: "/q" }),
      session({ id: "B", updatedAt: ago(5 * MIN) }),
    ]);
    expect(api.sessionId).toBe("Z");
  });
});
