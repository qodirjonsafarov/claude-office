"use client";

import { useShallow } from "zustand/react/shallow";
import { useTranslation } from "@/hooks/useTranslation";
import {
  useGameStore,
  selectAgents,
  type BossAnimationState,
} from "@/stores/gameStore";
import { isAgentBusy, isBossBusy } from "@/utils/workStatus";

// ============================================================================
// TYPES
// ============================================================================

interface MobileAgentActivityProps {
  boss: BossAnimationState;
  className?: string;
}

interface Row {
  id: string;
  name: string;
  color: string;
  busy: boolean;
  state: string;
  task: string | null;
  says: string | null;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Phone-only list of who is in the office: the boss first, then the agents,
 * busy people before idle ones. Each row: a colour dot that breathes while the
 * person works, the name, the task and what they are saying.
 */
export function MobileAgentActivity({
  boss,
  className = "",
}: MobileAgentActivityProps): React.ReactNode {
  const { t } = useTranslation();
  // Subscribe here (mobile-only) so the root page no longer holds the whole
  // agents Map subscription — keeps the desktop header/sidebars/modals off the
  // per-frame animation re-render path (ARC-006).
  const agents = useGameStore(useShallow(selectAgents));

  const agentRows: Row[] = Array.from(agents.values())
    .map((agent) => ({
      id: agent.id,
      name: agent.name ?? `Agent ${agent.number}`,
      color: agent.color,
      busy: isAgentBusy(agent.backendState, agent.isTyping),
      state: agent.backendState.replace(/_/g, " "),
      task: agent.currentTask,
      says: agent.bubble.content?.text ?? null,
    }))
    .sort((a, b) => Number(b.busy) - Number(a.busy));

  const rows: Row[] = [
    {
      id: "boss",
      name: t("mobile.boss"),
      color: "var(--qo-max)",
      busy: isBossBusy(boss.backendState),
      state: boss.backendState.replace(/_/g, " "),
      task: boss.currentTask,
      says: boss.bubble.content?.text ?? null,
    },
    ...agentRows,
  ];

  return (
    <section
      aria-label={t("mobile.agentActivity")}
      className={`qo-card flex flex-col min-h-0 overflow-hidden ${className}`}
    >
      <div className="flex items-center justify-between px-4 pt-3 pb-2 flex-shrink-0">
        <span className="qo-eyebrow">{t("mobile.agentActivity")}</span>
        <span className="text-[12px] font-bold text-ink-faint tabular-nums">
          {agents.size + 1}
        </span>
      </div>

      <ul className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-2 pb-2 flex flex-col gap-1">
        {rows.map((row) => (
          <li
            key={row.id}
            className={`flex items-start gap-3 px-2.5 py-2 rounded-xl2 ${
              row.busy ? "bg-panel-2" : ""
            }`}
          >
            <span
              aria-hidden="true"
              className={`mt-1.5 w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                row.busy ? "qo-live-dot" : ""
              }`}
              style={{ background: row.color }}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-extrabold text-ink truncate">
                  {row.name}
                </span>
                <span
                  className={`ml-auto flex-shrink-0 text-[11px] font-extrabold ${
                    row.busy ? "text-accent" : "text-ink-faint"
                  }`}
                >
                  {row.busy ? t("mobile.working") : row.state}
                </span>
              </div>
              {row.task && (
                <p className="m-0 text-[12.5px] text-ink-soft truncate">
                  {row.task}
                </p>
              )}
              {row.says && (
                <p className="m-0 text-[12.5px] text-ink-faint truncate">
                  &ldquo;{row.says}&rdquo;
                </p>
              )}
            </div>
          </li>
        ))}
        {agents.size === 0 && (
          <li className="px-3 py-3 text-[12.5px] font-bold text-ink-faint text-center">
            {t("mobile.noActiveAgents")}
          </li>
        )}
      </ul>
    </section>
  );
}
