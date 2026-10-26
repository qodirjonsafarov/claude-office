/**
 * The office grows with the stage: the extra canvas around the 1280x1024
 * room is furnished (kitchen, lounge, library, server corner, meeting table,
 * high windows, planters) instead of showing bare wall and floor. Nothing is
 * placed inside the room, so walking paths, desks, the boss area and the
 * elevator keep their logic.
 */
import { describe, expect, it } from "vitest";
import {
  officeWings,
  wingLights,
  type WingItem,
} from "../src/utils/officeWings";
import { sceneLayout } from "../src/utils/sceneLayout";

const ROOM = { left: 0, top: 0, right: 1280, bottom: 1024 };

/** The canvas around the room for a stage of this size (as OfficeGame does). */
function extentFor(w: number, h: number) {
  const l = sceneLayout(w, h);
  return {
    left: -l.offsetX,
    top: -l.offsetY,
    right: l.width - l.offsetX,
    bottom: l.height - l.offsetY,
  };
}

function overlaps(a: WingItem, b: WingItem): boolean {
  return (
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
  );
}

const STAGES: Array<[number, number]> = [
  [716, 674], // 1366x768 with both panels
  [790, 806], // 1440x900
  [1270, 986], // 1920x1080
  [1910, 986], // 2560x1080
  [1910, 1346], // 2560x1440
  [1920, 1080], // focus mode 1920x1080
  [2560, 1080], // focus mode 21:9
  [3840, 1080], // 32:9
  [497, 364], // phone landscape
  [600, 1400], // a tall window
];

describe("officeWings", () => {
  it("adds nothing when the canvas is just the room", () => {
    expect(officeWings(ROOM)).toEqual([]);
  });

  it("adds nothing to a strip too thin to hold furniture", () => {
    expect(officeWings({ ...ROOM, left: -30, right: 1310 })).toEqual([]);
    expect(officeWings({ ...ROOM, top: -20, bottom: 1044 })).toEqual([]);
  });

  it("never places anything inside the room", () => {
    for (const [w, h] of STAGES) {
      for (const item of officeWings(extentFor(w, h))) {
        const inside =
          item.x < 1280 &&
          item.x + item.w > 0 &&
          item.y < 1024 &&
          item.y + item.h > 0;
        expect(inside, `${w}x${h} ${item.kind}`).toBe(false);
      }
    }
  });

  it("keeps every piece on the canvas", () => {
    for (const [w, h] of STAGES) {
      const e = extentFor(w, h);
      for (const item of officeWings(e)) {
        expect(item.x).toBeGreaterThanOrEqual(e.left);
        expect(item.x + item.w).toBeLessThanOrEqual(e.right);
        expect(item.y).toBeGreaterThanOrEqual(e.top);
        expect(item.y + item.h).toBeLessThanOrEqual(e.bottom);
      }
    }
  });

  it("never stacks two pieces on each other", () => {
    for (const [w, h] of STAGES) {
      const items = officeWings(extentFor(w, h));
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          expect(
            overlaps(items[i], items[j]),
            `${w}x${h} ${items[i].kind} / ${items[j].kind}`,
          ).toBe(false);
        }
      }
    }
  });

  it("furnishes more of the office the wider the stage", () => {
    // From the room's own shape (no extra space) to 32:9
    let last = 0;
    for (let w = 1250; w <= 4000; w += 50) {
      const n = officeWings(extentFor(w, 1000)).length;
      expect(n, `width ${w}`).toBeGreaterThanOrEqual(last);
      last = n;
    }
    expect(last).toBeGreaterThanOrEqual(6);
  });

  it("puts the kitchen and the server corner next to the room first", () => {
    // 21:9 in focus mode: ~570 px of canvas on each side
    const items = officeWings(extentFor(2560, 1080));
    const kinds = items.map((i) => i.kind);
    expect(kinds).toContain("kitchen");
    expect(kinds).toContain("servers");
    expect(kinds).toContain("lounge");
    expect(kinds).toContain("meeting");
    const kitchen = items.find((i) => i.kind === "kitchen")!;
    const lounge = items.find((i) => i.kind === "lounge")!;
    expect(kitchen.side).toBe("right");
    expect(kitchen.x).toBeLessThan(lounge.x);
    const servers = items.find((i) => i.kind === "servers")!;
    expect(servers.side).toBe("left");
  });

  it("fits a zone on each side of a 16:9 screen in focus mode", () => {
    const items = officeWings(extentFor(1920, 1080));
    expect(items.find((i) => i.side === "left")?.kind).toBe("servers");
    expect(items.find((i) => i.side === "right")?.kind).toBe("kitchen");
  });

  it("gives a slim side strip a plant instead of a cramped zone", () => {
    const items = officeWings({ ...ROOM, left: -110, right: 1390 });
    expect(items.length).toBe(2);
    expect(items.every((i) => i.kind === "tallPlant")).toBe(true);
  });

  it("adds high windows above the wall and planters below on a tall stage", () => {
    const items = officeWings(extentFor(716, 674)); // ~90 px above and below
    expect(items.some((i) => i.side === "top" && i.kind === "highWindow")).toBe(
      true,
    );
    expect(items.some((i) => i.side === "bottom")).toBe(true);
  });

  it("keeps the strip under the boss desk clear", () => {
    const items = officeWings(extentFor(600, 1400));
    for (const item of items.filter((i) => i.side === "bottom")) {
      const underBoss = item.x < 820 && item.x + item.w > 460;
      expect(underBoss, item.kind).toBe(false);
    }
  });

  it("is the same for the same canvas (no flicker on re-render)", () => {
    const e = extentFor(2560, 1080);
    expect(officeWings(e)).toEqual(officeWings(e));
  });
});

describe("wingLights", () => {
  it("lights the lamps of the zones at night, inside their zone", () => {
    const items = officeWings(extentFor(2560, 1080));
    const lights = wingLights(items);
    expect(lights.length).toBeGreaterThan(0);
    for (const light of lights) {
      const home = items.some(
        (i) =>
          light.x >= i.x &&
          light.x <= i.x + i.w &&
          light.y >= i.y &&
          light.y <= i.y + i.h,
      );
      expect(home).toBe(true);
    }
  });

  it("has no lights without zones", () => {
    expect(wingLights([])).toEqual([]);
  });
});
