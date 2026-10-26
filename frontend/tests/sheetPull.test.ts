/**
 * A pull down on a phone sheet closes it when pulled far enough, or flicked
 * fast; a small or slow pull springs back.
 */
import { describe, expect, it } from "vitest";
import { pullDismisses } from "../src/utils/sheetPull";

describe("pullDismisses", () => {
  it("closes after a long pull", () => {
    expect(pullDismisses(120, 900)).toBe(true);
  });

  it("closes after a short fast flick", () => {
    expect(pullDismisses(40, 50)).toBe(true);
  });

  it("springs back after a small or slow pull", () => {
    expect(pullDismisses(20, 10)).toBe(false);
    expect(pullDismisses(80, 800)).toBe(false);
  });
});
