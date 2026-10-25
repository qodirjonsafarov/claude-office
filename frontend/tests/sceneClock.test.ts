/**
 * One clock for the whole scene (office tint, lamps, city window): the local
 * time, or a debug override from "?time=HH:MM" / the city window's fast day.
 */
import { describe, expect, it } from "vitest";
import { createSceneClock } from "@/systems/sceneClock";

describe("scene clock", () => {
  it("starts from the URL override", () => {
    const clock = createSceneClock("?time=22:30");
    expect(clock.getState().override).toBe(22.5);
  });

  it("has no override without the parameter", () => {
    expect(createSceneClock("").getState().override).toBeNull();
    expect(createSceneClock("?time=nope").getState().override).toBeNull();
  });

  it("can be overridden and cleared (city window fast day)", () => {
    const clock = createSceneClock("");
    clock.getState().setOverride(6.25);
    expect(clock.getState().override).toBe(6.25);
    clock.getState().setOverride(null);
    expect(clock.getState().override).toBeNull();
  });
});
