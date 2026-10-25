"use client";

import { useTranslation } from "@/hooks/useTranslation";
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

  return (
    <section
      aria-label={t("mobile.agentActivity")}
      className={`qo-card flex flex-col min-h-0 overflow-hidden ${className}`}
    >
      <div className="flex items-center justify-between px-4 pt-3 pb-2 flex-shrink-0">
        <span className="qo-eyebrow">{t("team.title")}</span>
        <span className="text-[12px] font-bold text-ink-faint tabular-nums">
          {rows.length}
        </span>
      </div>

      <ul className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-2 pb-2 flex flex-col gap-1">
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
          <li className="px-3 py-3 text-[12.5px] font-bold text-ink-faint text-center">
            {t("mobile.noActiveAgents")}
          </li>
        )}
      </ul>
    </section>
  );
}
