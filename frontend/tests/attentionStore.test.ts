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
    expect(toast?.title).toBe("Done");
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
});
