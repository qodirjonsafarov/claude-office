/**
 * The office tint preview: the studio and the walls are green in the Olymp
 * look; `?tint=b` switches to the more lime variant for side-by-side shots.
 */
import { describe, expect, it } from "vitest";
import { parseSceneTint, scenePalette } from "../src/systems/sceneTint";

describe("parseSceneTint", () => {
  it("defaults to the subtle dark green variant", () => {
    expect(parseSceneTint("")).toBe("a");
    expect(parseSceneTint("?foo=1")).toBe("a");
  });

  it("reads the lime variant from ?tint=b", () => {
    expect(parseSceneTint("?tint=b")).toBe("b");
    expect(parseSceneTint("?x=1&tint=B")).toBe("b");
  });

  it("ignores unknown values", () => {
    expect(parseSceneTint("?tint=teal")).toBe("a");
  });
});

/** The green channel outweighs blue: no more navy/teal walls. */
function greenish(color: number): boolean {
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return g > b;
}

describe("scenePalette", () => {
  it("gives both variants green walls and carpet", () => {
    for (const tint of ["a", "b"] as const) {
      const p = scenePalette(tint);
      expect(greenish(p.wallTop)).toBe(true);
      expect(greenish(p.wallBottom)).toBe(true);
      expect(greenish(p.wainscot)).toBe(true);
      expect(greenish(p.carpet)).toBe(true);
    }
  });

  it("makes the two variants differ", () => {
    expect(scenePalette("a").carpet).not.toBe(scenePalette("b").carpet);
  });
});
