/**
 * What changed for an agent between two backend states: woke up from rest
 * (a resumed agent: "<Name> is back") or stopped waiting for permission
 * (its "Needs permission" toast goes away).
 */
import { describe, expect, it } from "vitest";
import { agentTransition } from "@/systems/stateReconciler";

describe("agentTransition", () => {
  it("notices an agent waking up from rest", () => {
    expect(agentTransition("resting", "working")).toEqual({
      recalled: true,
      permissionResolved: false,
    });
  });

  it("notices the end of a permission wait", () => {
    expect(agentTransition("waiting_permission", "working")).toEqual({
      recalled: false,
      permissionResolved: true,
    });
  });

  it("ignores unchanged states", () => {
    expect(agentTransition("resting", "resting")).toEqual({
      recalled: false,
      permissionResolved: false,
    });
    expect(agentTransition("waiting_permission", "waiting_permission")).toEqual(
      {
        recalled: false,
        permissionResolved: false,
      },
    );
  });
});
