/**
 * Only the hands go onto the desk: from a seated frame, keep the skin
 * pixels in the hands crop (skin = the colours shared with the face) and the
 * outline around them; the lap, the trousers and the shirt stay under the
 * desk. Works for any look (skin, shirt and trousers colours differ).
 */
import { describe, expect, it } from "vitest";
import { extractHands } from "../src/systems/handsMask";
import { HANDS_CROP } from "../src/systems/handsOnDesk";

const W = 64;
const H = 64;
type RGBA = [number, number, number, number];
const SKIN: RGBA = [222, 170, 130, 255];
const SKIN_SHADE: RGBA = [190, 140, 100, 255];
const OUTLINE: RGBA = [20, 14, 20, 255];
const SHIRT: RGBA = [60, 90, 200, 255];
const PANTS: RGBA = [60, 90, 200, 255]; // same blue as the shirt (blue look)
const HAIR: RGBA = [120, 50, 20, 255];
const GREY: RGBA = [120, 120, 130, 255]; // glasses and the trousers' seam

function frame(): Uint8ClampedArray {
  const data = new Uint8ClampedArray(W * H * 4);
  const put = (x: number, y: number, c: RGBA) => data.set(c, (y * W + x) * 4);
  const fill = (x0: number, y0: number, x1: number, y1: number, c: RGBA) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(x, y, c);
  };
  fill(24, 10, 40, 15, HAIR);
  fill(24, 16, 40, 30, SKIN); // face
  fill(26, 28, 38, 30, SKIN_SHADE);
  fill(22, 31, 42, 47, SHIRT); // torso and sleeves
  fill(22, 48, 42, 55, PANTS); // lap and legs
  fill(26, 44, 37, 48, SKIN); // hands on the lap
  fill(26, 48, 37, 48, SKIN_SHADE);
  fill(28, 20, 36, 20, GREY); // glasses
  fill(24, 51, 40, 51, GREY); // trousers' seam under the hands
  fill(22, 56, 42, 58, GREY); // and down the legs
  // outline around the hands and the body edge
  for (let x = 25; x <= 38; x++) put(x, 49, OUTLINE);
  for (let y = 31; y <= 55; y++) {
    put(21, y, OUTLINE);
    put(43, y, OUTLINE);
  }
  return data;
}

const at = (d: Uint8ClampedArray, x: number, y: number) =>
  Array.from(d.slice((y * W + x) * 4, (y * W + x) * 4 + 4));

describe("extractHands", () => {
  const src = frame();
  const out = extractHands({ data: src, width: W, height: H }, [
    { x: 0, y: 0 },
  ]);

  it("keeps the hands", () => {
    expect(at(out, 30, 45)).toEqual(SKIN);
    expect(at(out, 30, 48)).toEqual(SKIN_SHADE);
  });

  it("keeps the outline right around the hands", () => {
    expect(at(out, 30, 49)).toEqual(OUTLINE);
  });

  it("drops a trousers colour even when the face has it too (glasses)", () => {
    expect(at(out, 30, 51)[3]).toBe(0);
  });

  it("drops the trousers, the shirt and the body's edge", () => {
    expect(at(out, 30, 52)[3]).toBe(0);
    expect(at(out, 23, 50)[3]).toBe(0);
    expect(at(out, 23, 44)[3]).toBe(0);
    expect(at(out, 43, 50)[3]).toBe(0);
  });

  it("leaves everything outside the hands crop out (the face)", () => {
    expect(at(out, 30, 20)[3]).toBe(0);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const inCrop =
          x >= HANDS_CROP.x &&
          x < HANDS_CROP.x + HANDS_CROP.w &&
          y >= HANDS_CROP.y &&
          y < HANDS_CROP.y + HANDS_CROP.h;
        if (!inCrop) expect(at(out, x, y)[3]).toBe(0);
      }
    }
  });

  it("does not touch the source", () => {
    expect(at(src, 30, 52)).toEqual(PANTS);
  });

  it("works per cell at its own place in the sheet", () => {
    const sheet = new Uint8ClampedArray(W * 2 * H * 4);
    for (let y = 0; y < H; y++) {
      sheet.set(src.slice(y * W * 4, (y + 1) * W * 4), (y * W * 2 + W) * 4);
    }
    const res = extractHands({ data: sheet, width: W * 2, height: H }, [
      { x: W, y: 0 },
    ]);
    const px = (x: number, y: number) =>
      Array.from(res.slice((y * W * 2 + x) * 4, (y * W * 2 + x) * 4 + 4));
    expect(px(W + 30, 45)).toEqual(SKIN);
    expect(px(30, 45)[3]).toBe(0);
  });
});
