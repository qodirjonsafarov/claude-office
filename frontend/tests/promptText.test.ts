/**
 * XML-like envelopes Claude Code puts in "user" prompts are shown as short
 * words, not raw tags.
 */
import { describe, expect, it } from "vitest";
import { cleanPromptText, cleanSummary } from "../src/utils/promptText";

describe("cleanPromptText", () => {
  it("names the agent of an agent-message when it is known", () => {
    const names = (id: string) => (id === "a3eaf17" ? "Validator V" : null);
    expect(
      cleanPromptText('<agent-message from="a3eaf17">\n[Subag...', names),
    ).toBe("Message from Validator V");
  });

  it("falls back to 'an agent' for an unknown sender", () => {
    expect(cleanPromptText('<agent-message from="zz">')).toBe(
      "Message from an agent",
    );
  });

  it("summarises a task notification", () => {
    expect(cleanPromptText("<task-notification>\n<task-id>1</task-id>")).toBe(
      "Task notification",
    );
  });

  it("turns other dashed envelopes into words", () => {
    expect(cleanPromptText("<local-command-stdout>ok")).toBe(
      "Local command stdout",
    );
  });

  it("keeps ordinary prompts", () => {
    expect(cleanPromptText("Fix the <b> tag in page.tsx")).toBe(
      "Fix the <b> tag in page.tsx",
    );
  });
});

describe("cleanSummary", () => {
  it("cleans the prompt after the User: prefix", () => {
    expect(cleanSummary('User: <agent-message from="a1">\n[Sub...')).toBe(
      "Message from an agent",
    );
  });

  it("leaves other summaries alone", () => {
    expect(cleanSummary("User: hello")).toBe("User: hello");
  });
});
