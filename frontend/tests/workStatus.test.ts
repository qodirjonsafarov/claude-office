import { describe, expect, it } from "vitest";
import { countWorking, isAgentBusy, isBossBusy } from "../src/utils/workStatus";

describe("isBossBusy", () => {
  it("is false while the boss is idle", () => {
    expect(isBossBusy("idle")).toBe(false);
  });

  it("is true while the boss works, delegates or waits for permission", () => {
    expect(isBossBusy("working")).toBe(true);
    expect(isBossBusy("delegating")).toBe(true);
    expect(isBossBusy("waiting_permission")).toBe(true);
  });
});

describe("isAgentBusy", () => {
  it("is true for an agent that is working or thinking", () => {
    expect(isAgentBusy("working", false)).toBe(true);
    expect(isAgentBusy("thinking", false)).toBe(true);
  });

  it("is true for an agent that is typing whatever its backend state", () => {
    expect(isAgentBusy("waiting", true)).toBe(true);
  });

  it("is false for an agent that arrives, waits or has finished", () => {
    expect(isAgentBusy("arriving", false)).toBe(false);
    expect(isAgentBusy("waiting", false)).toBe(false);
    expect(isAgentBusy("completed", false)).toBe(false);
  });
});

describe("countWorking", () => {
  it("counts the boss and every busy agent", () => {
    expect(
      countWorking("working", [
        { backendState: "working", isTyping: false },
        { backendState: "completed", isTyping: false },
        { backendState: "waiting", isTyping: true },
      ]),
    ).toBe(3);
  });

  it("is zero for an idle office", () => {
    expect(countWorking("idle", [])).toBe(0);
  });
});
