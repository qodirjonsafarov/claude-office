/**
 * Dark / light / system theme choice: the stored value is read defensively,
 * "system" (the default) follows the OS, and the browser bar colour follows
 * the resolved theme.
 */
import { describe, expect, it } from "vitest";
import {
  parseThemePref,
  resolveTheme,
  themeColorFor,
} from "../src/systems/theme";

describe("parseThemePref", () => {
  it("keeps the three known values", () => {
    expect(parseThemePref("dark")).toBe("dark");
    expect(parseThemePref("light")).toBe("light");
    expect(parseThemePref("system")).toBe("system");
  });

  it("falls back to system for anything else", () => {
    expect(parseThemePref(null)).toBe("system");
    expect(parseThemePref(undefined)).toBe("system");
    expect(parseThemePref("sepia")).toBe("system");
  });
});

describe("resolveTheme", () => {
  it("uses the explicit choice", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("follows the OS for system", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
});

describe("themeColorFor", () => {
  it("gives the page colour of each theme (mirrors --qo-bg)", () => {
    expect(themeColorFor("dark")).toBe("#080d0c");
    expect(themeColorFor("light")).toBe("#f8faf8");
  });
});
