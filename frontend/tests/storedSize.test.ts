/**
 * Side panel widths and the collapsed state are remembered in localStorage:
 * read back within the panel's limits, ignored when broken, and storage that
 * throws (private mode) never breaks the page.
 */
import { describe, expect, it } from "vitest";
import {
  readStoredFlag,
  readStoredSize,
  writeStoredFlag,
  writeStoredSize,
} from "../src/utils/storedSize";

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    data,
  };
}
const broken = {
  getItem: () => {
    throw new Error("denied");
  },
  setItem: () => {
    throw new Error("denied");
  },
};

describe("readStoredSize", () => {
  it("reads a stored width", () => {
    expect(readStoredSize(fakeStorage({ w: "360" }), "w", 200, 600)).toBe(360);
  });

  it("clamps it into the panel limits", () => {
    expect(readStoredSize(fakeStorage({ w: "900" }), "w", 200, 600)).toBe(600);
    expect(readStoredSize(fakeStorage({ w: "50" }), "w", 200, 600)).toBe(200);
  });

  it("gives null for nothing stored, junk or broken storage", () => {
    expect(readStoredSize(fakeStorage(), "w", 200, 600)).toBeNull();
    expect(
      readStoredSize(fakeStorage({ w: "wide" }), "w", 200, 600),
    ).toBeNull();
    expect(readStoredSize(broken, "w", 200, 600)).toBeNull();
    expect(readStoredSize(null, "w", 200, 600)).toBeNull();
  });
});

describe("writeStoredSize / flags", () => {
  it("round-trips a width and a collapsed flag", () => {
    const s = fakeStorage();
    writeStoredSize(s, "w", 333.6);
    expect(s.data.get("w")).toBe("334");
    writeStoredFlag(s, "c", true);
    expect(readStoredFlag(s, "c")).toBe(true);
    writeStoredFlag(s, "c", false);
    expect(readStoredFlag(s, "c")).toBe(false);
    expect(readStoredFlag(s, "missing")).toBeNull();
  });

  it("never throws on broken storage", () => {
    expect(() => writeStoredSize(broken, "w", 300)).not.toThrow();
    expect(() => writeStoredFlag(broken, "c", true)).not.toThrow();
    expect(readStoredFlag(broken, "c")).toBeNull();
  });
});
