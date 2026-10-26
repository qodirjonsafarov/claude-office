/**
 * Long-press on a character (phones): holding still for a moment opens the
 * card; moving (a pan) or lifting early does not, and the tap that ends a
 * long-press is swallowed so it cannot act twice.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLongPress, LONG_PRESS_MS } from "../src/utils/longPress";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("createLongPress", () => {
  it("fires after holding still", () => {
    const fire = vi.fn();
    const press = createLongPress(fire);
    press.down(100, 100);
    vi.advanceTimersByTime(LONG_PRESS_MS - 1);
    expect(fire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fire).toHaveBeenCalledTimes(1);
  });

  it("does not fire when lifted early", () => {
    const fire = vi.fn();
    const press = createLongPress(fire);
    press.down(100, 100);
    vi.advanceTimersByTime(200);
    expect(press.up()).toBe(false);
    vi.advanceTimersByTime(LONG_PRESS_MS);
    expect(fire).not.toHaveBeenCalled();
  });

  it("does not fire when the finger pans away", () => {
    const fire = vi.fn();
    const press = createLongPress(fire);
    press.down(100, 100);
    press.move(104, 103);
    press.move(120, 100);
    vi.advanceTimersByTime(LONG_PRESS_MS);
    expect(fire).not.toHaveBeenCalled();
  });

  it("tells the release after a long-press, so the tap is swallowed", () => {
    const press = createLongPress(() => {});
    press.down(0, 0);
    vi.advanceTimersByTime(LONG_PRESS_MS);
    expect(press.up()).toBe(true);
    press.down(0, 0);
    expect(press.up()).toBe(false);
  });

  it("cancel stops a pending press", () => {
    const fire = vi.fn();
    const press = createLongPress(fire);
    press.down(0, 0);
    press.cancel();
    vi.advanceTimersByTime(LONG_PRESS_MS);
    expect(fire).not.toHaveBeenCalled();
  });
});

describe("createLongPress.isTap", () => {
  it("accepts a tap where the finger went down", () => {
    const press = createLongPress(() => {});
    press.down(100, 100);
    press.up();
    expect(press.isTap(104, 98)).toBe(true);
  });

  it("rejects the end of a pan (the office moved under the finger)", () => {
    const press = createLongPress(() => {});
    press.down(100, 100);
    press.up();
    expect(press.isTap(170, 140)).toBe(false);
  });
});
