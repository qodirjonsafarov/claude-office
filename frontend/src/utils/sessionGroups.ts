/**
 * Grouping the session list by project, shared by the desktop sidebar and
 * the phone sessions sheet.
 */

import type { Session } from "@/hooks/useSessions";

/** Derive a display name for grouping from a session. */
export function getProjectKey(session: Session): string {
  if (session.projectName) return session.projectName;
  if (session.projectRoot)
    return session.projectRoot.split("/").pop() ?? "unknown";
  return "unknown";
}

/** Group sessions by project, sorted: groups with active sessions first, then by most recent update. */
export function groupSessionsByProject(
  sessions: Session[],
): Map<string, Session[]> {
  const groups = new Map<string, Session[]>();
  for (const s of sessions) {
    const key = getProjectKey(s);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(s);
  }
  // Sort within each group: active first, then by updatedAt desc
  for (const list of groups.values()) {
    list.sort((a, b) => {
      if (a.status === "active" && b.status !== "active") return -1;
      if (b.status === "active" && a.status !== "active") return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }
  // Sort groups: those with active sessions first, then by most recent update
  const sorted = [...groups.entries()].sort(([, a], [, b]) => {
    const aActive = a.some((s) => s.status === "active");
    const bActive = b.some((s) => s.status === "active");
    if (aActive && !bActive) return -1;
    if (bActive && !aActive) return 1;
    const aNewest = Math.max(...a.map((s) => new Date(s.updatedAt).getTime()));
    const bNewest = Math.max(...b.map((s) => new Date(s.updatedAt).getTime()));
    return bNewest - aNewest;
  });
  return new Map(sorted);
}
