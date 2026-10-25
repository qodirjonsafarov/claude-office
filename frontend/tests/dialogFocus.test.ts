// @vitest-environment happy-dom
/**
 * Dialog helpers: only the topmost dialog reacts to Escape, and Tab stays
 * inside the open dialog.
 */
import { afterEach, describe, expect, it } from "vitest";
import { isTopDialog, trapTab } from "../src/utils/dialogFocus";

function dialog(html: string): HTMLElement {
  const el = document.createElement("div");
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.innerHTML = html;
  document.body.appendChild(el);
  return el;
}

function tab(shift = false): KeyboardEvent {
  return new KeyboardEvent("keydown", { key: "Tab", shiftKey: shift });
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("isTopDialog", () => {
  it("is true for the only dialog", () => {
    expect(isTopDialog(dialog(""))).toBe(true);
  });

  it("is false for a sheet under a modal opened from it", () => {
    const sheet = dialog("");
    const modal = dialog("");
    expect(isTopDialog(sheet)).toBe(false);
    expect(isTopDialog(modal)).toBe(true);
  });

  it("counts a dialog nested inside the sheet as on top", () => {
    const sheet = dialog(
      '<div role="dialog" aria-modal="true" id="inner"></div>',
    );
    expect(isTopDialog(sheet)).toBe(false);
  });
});

describe("trapTab", () => {
  it("wraps from the last control to the first", () => {
    const box = dialog('<button id="a"></button><button id="b"></button>');
    box.querySelector<HTMLElement>("#b")!.focus();
    const event = tab();
    expect(trapTab(box, event)).toBe(true);
    expect(document.activeElement?.id).toBe("a");
  });

  it("wraps from the first control back to the last with Shift", () => {
    const box = dialog('<button id="a"></button><button id="b"></button>');
    box.querySelector<HTMLElement>("#a")!.focus();
    expect(trapTab(box, tab(true))).toBe(true);
    expect(document.activeElement?.id).toBe("b");
  });

  it("pulls focus back in when it is outside", () => {
    const outside = document.createElement("button");
    document.body.appendChild(outside);
    const box = dialog('<button id="a"></button>');
    outside.focus();
    expect(trapTab(box, tab())).toBe(true);
    expect(document.activeElement?.id).toBe("a");
  });

  it("lets Tab move normally in the middle", () => {
    const box = dialog(
      '<button id="a"></button><button id="b"></button><button id="c"></button>',
    );
    box.querySelector<HTMLElement>("#a")!.focus();
    expect(trapTab(box, tab())).toBe(false);
  });

  it("ignores other keys", () => {
    const box = dialog('<button id="a"></button>');
    expect(trapTab(box, new KeyboardEvent("keydown", { key: "Enter" }))).toBe(
      false,
    );
  });
});
