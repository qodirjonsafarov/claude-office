/**
 * Small dialog helpers shared by Modal, MobileSheet and EventDetailModal:
 * only the topmost dialog reacts to Escape, and Tab stays inside it.
 */

const DIALOGS = '[role="dialog"][aria-modal="true"]';

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/** True when no other modal dialog is open after (above) this one. */
export function isTopDialog(el: HTMLElement): boolean {
  const all = document.querySelectorAll<HTMLElement>(DIALOGS);
  return all.length === 0 || all[all.length - 1] === el;
}

/**
 * Keep Tab inside `container`: wraps at the ends and pulls focus back in.
 * Returns true when it moved the focus itself (the event is then cancelled).
 */
export function trapTab(container: HTMLElement, event: KeyboardEvent): boolean {
  if (event.key !== "Tab") return false;
  const items = Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE),
  ).filter((el) => !el.hasAttribute("inert"));
  if (items.length === 0) return false;
  const first = items[0]!;
  const last = items[items.length - 1]!;
  const active = document.activeElement;
  let target: HTMLElement | null = null;
  if (!active || !container.contains(active)) {
    target = event.shiftKey ? last : first;
  } else if (event.shiftKey && active === first) {
    target = last;
  } else if (!event.shiftKey && active === last) {
    target = first;
  }
  if (!target) return false;
  event.preventDefault();
  target.focus();
  return true;
}
