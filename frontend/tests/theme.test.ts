/**
 * Dark / light / system theme choice (light is a draft): the stored value is
 * read defensively and "system" follows the OS.
 */
import { describe, expect, it } from "vitest";
import { parseThemePref, resolveTheme } from "../src/systems/theme";

describe("parseThemePref", () => {
  it("keeps the three known values", () => {
    expect(parseThemePref("dark")).toBe("dark");
    expect(parseThemePref("light")).toBe("light");
    expect(parseThemePref("system")).toBe("system");
  });

  it("falls back to dark for anything else", () => {
    expect(parseThemePref(null)).toBe("dark");
    expect(parseThemePref("sepia")).toBe("dark");
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
