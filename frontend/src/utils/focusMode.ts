/**
 * Focus mode helpers: which key does what, and the browser's Fullscreen API
 * used defensively (missing in some browsers, refused without a user
 * gesture or inside an iframe).
 */

export interface FocusKey {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  /** Typing into a field (input, textarea, contenteditable). */
  editing: boolean;
  /** A modal dialog is open: its keys are its own. */
  dialogOpen: boolean;
}

export function focusKeyAction(
  e: FocusKey,
  focused: boolean,
): "toggle" | "exit" | null {
  if (e.editing || e.dialogOpen) return null;
  if (e.key === "Escape") return focused ? "exit" : null;
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  return e.key === "f" || e.key === "F" ? "toggle" : null;
}

/** Is this key event typed into a field? */
export function isEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

/** Ask for the browser's fullscreen; a refusal or no API is fine. */
export function enterFullscreen(el: HTMLElement): void {
  if (typeof el.requestFullscreen !== "function") return;
  try {
    el.requestFullscreen().catch(() => {});
  } catch {
    // Not allowed here: focus mode still fills the window.
  }
}

export function leaveFullscreen(doc: Document): void {
  if (!doc.fullscreenElement || typeof doc.exitFullscreen !== "function") {
    return;
  }
  try {
    doc.exitFullscreen().catch(() => {});
  } catch {
    // Already left.
  }
}
