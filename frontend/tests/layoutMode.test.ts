import { describe, expect, it } from "vitest";
import { getLayoutMode } from "../src/hooks/useLayoutMode";

describe("getLayoutMode", () => {
  it("uses the desktop layout on a laptop screen", () => {
    expect(getLayoutMode(1440, 900)).toBe("desktop");
  });

  it("uses the desktop layout on a tablet in portrait", () => {
    expect(getLayoutMode(820, 1180)).toBe("desktop");
  });

  it("uses the portrait phone layout on an iPhone held upright", () => {
    expect(getLayoutMode(390, 844)).toBe("portrait");
  });

  it("uses the landscape phone layout on an iPhone turned sideways", () => {
    // 844 is wider than the 768 breakpoint, but 390 px of height cannot hold
    // the desktop header and sidebars.
    expect(getLayoutMode(844, 390)).toBe("landscape");
  });

  it("treats a narrow window as a phone even when it is wider than tall", () => {
    expect(getLayoutMode(700, 500)).toBe("landscape");
  });

  it("keeps a short but very wide desktop window on the desktop layout", () => {
    expect(getLayoutMode(1600, 480)).toBe("desktop");
  });
});
