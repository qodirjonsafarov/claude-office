// @vitest-environment happy-dom
/**
 * Focus mode: the office fills the whole window (header and side panels
 * hidden, the browser's fullscreen where it is allowed). F toggles it, Esc
 * leaves it, leaving the browser's fullscreen leaves it too. It always
 * starts off (not remembered). F typed into a field is just a letter.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { focusKeyAction } from "../src/utils/focusMode";
import { useFocusMode } from "../src/hooks/useFocusMode";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const key = (
  k: string,
  extra: Partial<Parameters<typeof focusKeyAction>[0]> = {},
) => ({
  key: k,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  editing: false,
  dialogOpen: false,
  ...extra,
});

describe("focusKeyAction", () => {
  it("toggles on F, either case", () => {
    expect(focusKeyAction(key("f"), false)).toBe("toggle");
    expect(focusKeyAction(key("F"), true)).toBe("toggle");
  });

  it("leaves on Esc only while focused", () => {
    expect(focusKeyAction(key("Escape"), true)).toBe("exit");
    expect(focusKeyAction(key("Escape"), false)).toBeNull();
  });

  it("ignores F typed into a field or with a modifier (Ctrl+F is find)", () => {
    expect(focusKeyAction(key("f", { editing: true }), false)).toBeNull();
    expect(focusKeyAction(key("f", { ctrlKey: true }), false)).toBeNull();
    expect(focusKeyAction(key("f", { metaKey: true }), false)).toBeNull();
    expect(focusKeyAction(key("f", { altKey: true }), false)).toBeNull();
  });

  it("leaves keys to an open dialog (its Esc closes the dialog)", () => {
    expect(focusKeyAction(key("f", { dialogOpen: true }), false)).toBeNull();
    expect(
      focusKeyAction(key("Escape", { dialogOpen: true }), true),
    ).toBeNull();
  });
});

function Probe({ enabled = true }: { enabled?: boolean }) {
  const { focused, toggle, exit } = useFocusMode(enabled);
  return (
    <>
      <i data-focused={String(focused)} />
      <button data-act="toggle" onClick={toggle} />
      <button data-act="exit" onClick={exit} />
    </>
  );
}

let root: Root;
let host: HTMLElement;
let fullscreenEl: Element | null;
const focusedNow = () =>
  host.querySelector("i")?.getAttribute("data-focused") === "true";
const press = (k: string, target: EventTarget = window) =>
  act(() => {
    target.dispatchEvent(
      new KeyboardEvent("keydown", { key: k, bubbles: true }),
    );
  });

beforeEach(() => {
  fullscreenEl = null;
  Object.defineProperty(document, "fullscreenElement", {
    configurable: true,
    get: () => fullscreenEl,
  });
  document.documentElement.requestFullscreen = vi.fn(async () => {
    fullscreenEl = document.documentElement;
    document.dispatchEvent(new Event("fullscreenchange"));
  });
  document.exitFullscreen = vi.fn(async () => {
    fullscreenEl = null;
    document.dispatchEvent(new Event("fullscreenchange"));
  });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(<Probe />));
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("useFocusMode", () => {
  it("starts off", () => {
    expect(focusedNow()).toBe(false);
  });

  it("F enters focus and asks the browser for fullscreen; F again leaves", async () => {
    press("f");
    expect(focusedNow()).toBe(true);
    expect(document.documentElement.requestFullscreen).toHaveBeenCalled();
    press("f");
    expect(focusedNow()).toBe(false);
    expect(document.exitFullscreen).toHaveBeenCalled();
  });

  it("Esc leaves focus", () => {
    press("f");
    press("Escape");
    expect(focusedNow()).toBe(false);
  });

  it("leaving the browser's fullscreen (its own Esc) leaves focus", async () => {
    press("f");
    await act(async () => {
      await Promise.resolve();
    });
    expect(fullscreenEl).not.toBeNull();
    await act(async () => {
      fullscreenEl = null;
      document.dispatchEvent(new Event("fullscreenchange"));
    });
    expect(focusedNow()).toBe(false);
  });

  it("works without the Fullscreen API (the office fills the window)", () => {
    // @ts-expect-error: a browser without the API
    document.documentElement.requestFullscreen = undefined;
    press("f");
    expect(focusedNow()).toBe(true);
    press("Escape");
    expect(focusedNow()).toBe(false);
  });

  it("a refused fullscreen keeps focus mode in the window", async () => {
    document.documentElement.requestFullscreen = vi.fn(() =>
      Promise.reject(new Error("not allowed")),
    );
    press("f");
    await act(async () => {
      await Promise.resolve();
    });
    expect(focusedNow()).toBe(true);
  });

  it("F typed into an input does nothing", () => {
    const input = document.createElement("input");
    document.body.appendChild(input);
    press("f", input);
    expect(focusedNow()).toBe(false);
    input.remove();
  });

  it("the header button toggles and the exit button leaves", () => {
    act(() =>
      host.querySelector<HTMLButtonElement>("[data-act=toggle]")!.click(),
    );
    expect(focusedNow()).toBe(true);
    act(() =>
      host.querySelector<HTMLButtonElement>("[data-act=exit]")!.click(),
    );
    expect(focusedNow()).toBe(false);
  });

  it("is off on the phone layout (no header, no keys)", () => {
    press("f");
    expect(focusedNow()).toBe(true);
    act(() => root.render(<Probe enabled={false} />));
    expect(focusedNow()).toBe(false);
    press("f");
    expect(focusedNow()).toBe(false);
  });
});
