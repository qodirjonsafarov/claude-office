/**
 * AgentStatus - "Team now" panel (desktop right sidebar)
 *
 * One row per person, the boss first: a plain action ("Editing api.ts"),
 * the task, time since start, tool count and a progress bar. Raw state,
 * animation phase, queue slot and id only appear in debug mode.
 */

"use client";

import { Users } from "lucide-react";
import { useGameStore, selectDebugMode } from "@/stores/gameStore";
import { useTranslation } from "@/hooks/useTranslation";
import {
  TeamRowItem,
  useNow,
  useTeamRows,
} from "@/components/layout/TeamActivity";

export function AgentStatus() {
  const { t } = useTranslation();
  const rows = useTeamRows();
  const now = useNow();
  const debugMode = useGameStore(selectDebugMode);
  const working = rows.filter((r) => r.busy).length;

  return (
    <div className="qo-card flex flex-col overflow-hidden h-full">
      <div className="px-4 pt-3 pb-2 flex items-center justify-between flex-shrink-0">
        <div className="qo-eyebrow flex items-center gap-2">
          <Users size={14} strokeWidth={2.2} aria-hidden="true" />
          {t("team.title")}
        </div>
        <span
          className={`text-[12px] font-extrabold tabular-nums ${
            working > 0 ? "text-accent" : "text-ink-faint"
          }`}
        >
          {working > 0
            ? t("mobile.workingNow", { count: working })
            : t("mobile.allIdle")}
        </span>
      </div>

      <ul className="flex-grow overflow-y-auto px-2 pb-2 flex flex-col gap-1 min-h-0">
        {rows.map((row) => (
          <TeamRowItem key={row.id} row={row} now={now} debugMode={debugMode} />
        ))}
        {rows.length === 1 && (
          <li className="px-3 py-3 text-[12.5px] font-bold text-ink-faint text-center">
            {t("agentStatus.noAgents")}
          </li>
        )}
      </ul>
    </div>
  );
}
