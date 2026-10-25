/** Tool names people can read: "Browser · click", "Terminal", "Read file". */
import { describe, expect, it } from "vitest";
import { friendlyToolName, toolRowText } from "../src/utils/toolNames";

describe("friendlyToolName", () => {
  it("names the built-in tools", () => {
    expect(friendlyToolName("Bash")).toBe("Terminal");
    expect(friendlyToolName("Read")).toBe("Read file");
    expect(friendlyToolName("Edit")).toBe("Edit file");
    expect(friendlyToolName("Grep")).toBe("Search code");
  });

  it("turns the browser computer tool into its action", () => {
    expect(
      friendlyToolName("mcp__claude-in-chrome__computer", {
        action: "left_click",
      }),
    ).toBe("Browser · click");
    expect(
      friendlyToolName("mcp__claude-in-chrome__computer", { action: "type" }),
    ).toBe("Browser · type");
  });

  it("makes other MCP tools readable", () => {
    expect(friendlyToolName("mcp__claude-in-chrome__tabs_close_mcp")).toBe(
      "Browser · tabs close",
    );
    expect(friendlyToolName("mcp__claude-in-chrome__javascript_tool")).toBe(
      "Browser · javascript",
    );
    expect(friendlyToolName("mcp__my-server__do_thing")).toBe(
      "My server · do thing",
    );
  });

  it("keeps an unknown plain name", () => {
    expect(friendlyToolName("Skill")).toBe("Skill");
  });
});

describe("toolRowText", () => {
  it("adds the file name", () => {
    expect(
      toolRowText("Read", { file_path: "/home/x/frontend/src/app/page.tsx" }),
    ).toBe("Read file · page.tsx");
  });

  it("adds the last command of a chain, shortened", () => {
    expect(
      toolRowText("Bash", {
        command: "cd ~/claude-office/backend && uv run pytest -q",
      }),
    ).toBe("Terminal · uv run pytest -q");
    expect(toolRowText("Bash", { command: "x".repeat(80) })).toHaveLength(
      "Terminal · ".length + 40,
    );
  });

  it("is just the name without a target", () => {
    expect(
      toolRowText("mcp__claude-in-chrome__computer", { action: "screenshot" }),
    ).toBe("Browser · screenshot");
  });
});
