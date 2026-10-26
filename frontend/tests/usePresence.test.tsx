// @vitest-environment happy-dom
/**
 * The agent card plays a close animation: after the store closes it, the
 * last card stays on screen "leaving" for the exit time, then unmounts; a
 * new card during the exit shows at once; no exit time = gone at once
 * (reduced motion).
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePresence } from "../src/hooks/usePresence";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

/** Renders what the hook says, so the test reads it from the DOM. */
function Probe({ value, ms }: { value: string | null; ms: number }) {
  const { shown, leaving } = usePresence(value, ms);
  return <i data-shown={shown ?? ""} data-leaving={String(leaving)} />;
}

let root: Root;
let host: HTMLElement;
function seenNow(): { shown: string | null; leaving: boolean } {
  const el = host.querySelector("i");
  return {
    shown: el?.dataset.shown || null,
    leaving: el?.dataset.leaving === "true",
  };
}
beforeEach(() => {
  vi.useFakeTimers();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

describe("usePresence", () => {
  it("keeps the last value while it leaves, then drops it", () => {
    act(() => root.render(<Probe value="a" ms={200} />));
    expect(seenNow()).toEqual({ shown: "a", leaving: false });
    act(() => root.render(<Probe value={null} ms={200} />));
    expect(seenNow()).toEqual({ shown: "a", leaving: true });
    act(() => {
      vi.advanceTimersByTime(199);
    });
    expect(seenNow().shown).toBe("a");
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(seenNow()).toEqual({ shown: null, leaving: false });
  });

  it("shows a new value at once, even while leaving", () => {
    act(() => root.render(<Probe value="a" ms={200} />));
    act(() => root.render(<Probe value={null} ms={200} />));
    act(() => root.render(<Probe value="b" ms={200} />));
    expect(seenNow()).toEqual({ shown: "b", leaving: false });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(seenNow()).toEqual({ shown: "b", leaving: false });
  });

  it("drops at once without an exit time", () => {
    act(() => root.render(<Probe value="a" ms={0} />));
    act(() => root.render(<Probe value={null} ms={0} />));
    expect(seenNow()).toEqual({ shown: null, leaving: false });
  });
});
