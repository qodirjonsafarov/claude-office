"use client";

import { Users } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { EmptyState } from "@/components/ui/EmptyState";
import { useGameStore, selectDebugMode } from "@/stores/gameStore";
import {
  TeamRowItem,
  useNow,
  useTeamRows,
} from "@/components/layout/TeamActivity";

// ============================================================================
// TYPES
// ============================================================================

interface MobileAgentActivityProps {
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Phone-only "who's working" list: the same rows as the desktop agent panel
 * (boss first, then who needs you, the busy and the idle), with the action,
 * the task, time, tool count and the progress bar.
 */
export function MobileAgentActivity({
  className = "",
}: MobileAgentActivityProps): React.ReactNode {
  const { t } = useTranslation();
  const rows = useTeamRows();
  const now = useNow();
  const debugMode = useGameStore(selectDebugMode);

  // Who works is told by the status pill above (top bar or rail).
  return (
    <section
      aria-label={t("mobile.agentActivity")}
      className={`qo-card flex flex-col min-h-0 overflow-hidden ${className}`}
    >
      <div className="qo-panel-head !min-h-12">
        <h2 className="qo-title">{t("team.title")}</h2>
        <span className="qo-count">{rows.length}</span>
      </div>

      <ul className="m-0 p-0 list-none flex-1 min-h-0 overflow-y-auto overscroll-contain px-2 pb-2 flex flex-col gap-1">
        {rows.map((row) => (
          <TeamRowItem
            key={row.id}
            row={row}
            now={now}
            debugMode={debugMode}
            size="md"
          />
        ))}
        {rows.length === 1 && (
          <li>
            <EmptyState icon={Users} title={t("mobile.noActiveAgents")} />
          </li>
        )}
      </ul>
    </section>
  );
}
