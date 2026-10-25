"use client";

import { Activity } from "lucide-react";

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

  return (
    <div
      role="status"
      className={`qo-pop qo-glass-panel h-10 px-4 rounded-full border shadow-[0_8px_24px_var(--qo-float-shade)] flex items-center gap-2.5 text-[13px] font-extrabold whitespace-nowrap
        ${
          message.type === "success"
            ? "border-accent/30 text-accent"
            : message.type === "error"
              ? "border-danger/30 text-danger"
              : "border-line-strong text-ink"
        }`}
    >
      <Activity
        size={12}
        className={message.type === "info" ? "animate-pulse" : ""}
      />
      {message.text}
    </div>
  );
}
