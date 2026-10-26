"use client";

import { Inbox, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * A place with nothing in it yet (no sessions, no events, no agents), as on
 * Olymp's empty lists: a quiet sign in a round plate, a few words, an
 * optional hint or action under them.
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  hint,
  children,
  className = "",
}: {
  icon?: LucideIcon;
  title: string;
  hint?: string;
  /** An action under the words (a "Clear filters" button). */
  children?: ReactNode;
  className?: string;
}): ReactNode {
  return (
    <div className={`qo-empty ${className}`}>
      <span className="qo-empty-icon" aria-hidden="true">
        <Icon size={19} strokeWidth={2.2} />
      </span>
      <p className="m-0 text-[13.5px] font-extrabold text-ink-soft">{title}</p>
      {hint && (
        <p className="m-0 max-w-[260px] text-[12.5px] font-semibold leading-snug text-ink-faint">
          {hint}
        </p>
      )}
      {children}
    </div>
  );
}
