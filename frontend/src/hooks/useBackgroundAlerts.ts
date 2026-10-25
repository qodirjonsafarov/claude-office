"use client";

import { useEffect } from "react";
import { BackgroundAlerts, type AlertEvent } from "@/utils/backgroundAlerts";

const ASKED_KEY = "claude-office-notify-asked";

let alerts: BackgroundAlerts | null = null;

function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

function getAlerts(): BackgroundAlerts | null {
  if (typeof document === "undefined") return null;
  if (alerts === null) {
    alerts = new BackgroundAlerts({
      get hidden() {
        return document.hidden;
      },
      get title() {
        return document.title;
      },
      set title(value: string) {
        document.title = value;
      },
      get permission() {
        return notificationsSupported() ? Notification.permission : "denied";
      },
      notify: (title, body) => {
        try {
          const n = new Notification(title, {
            body,
            icon: "/icon.svg",
            tag: "claude-office",
          });
          n.onclick = () => {
            window.focus();
            n.close();
          };
        } catch {
          // Some mobile browsers only allow notifications from a service worker.
        }
      },
    });
  }
  return alerts;
}

/** Feed a WebSocket event to the background alerts (no-op when visible). */
export function reportBackgroundEvent(event: AlertEvent): void {
  getAlerts()?.onEvent(event);
}

function askedBefore(): boolean {
  try {
    return localStorage.getItem(ASKED_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberAsked(): void {
  try {
    localStorage.setItem(ASKED_KEY, "1");
  } catch {
    // storage blocked: we may ask again next visit, which is harmless
  }
}

/**
 * Mount once on the page: asks for notification permission on the user's
 * first click or key press (browsers require a gesture; asked only once), and
 * clears the title badge when the tab comes back.
 */
export function useBackgroundAlerts(): void {
  useEffect(() => {
    const onVisibility = () => {
      if (!document.hidden) getAlerts()?.onVisible();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const ask = () => {
      window.removeEventListener("pointerdown", ask);
      window.removeEventListener("keydown", ask);
      if (!notificationsSupported() || Notification.permission !== "default")
        return;
      if (askedBefore()) return;
      rememberAsked();
      void Notification.requestPermission().catch(() => undefined);
    };
    window.addEventListener("pointerdown", ask);
    window.addEventListener("keydown", ask);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointerdown", ask);
      window.removeEventListener("keydown", ask);
    };
  }, []);
}
