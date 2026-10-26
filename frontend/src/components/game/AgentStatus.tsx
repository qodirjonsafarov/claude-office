/**
 * AgentStatus - "Team now" panel (desktop right sidebar)
 *
 * One row per person, the boss first: a plain action ("Editing api.ts"),
 * the task, time since start, tool count and a progress bar. Raw state,
 * animation phase, queue slot and id only appear in debug mode.
 */

"use client";

import type { ReactNode } from "react";
import { Users } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { useGameStore, selectDebugMode } from "@/stores/gameStore";
import { useTranslation } from "@/hooks/useTranslation";
import {
  TeamRowItem,
  useNow,
  useTeamRows,
} from "@/components/layout/TeamActivity";

export function AgentStatus({
  headerAction,
}: {
  /** A control at the end of the head (the panel's fold button). */
  headerAction?: ReactNode;
} = {}) {
  const { t } = useTranslation();
  const rows = useTeamRows();
  const now = useNow();
  const debugMode = useGameStore(selectDebugMode);
  const working = rows.filter((r) => r.busy).length;

  return (
    <div className="flex flex-col overflow-hidden h-full min-h-0">
      <div className="qo-panel-head">
        <h2 className="qo-title">{t("team.title")}</h2>
        <span className={`qo-badge ${working > 0 ? "qo-badge-accent" : ""}`}>
          {working > 0 && (
            <span aria-hidden="true" className="qo-live-dot !w-1.5 !h-1.5" />
          )}
          {working > 0
            ? t("mobile.workingNow", { count: working })
            : t("mobile.allIdle")}
        </span>
        {headerAction && <span className="ml-auto">{headerAction}</span>}
      </div>

      <ul className="m-0 p-0 list-none flex-grow overflow-y-auto overscroll-contain px-2 pb-2 flex flex-col gap-1 min-h-0">
        {rows.map((row) => (
          <TeamRowItem key={row.id} row={row} now={now} debugMode={debugMode} />
        ))}
        {rows.length === 1 && (
          <li>
            <EmptyState icon={Users} title={t("agentStatus.noAgents")} />
          </li>
        )}
      </ul>
    </div>
  );
}
