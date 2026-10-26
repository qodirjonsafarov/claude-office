// @vitest-environment happy-dom
/**
 * The agent portrait shows the letter circle until the person's sheet has
 * loaded, then the pixel-art crop of that person; the status dot stays on
 * either.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import AgentPortrait from "../src/components/ui/AgentPortrait";
import { markSheetLoaded } from "../src/hooks/useSheetReady";
import { useAgentLooks } from "../src/stores/agentLookStore";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLElement;
beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useAgentLooks.getState().setLooks(new Map());
});

describe("AgentPortrait", () => {
  it("shows the first letter while the sheet isn't ready", () => {
    act(() =>
      root.render(
        <AgentPortrait id="a1" name="dev" color="#3b82f6" size={64} />,
      ),
    );
    const el = host.querySelector("[data-portrait]") as HTMLElement;
    expect(el.dataset.portrait).toBe("letter");
    expect(el.textContent).toBe("D");
  });

  it("shows the agent's own sheet once it is loaded", () => {
    useAgentLooks.getState().setLooks(new Map([["a1", "teal-alt"]]));
    markSheetLoaded("teal-alt");
    act(() =>
      root.render(
        <AgentPortrait id="a1" name="dev" color="#3b82f6" size={64} />,
      ),
    );
    const el = host.querySelector("[data-portrait]") as HTMLElement;
    expect(el.dataset.portrait).toBe("sprite");
    expect(el.style.backgroundImage).toContain("/sprites/people/teal-alt.png");
  });

  it("draws the boss from his own sheet", () => {
    markSheetLoaded("boss");
    act(() =>
      root.render(
        <AgentPortrait id="boss" name="Boss" color="var(--qo-max)" size={64} />,
      ),
    );
    const el = host.querySelector("[data-portrait]") as HTMLElement;
    expect(el.style.backgroundImage).toContain("/sprites/people/boss.png");
  });

  it("keeps the status dot on the portrait", () => {
    act(() =>
      root.render(
        <AgentPortrait
          id="a1"
          name="dev"
          color="#3b82f6"
          size={64}
          status="working"
        />,
      ),
    );
    expect(host.querySelector("[data-status='working']")).not.toBeNull();
  });
});
