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

  return (
    <div className="flex items-center gap-2">
      <div className={compact ? "hidden" : "qo-pill"} title={t("hud.agents")}>
        <Users size={15} className="text-ink-faint" aria-hidden="true" />
        <span className="hidden 2xl:inline text-ink-faint font-bold">
          {t("hud.agents")}
        </span>
        <span>{agentCount + 1}</span>
      </div>
      <div
        className={compact && todos.length === 0 ? "hidden" : "qo-pill"}
        title={t("hud.tasks")}
      >
        <ListChecks size={15} className="text-ink-faint" aria-hidden="true" />
        <span className="hidden 2xl:inline text-ink-faint font-bold">
          {t("hud.tasks")}
        </span>
        <span>
          {doneTodos}/{todos.length}
        </span>
      </div>
      <div className="qo-pill" title={t("hud.tools")}>
        <Wrench size={15} className="text-ink-faint" aria-hidden="true" />
        <span className="hidden 2xl:inline text-ink-faint font-bold">
          {t("hud.tools")}
        </span>
        <span>{toolUses}</span>
      </div>
      <div className="qo-pill" title={t("hud.context")}>
        <Brain size={15} className="text-ink-faint" aria-hidden="true" />
        <span className="hidden 2xl:inline text-ink-faint font-bold">
          {t("hud.context")}
        </span>
        <div
          className={`${compact ? "w-10" : "w-16 2xl:w-24"} h-2 rounded-full bg-panel-3 overflow-hidden`}
        >
          <div
            className={`h-full rounded-full transition-[width] duration-500 ${contextFill}`}
            style={{ width: `${contextPct}%` }}
          />
        </div>
        <span className="min-w-[3ch] text-right">{contextPct}%</span>
      </div>
      {usage && (
        <button
          type="button"
          // A tap target: at least 44 px tall on touch screens
          className="qo-pill hover:border-line-strong transition-colors [@media(pointer:coarse)]:min-h-11"
          title={`${t("hud.tokens")}\n${usageTooltip(usage)}`}
          aria-haspopup="dialog"
          onClick={() => setCostOpen(true)}
        >
          <Coins size={15} className="text-ink-faint" aria-hidden="true" />
          <span className="hidden 2xl:inline text-ink-faint font-bold">
            {t("hud.tokens")}
          </span>
          <span>{formatTokens(usage.total)}</span>
          {cost && <span className="text-accent">{cost}</span>}
        </button>
      )}
      {usage && (
        <Modal
          isOpen={costOpen}
          onClose={() => setCostOpen(false)}
          title={t("hud.costTitle")}
        >
          <p className="m-0 mb-4 text-[13px] text-ink-soft">{COST_NOTE}</p>
          <table className="w-full text-[13.5px] tabular-nums">
            <tbody>
              {costRows(usage).map((row) => (
                <tr key={row.label} className="border-b border-line">
                  <th className="py-2 text-left font-bold text-ink-soft">
                    {row.label}
                  </th>
                  <td className="py-2 text-right font-extrabold text-ink">
                    {row.tokens}
                  </td>
                  <td className="py-2 pl-4 w-24 text-right font-extrabold text-accent">
                    {row.usd ?? "—"}
                  </td>
                </tr>
              ))}
              <tr>
                <th className="pt-3 text-left font-extrabold text-ink">
                  {t("hud.costTotal")}
                </th>
                <td className="pt-3 text-right font-extrabold text-ink">
                  {formatTokens(usage.total)}
                </td>
                <td className="pt-3 pl-4 text-right font-extrabold text-accent">
                  {apiCost(usage.costUsd) ?? "—"}
                </td>
              </tr>
            </tbody>
          </table>
        </Modal>
      )}
    </div>
  );
}
