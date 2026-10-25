/**
 * Claude Code wraps some "user" turns in XML-like envelopes
 * (`<agent-message from="…">`, `<task-notification>`, …). They are messages
 * from the system, not from the owner; show them as a few words instead of
 * raw tags. The backend does the same with agent names; this is the
 * fallback for text it already stored raw.
 */

/** Native agent id -> display name (null when unknown). */
export type NameForNativeId = (nativeId: string) => string | null;

const ENVELOPE = /^<([a-z][a-z0-9]*(?:-[a-z0-9]+)+)\b/i;

/** Short words for an envelope prompt; ordinary text comes back unchanged. */
export function cleanPromptText(
  text: string,
  nameFor?: NameForNativeId,
): string {
  const trimmed = text.trimStart();
  const match = ENVELOPE.exec(trimmed);
  if (!match) return text;
  const tag = (match[1] ?? "").toLowerCase();
  if (tag === "agent-message") {
    const from = /from="([^"]+)"/.exec(trimmed)?.[1];
    const name = from && nameFor ? nameFor(from) : null;
    return `Message from ${name ?? "an agent"}`;
  }
  const words = tag.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** An event-log summary: "User: <envelope…>" becomes the envelope's words. */
export function cleanSummary(
  summary: string,
  nameFor?: NameForNativeId,
): string {
  const prefix = "User: ";
  if (!summary.startsWith(prefix)) return summary;
  const prompt = summary.slice(prefix.length);
  const clean = cleanPromptText(prompt, nameFor);
  return clean === prompt ? summary : clean;
}
