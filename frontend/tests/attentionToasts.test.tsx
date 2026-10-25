// @vitest-environment happy-dom
/**
 * Toast auto-dismiss: the timer must survive parent re-renders (the parent
 * used to pass a fresh onDismiss arrow each render, which reset the timer).
 */
import { act, useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/utils/api", () => ({ apiFetch: vi.fn() }));

import AttentionToasts from "../src/components/attention/AttentionToasts";
import { useAttentionStore } from "../src/stores/attentionStore";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

/** Re-renders the toasts every 200 ms, like the live page does. */
function Churn(): React.ReactNode {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 200);
    return () => clearInterval(id);
  }, []);
  return <AttentionToasts />;
}

let root: Root;
let host: HTMLElement;

beforeEach(() => {
  vi.useFakeTimers();
  useAttentionStore.setState({ toastQueue: [] });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

describe("AttentionToasts", () => {
  it("auto-dismisses a toast while the parent keeps re-rendering", () => {
    act(() => root.render(<Churn />));
    act(() => {
      useAttentionStore.getState().processEvent({ type: "stop" });
    });
    const toast = useAttentionStore.getState().toastQueue[0];
    expect(toast?.autoDismissMs).toBeGreaterThan(0);
    // Step in small slices so each re-render commits between timer ticks.
    const end = (toast?.autoDismissMs ?? 0) + 400;
    for (let t = 0; t < end; t += 100) {
      act(() => {
        vi.advanceTimersByTime(100);
      });
    }
    expect(useAttentionStore.getState().toastQueue[0]?.dismissed).toBe(true);
  });
});
