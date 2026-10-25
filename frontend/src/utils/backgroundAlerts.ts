/**
 * Background alerts: while the tab is hidden, the moments that need the user
 * (Claude finished, a permission request, a subagent finished) become a
 * browser Notification and a "(n)" count in the tab title. Pure logic; the
 * page environment is passed in so it is unit-testable.
 */

import type { EventType } from "@/types";

export interface AlertEvent {
  type: EventType | string;
  summary: string;
  agentName?: string | null;
}

export interface BackgroundAlert {
  title: string;
  body: string;
}

/** What to tell the user about an event, or null if it can wait. */
export function backgroundAlertFor(event: AlertEvent): BackgroundAlert | null {
  const who = event.agentName?.trim() || null;
  switch (event.type) {
    case "stop":
      return { title: "Claude finished", body: event.summary };
    case "permission_request":
      return {
        title: `${who ?? "Claude"} needs permission`,
        body: event.summary,
      };
    case "subagent_stop":
      return { title: `${who ?? "A subagent"} finished`, body: event.summary };
    default:
      return null;
  }
}

const BADGE = /^\(\d+\) /;

/** The tab title with an unread count in front ("(3) Claude Office"). */
export function badgeTitle(title: string, count: number): string {
  const base = title.replace(BADGE, "");
  return count > 0 ? `(${count}) ${base}` : base;
}

/** The parts of the page the alerts read and write. */
export interface AlertEnv {
  readonly hidden: boolean;
  title: string;
  readonly permission: NotificationPermission;
  notify: (title: string, body: string) => void;
}

/** Counts alerts while the tab is hidden; resets when it is shown again. */
export class BackgroundAlerts {
  private unseen = 0;

  constructor(private readonly env: AlertEnv) {}

  onEvent(event: AlertEvent): void {
    if (!this.env.hidden) return;
    const alert = backgroundAlertFor(event);
    if (!alert) return;
    this.unseen += 1;
    this.env.title = badgeTitle(this.env.title, this.unseen);
    if (this.env.permission === "granted") {
      this.env.notify(alert.title, alert.body);
    }
  }

  onVisible(): void {
    this.unseen = 0;
    this.env.title = badgeTitle(this.env.title, 0);
  }
}
