// @vitest-environment happy-dom
/**
 * A long-press on a character opens its card and swallows the tap that ends
 * it, but never the next real tap. Pixi v8 fires pointertap from its own
 * capture-phase window pointerup, i.e. before our window pointerup listener,
 * so both orders must work.
 */
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { FederatedPointerEvent } from "pixi.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LONG_PRESS_MS } from "../src/utils/longPress";

vi.mock("@/stores/sceneViewStore", () => ({
  sceneToClient: (x: number, y: number) => ({ x, y }),
}));

const { useCharacterPress } = await import("../src/hooks/useCharacterPress");
const { useAttentionStore } = await import("../src/stores/attentionStore");
const { usePreferencesStore } = await import("../src/stores/preferencesStore");

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

type Press = ReturnType<typeof useCharacterPress>;
type Handlers = Extract<Press, { interactive: true }>;
let press: Press;
function Probe({ onRender }: { onRender: (p: Press) => void }) {
  const current = useCharacterPress("agent-1", { x: 10, y: 20 });
  useEffect(() => onRender(current));
  return null;
}

const ev = (pointerType = "touch") =>
  ({ pointerType, clientX: 5, clientY: 5 }) as unknown as FederatedPointerEvent;
const handlers = () => press as Handlers;
const liftOnWindow = () =>
  act(() => {
    window.dispatchEvent(new Event("pointerup"));
  });

let root: Root;
let host: HTMLElement;
const opened = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  opened.mockClear();
  usePreferencesStore.setState({ clickToFocusEnabled: true });
  useAttentionStore.setState({ openFocusPopup: opened });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() =>
    root.render(
      <Probe
        onRender={(p) => {
          press = p;
        }}
      />,
    ),
  );
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

function longPress(tapFirst: boolean) {
  act(() => handlers().onPointerDown(ev()));
  act(() => {
    vi.advanceTimersByTime(LONG_PRESS_MS + 10);
  });
  if (tapFirst) {
    act(() => handlers().onPointerTap(ev()));
    liftOnWindow();
  } else {
    liftOnWindow();
    act(() => handlers().onPointerTap(ev()));
  }
}

function tap() {
  act(() => handlers().onPointerDown(ev()));
  act(() => handlers().onPointerTap(ev()));
  liftOnWindow();
}

describe("useCharacterPress", () => {
  it.each([
    ["Pixi order (tap before the window pointerup)", true],
    ["window pointerup first", false],
  ])("a long-press opens the card once: %s", (_name, tapFirst) => {
    longPress(tapFirst);
    expect(opened).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["Pixi order (tap before the window pointerup)", true],
    ["window pointerup first", false],
  ])("the next real tap after a long-press opens it: %s", (_name, tapFirst) => {
    longPress(tapFirst);
    opened.mockClear();
    tap();
    expect(opened).toHaveBeenCalledTimes(1);
  });

  it("a mouse click opens it", () => {
    act(() => handlers().onPointerDown(ev("mouse")));
    act(() => handlers().onPointerTap(ev("mouse")));
    expect(opened).toHaveBeenCalledTimes(1);
  });
});
