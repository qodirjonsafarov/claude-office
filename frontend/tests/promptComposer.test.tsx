// @vitest-environment happy-dom
/**
 * PromptComposer states: hidden without status, hints when the session cannot
 * take a message, a confirm step before the first send in a session, disabled
 * while a permission request waits, and success / error feedback.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendPrompt = vi.fn();
vi.mock("@/utils/api", () => ({
  apiFetch: vi.fn(),
  sendPrompt: (...args: unknown[]) => sendPrompt(...args),
}));

import { PromptComposer } from "../src/components/layout/PromptComposer";
import { useChatStore } from "../src/stores/chatStore";
import { useGameStore } from "../src/stores/gameStore";
import type { ChatStatus } from "../src/types/generated";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const SESSION = "f30de6f5-e4eb-4a48-bc8e-fcb70b2b102b";

let root: Root;
let host: HTMLElement;

function render(status: ChatStatus | null): void {
  act(() => {
    useChatStore.getState().setStatus(status, SESSION);
  });
  act(() => root.render(<PromptComposer />));
}

function textarea(): HTMLTextAreaElement | null {
  return host.querySelector("textarea");
}

function button(name: string): HTMLButtonElement | undefined {
  return [...host.querySelectorAll("button")].find(
    (b) =>
      (b.getAttribute("aria-label") ?? b.textContent ?? "").trim() === name,
  );
}

function type(text: string): void {
  const el = textarea()!;
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )!.set!;
    setter.call(el, text);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function click(name: string): Promise<void> {
  const b = button(name);
  expect(b, `button ${name}`).toBeDefined();
  await act(async () => {
    b!.click();
  });
}

beforeEach(() => {
  localStorage.clear();
  sendPrompt.mockReset();
  useChatStore.setState({ status: null, sessionId: null, confirmed: [] });
  useGameStore.setState({ sessionId: SESSION });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const CAN_SEND: ChatStatus = {
  canSend: true,
  reason: null,
  label: "claude-office",
};

describe("PromptComposer", () => {
  it("renders nothing without a chat status", () => {
    render(null);
    expect(host.textContent).toBe("");
  });

  it("ignores a status left from another session", () => {
    act(() => {
      useChatStore.getState().setStatus(CAN_SEND, "previous-session");
    });
    act(() => root.render(<PromptComposer />));
    expect(textarea()).toBeNull();
  });

  it("explains that chat is off", () => {
    render({ canSend: false, reason: "disabled" });
    expect(host.textContent).toContain("Chat is off (ENABLE_WEB_PROMPT)");
    expect(textarea()).toBeNull();
  });

  it("explains how to chat when Claude is not in tmux", () => {
    render({ canSend: false, reason: "no_tmux" });
    expect(host.textContent).toContain(
      "Not in tmux — start Claude inside tmux (Termius does this) to chat from here",
    );
    expect(textarea()).toBeNull();
  });

  it("says when the pane does not run Claude", () => {
    render({ canSend: false, reason: "not_claude" });
    expect(host.textContent).toContain("not running Claude");
    expect(textarea()).toBeNull();
  });

  it("shows the composer when the session can take a message", () => {
    render(CAN_SEND);
    expect(textarea()).not.toBeNull();
    expect(button("Send")?.disabled).toBe(true); // nothing typed yet
    type("hello");
    expect(button("Send")?.disabled).toBe(false);
  });

  it("asks to confirm the first send with project, session and preview", async () => {
    sendPrompt.mockResolvedValue({ ok: true });
    render(CAN_SEND);
    type("deploy the fix");
    await click("Send");

    expect(sendPrompt).not.toHaveBeenCalled();
    const dialog = host.querySelector('[role="alertdialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog!.textContent).toContain("claude-office");
    expect(dialog!.textContent).toContain(SESSION.slice(0, 8));
    expect(dialog!.textContent).toContain("deploy the fix");

    await click("Send to terminal");
    expect(sendPrompt).toHaveBeenCalledWith(SESSION, "deploy the fix");
    expect(host.textContent).toContain("Sent");
    expect(textarea()!.value).toBe("");
  });

  it("cancel keeps the text and sends nothing", async () => {
    render(CAN_SEND);
    type("draft");
    await click("Send");
    await click("Cancel");
    expect(sendPrompt).not.toHaveBeenCalled();
    expect(host.querySelector('[role="alertdialog"]')).toBeNull();
    expect(textarea()!.value).toBe("draft");
  });

  it("remembers the confirmation per session", async () => {
    sendPrompt.mockResolvedValue({ ok: true });
    render(CAN_SEND);
    type("one");
    await click("Send");
    await click("Send to terminal");

    type("two");
    await click("Send");
    expect(host.querySelector('[role="alertdialog"]')).toBeNull();
    expect(sendPrompt).toHaveBeenLastCalledWith(SESSION, "two");
    expect(
      JSON.parse(localStorage.getItem("claude-office-chat-confirmed")!),
    ).toContain(SESSION);
  });

  it("asks again in another session", async () => {
    useChatStore.setState({ confirmed: ["other-session"] });
    render(CAN_SEND);
    type("hi");
    await click("Send");
    expect(host.querySelector('[role="alertdialog"]')).not.toBeNull();
  });

  it("is disabled while a permission request is pending", () => {
    render({
      canSend: false,
      reason: "permission_pending",
      label: "claude-office",
    });
    expect(textarea()?.disabled).toBe(true);
    expect(button("Send")?.disabled).toBe(true);
    expect(host.textContent).toContain("permission");
  });

  it("shows the backend's error and keeps the text", async () => {
    useChatStore.setState({ confirmed: [SESSION] });
    sendPrompt.mockResolvedValue({
      ok: false,
      reason: "pane_gone",
      message: "The tmux pane is gone",
    });
    render(CAN_SEND);
    type("still here");
    await click("Send");
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      "The tmux pane is gone",
    );
    expect(textarea()!.value).toBe("still here");
  });
});
