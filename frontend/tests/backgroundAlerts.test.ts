/**
 * Background alerts: while the tab is hidden, "Claude finished", "needs
 * permission" and "a subagent finished" become a browser notification and a
 * count in the tab title.
 */
import { describe, expect, it } from "vitest";
import {
  backgroundAlertFor,
  badgeTitle,
  BackgroundAlerts,
} from "../src/utils/backgroundAlerts";

describe("backgroundAlertFor", () => {
  it("says Claude finished on stop", () => {
    expect(backgroundAlertFor({ type: "stop", summary: "" })?.title).toBe(
      "Claude finished",
    );
  });

  it("names the agent that needs permission", () => {
    const alert = backgroundAlertFor({
      type: "permission_request",
      summary: "Bash: npm test",
      agentName: "Tester",
    });
    expect(alert?.title).toBe("Tester needs permission");
    expect(alert?.body).toBe("Bash: npm test");
  });

  it("says which subagent finished", () => {
    expect(
      backgroundAlertFor({
        type: "subagent_stop",
        summary: "",
        agentName: "Reviewer",
      })?.title,
    ).toBe("Reviewer finished");
  });

  it("ignores everyday events", () => {
    expect(backgroundAlertFor({ type: "pre_tool_use", summary: "" })).toBe(
      null,
    );
  });
});

describe("badgeTitle", () => {
  it("prefixes the count", () => {
    expect(badgeTitle("Claude Office", 3)).toBe("(3) Claude Office");
  });

  it("leaves the title alone at zero", () => {
    expect(badgeTitle("Claude Office", 0)).toBe("Claude Office");
  });
});

/** A fake page: visibility, title and a notification sink. */
function fakeEnv(hidden: boolean) {
  const shown: { title: string; body: string }[] = [];
  const env = {
    hidden,
    title: "Claude Office",
    permission: "granted" as NotificationPermission,
    notify: (title: string, body: string) => shown.push({ title, body }),
  };
  return { env, shown };
}

describe("BackgroundAlerts", () => {
  it("notifies and badges the title while hidden", () => {
    const { env, shown } = fakeEnv(true);
    const alerts = new BackgroundAlerts(env);
    alerts.onEvent({ type: "stop", summary: "" });
    alerts.onEvent({ type: "subagent_stop", summary: "", agentName: "A" });
    expect(shown.map((s) => s.title)).toEqual([
      "Claude finished",
      "A finished",
    ]);
    expect(env.title).toBe("(2) Claude Office");
  });

  it("stays quiet while the tab is visible", () => {
    const { env, shown } = fakeEnv(false);
    new BackgroundAlerts(env).onEvent({ type: "stop", summary: "" });
    expect(shown).toEqual([]);
    expect(env.title).toBe("Claude Office");
  });

  it("only badges the title without notification permission", () => {
    const { env, shown } = fakeEnv(true);
    env.permission = "default";
    new BackgroundAlerts(env).onEvent({ type: "stop", summary: "" });
    expect(shown).toEqual([]);
    expect(env.title).toBe("(1) Claude Office");
  });

  it("clears the badge when the tab is shown again", () => {
    const { env } = fakeEnv(true);
    const alerts = new BackgroundAlerts(env);
    alerts.onEvent({ type: "stop", summary: "" });
    env.hidden = false;
    alerts.onVisible();
    expect(env.title).toBe("Claude Office");
  });

  it("keeps a title the page changed meanwhile", () => {
    const { env } = fakeEnv(true);
    const alerts = new BackgroundAlerts(env);
    alerts.onEvent({ type: "stop", summary: "" });
    env.title = "(1) Renamed";
    alerts.onEvent({ type: "stop", summary: "" });
    expect(env.title).toBe("(2) Renamed");
    alerts.onVisible();
    expect(env.title).toBe("Renamed");
  });
});
