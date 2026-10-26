"use client";

import { Activity, AlertCircle, Check } from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

export interface StatusMessage {
  text: string;
  type: "info" | "error" | "success";
}

interface StatusToastProps {
  message: StatusMessage | null;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Displays a transient status message toast, pinned to the bottom-center of
 * the screen so it never overlaps the header. Renders nothing when message is
 * null.
 */
export function StatusToast({ message }: StatusToastProps): React.ReactNode {
  if (!message) return null;
  const Icon =
    message.type === "success"
      ? Check
      : message.type === "error"
        ? AlertCircle
        : Activity;

  return (
    <div
      role="status"
      className="qo-pop qo-glass-panel h-11 pl-2 pr-4 rounded-full border border-line-strong shadow-[var(--qo-shadow-float)] flex items-center gap-2.5 text-[13.5px] font-extrabold text-ink whitespace-nowrap"
    >
      <span
        aria-hidden="true"
        className={`w-7 h-7 rounded-full flex items-center justify-center ${
          message.type === "success"
            ? "bg-accent-dim text-accent"
            : message.type === "error"
              ? "bg-danger-dim text-danger"
              : "bg-panel-3 text-ink-soft"
        }`}
      >
        <Icon size={15} strokeWidth={2.4} />
      </span>
      {message.text}
    </div>
  );
}
