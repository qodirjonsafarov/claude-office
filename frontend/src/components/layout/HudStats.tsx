"use client";

import { Users, ListChecks, Wrench, Brain } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useGameStore } from "@/stores/gameStore";
import { useTranslation } from "@/hooks/useTranslation";

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Game-style HUD counters in the header: agents on shift, todo progress,
 * tool uses and a context "energy" bar for the current session.
 */
export function HudStats(): React.ReactNode {
  const { t } = useTranslation();
  const { agentCount, todos, toolUses, context } = useGameStore(
    useShallow((s) => ({
      agentCount: s.agents.size,
      todos: s.todos,
      toolUses: s.toolUsesSinceCompaction,
      context: s.contextUtilization,
    })),
  );

  const doneTodos = todos.filter((todo) => todo.status === "completed").length;
  const contextPct = Math.round(Math.min(1, Math.max(0, context)) * 100);
  const contextTone =
    contextPct >= 80 ? "qo-bar-danger" : contextPct >= 55 ? "qo-bar-warn" : "";

  return (
    <div className="qo-hud flex items-center gap-2">
      <div className="qo-chip" title={t("hud.agents")}>
        <Users size={14} className="text-orange-400" />
        <span className="qo-chip-label">{t("hud.agents")}</span>
        <span className="qo-chip-value">{agentCount + 1}</span>
      </div>
      <div className="qo-chip" title={t("hud.tasks")}>
        <ListChecks size={14} className="text-emerald-400" />
        <span className="qo-chip-label">{t("hud.tasks")}</span>
        <span className="qo-chip-value">
          {doneTodos}/{todos.length}
        </span>
      </div>
      <div className="qo-chip" title={t("hud.tools")}>
        <Wrench size={14} className="text-sky-400" />
        <span className="qo-chip-label">{t("hud.tools")}</span>
        <span className="qo-chip-value">{toolUses}</span>
      </div>
      <div className="qo-chip qo-chip-wide" title={t("hud.context")}>
        <Brain size={14} className="text-violet-400" />
        <span className="qo-chip-label">{t("hud.context")}</span>
        <div className="qo-bar">
          <div
            className={`qo-bar-fill ${contextTone}`}
            style={{ width: `${contextPct}%` }}
          />
        </div>
        <span className="qo-chip-value">{contextPct}%</span>
      </div>
    </div>
  );
}
