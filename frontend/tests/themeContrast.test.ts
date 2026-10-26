/**
 * WCAG AA for the UI text colours of both themes, read from the one place
 * they live (styles/tokens.css): every text colour on every surface, and the
 * status colours on their own tinted chips, reach 4.5:1.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(__dirname, "../src/styles/tokens.css"), "utf8");

function block(selector: string): Map<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`no ${selector} block`);
  const body = css.slice(start, css.indexOf("\n}", start));
  const vars = new Map<string, string>();
  for (const m of body.matchAll(/--qo-([a-z0-9-]+):\s*([^;]+);/g)) {
    vars.set(m[1], m[2].trim());
  }
  return vars;
}

type Rgba = [number, number, number, number];

function parse(value: string): Rgba {
  const hex = value.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff, 1];
  }
  const rgba = value.match(/^rgba\(([^)]+)\)$/);
  if (rgba) {
    const [r, g, b, a] = rgba[1].split(",").map(Number);
    return [r, g, b, a];
  }
  throw new Error(`cannot read colour ${value}`);
}

function over(top: Rgba, bottom: Rgba): Rgba {
  const a = top[3];
  return [
    top[0] * a + bottom[0] * (1 - a),
    top[1] * a + bottom[1] * (1 - a),
    top[2] * a + bottom[2] * (1 - a),
    1,
  ];
}

function luminance([r, g, b]: Rgba): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: Rgba, b: Rgba): number {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

const dark = block(":root");
const THEMES = {
  dark,
  // The light block only overrides; the rest falls back to :root.
  light: new Map([...dark, ...block(':root[data-theme="light"]')]),
};

const TEXT = [
  "ink",
  "ink-soft",
  "ink-faint",
  "accent",
  "danger",
  "warn",
  "info",
  "max",
];
const SURFACES = ["bg", "panel", "panel-2", "panel-3"];
const STATUS = ["accent", "danger", "warn", "info", "max"];

describe.each(Object.entries(THEMES))("%s theme text contrast", (_, vars) => {
  const color = (name: string) => parse(vars.get(name) ?? "");

  it.each(TEXT)("%s reads on every surface", (text) => {
    for (const surface of SURFACES) {
      const ratio = contrast(color(text), color(surface));
      expect(ratio, `${text} on ${surface}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(STATUS)("%s reads on its own tinted chip", (status) => {
    for (const surface of ["panel", "panel-2"]) {
      const chip = over(color(`${status}-dim`), color(surface));
      const ratio = contrast(color(status), chip);
      expect(
        ratio,
        `${status} on ${status}-dim over ${surface}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("text on the accent fill reads", () => {
    expect(
      contrast(color("on-accent"), color("accent")),
    ).toBeGreaterThanOrEqual(4.5);
  });
});
