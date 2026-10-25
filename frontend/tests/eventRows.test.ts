/** Event log rows: one row per tool call, readable texts. */
import { describe, expect, it } from "vitest";
import { eventText, groupToolCalls } from "../src/utils/eventRows";

interface E {
  id: string;
  type: string;
  agentId?: string | null;
  summary: string;
  detail?: { toolName?: string; agentName?: string } | null;
}

let n = 0;
function e(type: string, agentId: string, toolName?: string): E {
  n += 1;
  return {
    id: String(n),
    type,
    agentId,
    summary: `${type} ${n}`,
    detail: toolName ? { toolName } : {},
  };
}

describe("groupToolCalls", () => {
  it("joins a pre and its post into one row (log is newest first)", () => {
    const pre = e("pre_tool_use", "main", "Bash");
    const post = e("post_tool_use", "main", "Bash");
    const rows = groupToolCalls([post, pre]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "tool", pre, post });
  });

  it("keeps a running call (no post yet) as its own row", () => {
    const pre = e("pre_tool_use", "main", "Read");
    expect(groupToolCalls([pre])).toEqual([
      { kind: "tool", key: expect.any(String), pre, post: null },
    ]);
  });

  it("pairs calls per person, even when they interleave", () => {
    const bossPre = e("pre_tool_use", "main", "Bash");
    const agentPre = e("pre_tool_use", "a1", "Read");
    const bossPost = e("post_tool_use", "main", "Bash");
    const agentPost = e("post_tool_use", "a1");
    const rows = groupToolCalls([agentPost, bossPost, agentPre, bossPre]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ pre: agentPre, post: agentPost });
    expect(rows[1]).toMatchObject({ pre: bossPre, post: bossPost });
  });

  it("matches the tool name when calls run in parallel", () => {
    const readPre = e("pre_tool_use", "main", "Read");
    const grepPre = e("pre_tool_use", "main", "Grep");
    const readPost = e("post_tool_use", "main", "Read");
    const grepPost = e("post_tool_use", "main", "Grep");
    const rows = groupToolCalls([grepPost, readPost, grepPre, readPre]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ pre: grepPre, post: grepPost });
    expect(rows[1]).toMatchObject({ pre: readPre, post: readPost });
  });

  it("leaves other events as they are", () => {
    const stop = e("stop", "main");
    expect(groupToolCalls([stop])).toEqual([
      { kind: "event", key: expect.any(String), event: stop },
    ]);
  });
});

describe("eventText", () => {
  it("names a finished subagent", () => {
    expect(
      eventText({
        type: "subagent_stop",
        summary: "Subagent subagent_a3eaf finished successfully",
        detail: { agentName: "Validator V" },
      }),
    ).toBe("Validator V finished");
  });

  it("hides a raw subagent id it cannot name", () => {
    expect(
      eventText({
        type: "subagent_stop",
        summary: "Subagent subagent_a3eaf finished successfully",
      }),
    ).toBe("An agent finished");
  });

  it("summarises an envelope prompt", () => {
    expect(
      eventText({
        type: "user_prompt_submit",
        summary: 'User: <agent-message from="a3">\n[Sub...',
      }),
    ).toBe("Message from an agent");
  });
});

describe("groupToolCalls row keys", () => {
  it("are unique even when events share a timestamp id", () => {
    const same = "1792969161.210412";
    const rows = groupToolCalls([
      { id: same, type: "user_prompt_submit", agentId: "main", summary: "a" },
      { id: same, type: "subagent_start", agentId: "x", summary: "b" },
      { id: same, type: "subagent_start", agentId: "x", summary: "c" },
      { id: same, type: "pre_tool_use", agentId: "y", summary: "d" },
    ]);
    const keys = rows.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("keeps the same key for the same row on the next render", () => {
    const log = [
      { id: "1", type: "stop", agentId: "main", summary: "a" },
      { id: "1", type: "stop", agentId: "main", summary: "b" },
    ];
    expect(groupToolCalls(log).map((r) => r.key)).toEqual(
      groupToolCalls(log).map((r) => r.key),
    );
  });
});
