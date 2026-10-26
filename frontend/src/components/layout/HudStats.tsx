"use client";

import { Users, ListChecks, Wrench, Brain, Coins } from "lucide-react";
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useGameStore } from "@/stores/gameStore";
import { useTranslation } from "@/hooks/useTranslation";
import Modal from "@/components/overlay/Modal";
import {
  COST_NOTE,
  apiCost,
  costRows,
  formatCost,
  formatTokens,
  usageTooltip,
} from "@/utils/tokenUsage";

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * HUD counters (Olymp pills) in the header: agents on shift, todo progress,
 * tool uses and a context "energy" bar for the current session.
 */
export function HudStats({
  compact = false,
}: {
  /** Phones: no Team pill (the team list counts), Tasks only with a list,
   * a short context bar and "442M ≈$151" so the row fits the screen. */
  compact?: boolean;
} = {}): React.ReactNode {
  const { t } = useTranslation();
  const [costOpen, setCostOpen] = useState(false);
  const { agentCount, todos, toolUses, context, usage } = useGameStore(
    useShallow((s) => ({
      agentCount: s.agents.size,
      todos: s.todos,
      toolUses: s.toolUsesSinceCompaction,
      context: s.contextUtilization,
      usage: s.tokenUsage,
    })),
  );
  const cost = usage
    ? compact
      ? formatCost(usage.costUsd)
      : apiCost(usage.costUsd)
    : null;

  const doneTodos = todos.filter((todo) => todo.status === "completed").length;
  const contextPct = Math.round(Math.min(1, Math.max(0, context)) * 100);
  const contextFill =
    contextPct >= 80 ? "bg-danger" : contextPct >= 55 ? "bg-warn" : "bg-accent";

  // One capsule of quiet counters; the cost is the one that opens something.
  const item = "qo-capsule-item";
  const icon = "text-ink-faint flex-shrink-0";
  const label = "hidden 2xl:inline text-ink-faint font-bold";

  return (
    <div className="flex items-center">
      <div className="qo-capsule">
        {!compact && (
          <>
            <div className={item} title={t("hud.agents")}>
              <Users size={15} className={icon} aria-hidden="true" />
              <span className={label}>{t("hud.agents")}</span>
              <span>{agentCount + 1}</span>
            </div>
            <span className="qo-capsule-sep" aria-hidden="true" />
          </>
        )}
        {!(compact && todos.length === 0) && (
          <>
            <div className={item} title={t("hud.tasks")}>
              <ListChecks size={15} className={icon} aria-hidden="true" />
              <span className={label}>{t("hud.tasks")}</span>
              <span>
                {doneTodos}/{todos.length}
              </span>
            </div>
            <span className="qo-capsule-sep" aria-hidden="true" />
          </>
        )}
        <div className={item} title={t("hud.tools")}>
          <Wrench size={15} className={icon} aria-hidden="true" />
          <span className={label}>{t("hud.tools")}</span>
          <span>{toolUses}</span>
        </div>
        <span className="qo-capsule-sep" aria-hidden="true" />
        <div className={item} title={t("hud.context")}>
          <Brain size={15} className={icon} aria-hidden="true" />
          <span className={label}>{t("hud.context")}</span>
          <div
            className={`${compact ? "w-10" : "w-14 2xl:w-20"} h-1.5 rounded-full bg-panel-3 overflow-hidden`}
          >
            <div
              className={`h-full rounded-full transition-[width] duration-500 ${contextFill}`}
              style={{ width: `${contextPct}%` }}
            />
          </div>
          <span className="min-w-[3ch] text-right">{contextPct}%</span>
        </div>
        {usage && (
          <>
            <span className="qo-capsule-sep" aria-hidden="true" />
            <button
              type="button"
              className={item}
              title={`${t("hud.tokens")}\n${usageTooltip(usage)}`}
              aria-haspopup="dialog"
              onClick={() => setCostOpen(true)}
            >
              <Coins size={15} className={icon} aria-hidden="true" />
              <span className={label}>{t("hud.tokens")}</span>
              <span>{formatTokens(usage.total)}</span>
              {cost && <span className="text-accent">{cost}</span>}
            </button>
          </>
        )}
      </div>
      {usage && (
        <Modal
          isOpen={costOpen}
          onClose={() => setCostOpen(false)}
          title={t("hud.costTitle")}
        >
          {/* The total first, large; the parts under it on one plate. */}
          <div className="flex items-end justify-between gap-4 mb-4">
            <div className="min-w-0">
              <div className="qo-label">{t("hud.costTotal")}</div>
              <div className="mt-1 text-[26px] leading-none font-extrabold text-ink tabular-nums">
                {formatTokens(usage.total)}
              </div>
            </div>
            <div className="text-[22px] leading-none font-extrabold text-accent tabular-nums">
              {apiCost(usage.costUsd) ?? "—"}
            </div>
          </div>
          <div className="qo-group">
            {costRows(usage).map((row) => (
              <div
                key={row.label}
                className="qo-group-row !min-h-11 text-[13.5px] tabular-nums"
              >
                <span className="flex-1 min-w-0 font-bold text-ink-soft truncate">
                  {row.label}
                </span>
                <span className="font-extrabold text-ink">{row.tokens}</span>
                <span className="w-20 text-right font-extrabold text-accent">
                  {row.usd ?? "—"}
                </span>
              </div>
            ))}
          </div>
          <p className="m-0 mt-4 text-[12.5px] leading-snug text-ink-faint">
            {COST_NOTE}
          </p>
        </Modal>
      )}
    </div>
  );
}
