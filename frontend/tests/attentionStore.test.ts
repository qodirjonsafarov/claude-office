/**
 * Toast scoring in the attention store: "stop" (Claude finished) is a calm
 * "Done" that goes away by itself, not a sticky red error.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/utils/api", () => ({ apiFetch: vi.fn() }));

import { useAttentionStore } from "../src/stores/attentionStore";
import { usePreferencesStore } from "../src/stores/preferencesStore";

function lastToast() {
  const queue = useAttentionStore.getState().toastQueue;
  return queue[queue.length - 1];
}

describe("attention toasts", () => {
  beforeEach(() => {
    useAttentionStore.setState({ toastQueue: [] });
  });

  it("shows stop as a low-urgency Done toast that auto-dismisses", () => {
    useAttentionStore.getState().processEvent({ type: "stop" });
    const toast = lastToast();
    expect(toast?.urgencyLevel).toBe("low");
    expect(toast?.title).toBe("Boss finished");
    expect(toast?.autoDismissMs).toBe(
      usePreferencesStore.getState().toastAutoDismissLow,
    );
  });

  it("keeps errors sticky and high", () => {
    useAttentionStore.getState().processEvent({ type: "error" });
    expect(lastToast()?.urgencyLevel).toBe("high");
    expect(lastToast()?.autoDismissMs).toBeNull();
  });

  it("gives permission requests a readable title", () => {
    useAttentionStore.getState().processEvent({ type: "permission_request" });
    expect(lastToast()?.title).toBe("Needs permission");
  });

  it("ranks Done below an error", () => {
    const { processEvent } = useAttentionStore.getState();
    processEvent({ type: "stop" });
    processEvent({ type: "error" });
    const queue = useAttentionStore.getState().toastQueue;
    expect(queue.map((t) => t.eventType)).toEqual(["error", "stop"]);
  });

  it("says which agent finished and what it did", () => {
    useAttentionStore.getState().processEvent({
      type: "subagent_stop",
      agentId: "a1",
      agentName: "Validator V",
      taskDescription: "Check the office live",
    });
    expect(lastToast()?.title).toBe("Validator V finished");
    expect(lastToast()?.description).toBe("Check the office live");
    expect(lastToast()?.urgencyLevel).toBe("low");
  });

  it("puts the agent name in front of other titles", () => {
    useAttentionStore
      .getState()
      .processEvent({ type: "permission_request", agentName: "Dev D" });
    expect(lastToast()?.title).toBe("Dev D · Needs permission");
  });

  it("shows a summary instead of a raw agent-message envelope", () => {
    useAttentionStore.getState().processEvent({
      type: "stop",
      taskDescription: '<agent-message from="a3eaf17">\n[Subag...',
    });
    expect(lastToast()?.description).toBe("Message from an agent");
  });

  it("keeps at most two toasts on screen", () => {
    const { processEvent } = useAttentionStore.getState();
    processEvent({ type: "stop" });
    processEvent({ type: "stop" });
    processEvent({ type: "stop" });
    const active = useAttentionStore
      .getState()
      .toastQueue.filter((t) => !t.dismissed);
    expect(active).toHaveLength(2);
  });

  it("forgets old dismissed toasts, keeping about 20", () => {
    const { processEvent, dismissToast } = useAttentionStore.getState();
    for (let i = 0; i < 50; i += 1) {
      processEvent({ type: "error" });
      const queue = useAttentionStore.getState().toastQueue;
      dismissToast(queue[queue.length - 1]!.id);
    }
    const queue = useAttentionStore.getState().toastQueue;
    expect(queue.filter((t) => t.dismissed).length).toBeLessThanOrEqual(20);
  });
});

describe("permission toasts are resolved", () => {
  beforeEach(() => {
    useAttentionStore.setState({ toastQueue: [] });
  });

  it("dismisses the agent's permission toast once the wait is over", () => {
    const store = useAttentionStore.getState();
    store.processEvent({
      type: "permission_request",
      agentId: "a",
      agentName: "A",
    });
    store.processEvent({
      type: "permission_request",
      agentId: "b",
      agentName: "B",
    });
    store.resolvePermission("a");

    const active = useAttentionStore
      .getState()
      .toastQueue.filter((t) => !t.dismissed)
      .map((t) => t.agentId);
    expect(active).toEqual(["b"]);
  });

  it("treats 'main' and no id as the boss", () => {
    const store = useAttentionStore.getState();
    store.processEvent({ type: "permission_request", agentId: null });
    store.resolvePermission("main");

    expect(
      useAttentionStore.getState().toastQueue.every((t) => t.dismissed),
    ).toBe(true);
  });
});

describe("resumed agents", () => {
  beforeEach(() => {
    useAttentionStore.setState({ toastQueue: [] });
  });

  it("says '<Name> is back'", () => {
    useAttentionStore
      .getState()
      .processEvent({
        type: "subagent_start",
        agentName: "Builder",
        resumed: true,
      });
    expect(lastToast()?.title).toBe("Builder is back");
  });
});
