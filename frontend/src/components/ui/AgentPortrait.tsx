"use client";

/**
 * A person's face for the agent card and the team list: a pixel-art crop of
 * the sheet that person wears in the office (systems/portrait.ts), framed in
 * a rounded tile with their accent colour ring. Until the sheet has loaded
 * (or for an agent the office hasn't drawn yet) it shows the first letter.
 * An optional status dot sits on the bottom-right corner.
 */

import type { CSSProperties, ReactNode } from "react";
import { portraitBackground, portraitSheet } from "@/systems/portrait";
import { useSheetReady } from "@/hooks/useSheetReady";
import { useAgentLooks } from "@/stores/agentLookStore";

export type PortraitStatus = "working" | "needsYou" | "resting" | "idle";

const STATUS_DOT: Record<PortraitStatus, string> = {
  working: "bg-accent qo-live-dot",
  needsYou: "bg-max",
  resting: "bg-ink-faint",
  idle: "", // the person's own colour, like the team list dot
};

interface AgentPortraitProps {
  id: string;
  name: string;
  /** Accent colour of the person (the ring, and the letter tile). */
  color: string;
  /** Box size in px; a multiple of 32 keeps sprite pixels whole. */
  size: number;
  status?: PortraitStatus;
}

export default function AgentPortrait({
  id,
  name,
  color,
  size,
  status,
}: AgentPortraitProps): ReactNode {
  const sheet = useAgentLooks((s) => portraitSheet(id, s.looks));
  const ready = useSheetReady(sheet);
  const large = size >= 48;
  const ring = large ? 2 : 1.5;
  const radius = Math.round(size * 0.25);
  const dot = large ? 14 : 9;

  const box: CSSProperties = {
    width: size,
    height: size,
    borderRadius: radius,
    boxShadow: `inset 0 0 0 ${ring}px ${color}`,
  };

  return (
    <span
      aria-hidden="true"
      className="relative flex-shrink-0 inline-block"
      style={{ width: size, height: size }}
    >
      {ready && sheet ? (
        <span
          data-portrait="sprite"
          className="block bg-panel-2 bg-no-repeat [image-rendering:pixelated]"
          style={{ ...box, ...portraitBackground(sheet, size) }}
        />
      ) : (
        <span
          data-portrait="letter"
          className="flex items-center justify-center font-extrabold text-on-accent"
          style={{
            ...box,
            background: color,
            boxShadow: `inset 0 0 0 ${ring}px var(--qo-line)`,
            fontSize: Math.round(size * 0.4),
          }}
        >
          {name.slice(0, 1).toUpperCase()}
        </span>
      )}
      {status && (
        <span
          data-status={status}
          className={`absolute rounded-full shadow-[0_0_0_2px_var(--qo-panel)] ${STATUS_DOT[status]}`}
          style={{
            width: dot,
            height: dot,
            background: status === "idle" ? color : undefined,
            right: -dot / 4,
            bottom: -dot / 4,
          }}
        />
      )}
    </span>
  );
}
