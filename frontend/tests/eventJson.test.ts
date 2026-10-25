/** "Copy JSON" in the event detail copies the whole event, readable. */
import { describe, expect, it } from "vitest";
import { eventJson } from "../src/utils/eventJson";

describe("eventJson", () => {
  it("has the type, person, time, summary and detail, indented", () => {
    const text = eventJson({
      id: "1",
      type: "pre_tool_use",
      agentId: "main",
      summary: "Using Bash",
      timestamp: new Date("2026-10-26T02:00:00.000Z"),
      detail: { toolName: "Bash", toolInput: { command: "ls" } },
    });
    expect(JSON.parse(text)).toEqual({
      type: "pre_tool_use",
      agentId: "main",
      timestamp: "2026-10-26T02:00:00.000Z",
      summary: "Using Bash",
      detail: { toolName: "Bash", toolInput: { command: "ls" } },
    });
    expect(text).toContain('\n  "type"');
  });
});
