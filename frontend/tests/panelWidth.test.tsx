// @vitest-environment happy-dom
/**
 * Side panels take a share of the window instead of a fixed width: slimmer
 * on a small or zoomed-in window (the office gets the room), wider on a big
 * screen, inside their limits. A width the user dragged is kept as is.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fluidPanelWidth } from "../src/utils/panelWidth";
import { useDragResize } from "../src/hooks/useDragResize";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const LEFT = { min: 220, share: 0.15, max: 380 };

describe("fluidPanelWidth", () => {
  it("takes its share of the window", () => {
    expect(fluidPanelWidth(1920, LEFT)).toBe(288);
  });

  it("never goes below its minimum on a small or zoomed-in window", () => {
    expect(fluidPanelWidth(1280, LEFT)).toBe(220);
    expect(fluidPanelWidth(600, LEFT)).toBe(220);
  });

  it("never grows past its maximum on a huge window", () => {
    expect(fluidPanelWidth(2866, LEFT)).toBe(380);
    expect(fluidPanelWidth(5120, LEFT)).toBe(380);
  });

  it("falls back to the minimum without a window size", () => {
    expect(fluidPanelWidth(0, LEFT)).toBe(220);
    expect(fluidPanelWidth(Number.NaN, LEFT)).toBe(220);
  });
});

function Probe({ storageKey }: { storageKey: string }) {
  const { size } = useDragResize({
    initialSize: () => fluidPanelWidth(window.innerWidth, LEFT),
    minSize: 200,
    maxSize: 600,
    direction: "horizontal",
    storageKey,
  });
  return <i data-size={size} />;
}

let root: Root;
let host: HTMLElement;
const seen = () => Number(host.querySelector("i")?.dataset.size);
function resizeTo(w: number) {
  act(() => {
    Object.defineProperty(window, "innerWidth", {
      value: w,
      configurable: true,
    });
    window.dispatchEvent(new Event("resize"));
  });
}

beforeEach(() => {
  localStorage.clear();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("useDragResize with a fluid default", () => {
  it("starts at the share of the window and follows it", () => {
    resizeTo(1920);
    act(() => root.render(<Probe storageKey="t-fluid" />));
    expect(seen()).toBe(288);
    resizeTo(1280);
    expect(seen()).toBe(220);
    resizeTo(2560);
    expect(seen()).toBe(380);
  });

  it("keeps a width the user dragged (remembered) on resize", () => {
    localStorage.setItem("t-kept", "333");
    resizeTo(1920);
    act(() => root.render(<Probe storageKey="t-kept" />));
    expect(seen()).toBe(333);
    resizeTo(1280);
    expect(seen()).toBe(333);
  });
});

function HandleProbe({ storageKey }: { storageKey: string }) {
  const { size, handleDragStart } = useDragResize({
    initialSize: () => fluidPanelWidth(window.innerWidth, LEFT),
    minSize: 200,
    maxSize: 600,
    direction: "horizontal",
    storageKey,
  });
  return <i data-size={size} onMouseDown={handleDragStart} />;
}

function mouse(type: string, target: EventTarget, clientX: number) {
  act(() => {
    target.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX }));
  });
}

describe("useDragResize handle", () => {
  it("a click without a move keeps the fluid default and saves nothing", () => {
    resizeTo(1920);
    act(() => root.render(<HandleProbe storageKey="t-click" />));
    const handle = host.querySelector("i")!;
    mouse("mousedown", handle, 300);
    mouse("mouseup", document, 300);

    expect(localStorage.getItem("t-click")).toBeNull();
    resizeTo(1280);
    expect(seen()).toBe(220);
  });

  it("a drag saves the new size and stops following the window", () => {
    resizeTo(1920);
    act(() => root.render(<HandleProbe storageKey="t-drag" />));
    const handle = host.querySelector("i")!;
    mouse("mousedown", handle, 300);
    mouse("mousemove", document, 340);
    mouse("mouseup", document, 340);

    expect(localStorage.getItem("t-drag")).toBe("328");
    resizeTo(1280);
    expect(seen()).toBe(328);
  });
});
