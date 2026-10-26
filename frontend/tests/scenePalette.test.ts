/**
 * The office scene follows the UI theme: the dark green office (tint A) at
 * night-mode UI, a light daytime office in the light theme.
 */
import { describe, expect, it } from "vitest";
import { scenePalette } from "../src/systems/scenePalette";

/** The green channel outweighs blue: no more navy/teal walls. */
function greenish(color: number): boolean {
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return g > b;
}

/** Relative luminance (WCAG), 0 = black, 1 = white. */
function luminance(color: number): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * lin((color >> 16) & 0xff) +
    0.7152 * lin((color >> 8) & 0xff) +
    0.0722 * lin(color & 0xff)
  );
}

describe("scenePalette", () => {
  it("keeps the dark office on the chosen dark green (tint A)", () => {
    const p = scenePalette("dark");
    expect(p.wallTop).toBe(0x14231c);
    expect(p.wallBottom).toBe(0x22382c);
    expect(p.carpet).toBe(0x1c3024);
    expect(p.carpetBorder).toBe(0x34523c);
  });

  it("gives both themes green walls and carpet", () => {
    for (const theme of ["dark", "light"] as const) {
      const p = scenePalette(theme);
      expect(greenish(p.wallTop)).toBe(true);
      expect(greenish(p.wallBottom)).toBe(true);
      expect(greenish(p.wainscot)).toBe(true);
      expect(greenish(p.carpet)).toBe(true);
    }
  });

  it("makes the light office a bright daytime room", () => {
    const dark = scenePalette("dark");
    const light = scenePalette("light");
    for (const key of [
      "stage",
      "wallTop",
      "wallBottom",
      "wainscot",
      "carpet",
    ] as const) {
      expect(luminance(light[key])).toBeGreaterThan(0.45);
      expect(luminance(light[key])).toBeGreaterThan(luminance(dark[key]));
    }
    const avg = (xs: readonly number[]) =>
      xs.reduce((s, c) => s + luminance(c), 0) / xs.length;
    expect(avg(light.planks)).toBeGreaterThan(avg(dark.planks));
  });

  it("keeps the light stage close to the light page studio", () => {
    // tokens.css --qo-stage-top in the light theme
    expect(scenePalette("light").stage).toBe(0xe4ecdc);
  });
});
