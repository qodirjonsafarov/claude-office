/**
 * The PWA manifest must be static (the app is built with `output: "export"`,
 * where a dynamic manifest route returns 500) and offer each icon both as
 * "any" and as "maskable".
 */
import { describe, expect, it } from "vitest";
import manifest, { dynamic } from "@/app/manifest";

describe("PWA manifest", () => {
  it("is generated statically", () => {
    expect(dynamic).toBe("force-static");
  });

  it("has every icon size for 'any' and for 'maskable'", () => {
    const icons = manifest().icons ?? [];
    for (const size of ["192x192", "512x512"]) {
      const purposes = icons
        .filter((i) => i.sizes === size)
        .map((i) => i.purpose);
      expect(purposes).toContain("any");
      expect(purposes).toContain("maskable");
    }
  });
});
