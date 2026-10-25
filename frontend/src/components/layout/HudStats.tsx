"use client";

import { Users, ListChecks, Wrench, Brain } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useGameStore } from "@/stores/gameStore";
import { useTranslation } from "@/hooks/useTranslation";

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * HUD counters (Olymp pills) in the header: agents on shift, todo progress,
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
  const contextFill =
    contextPct >= 80 ? "bg-danger" : contextPct >= 55 ? "bg-warn" : "bg-accent";

  return (
    <div className="flex items-center gap-2">
      <div className="qo-pill" title={t("hud.agents")}>
        <Users size={15} className="text-ink-faint" aria-hidden="true" />
        <span className="hidden 2xl:inline text-ink-faint font-bold">
          {t("hud.agents")}
        </span>
        <span>{agentCount + 1}</span>
      </div>
      <div className="qo-pill" title={t("hud.tasks")}>
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
        <div className="w-16 2xl:w-24 h-2 rounded-full bg-panel-3 overflow-hidden">
          <div
            className={`h-full rounded-full transition-[width] duration-500 ${contextFill}`}
            style={{ width: `${contextPct}%` }}
          />
        </div>
        <span className="min-w-[3ch] text-right">{contextPct}%</span>
      </div>
    </div>
  );
}
