"use client";

/**
 * "What each person is doing now": one row per person (the boss first) with
 * a plain action ("Editing api.ts"), the task, time since start, tool count
 * and a progress bar. Real numbers only come from the backend's optional
 * todo-list `progress`; without it a busy person gets a striped "working"
 * pulse, never a made-up percentage. Shared by the desktop agent panel and
 * the phone "who's working" list.
 */

import { memo, useEffect, useMemo, useState, type ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import { useGameStore, selectEventLog } from "@/stores/gameStore";
import { useTranslation } from "@/hooks/useTranslation";
import {
  activityLines,
  agentRunTimes,
  bossTurnStart,
  describeAction,
  lastToolByAgent,
  progressView,
  toolCountsByAgent,
  type AgentProgress,
  type ProgressView,
} from "@/utils/agentActivity";
import { isAgentBusy, isBossBusy } from "@/utils/workStatus";
import { cleanPromptText } from "@/utils/promptText";

// ============================================================================
// TYPES
// ============================================================================

export interface TeamRow {
  id: string;
  name: string;
  color: string;
  isBoss: boolean;
  busy: boolean;
  waiting: boolean;
  /** Finished and resting in the office (grey dot, "Done · resting 3m"). */
  resting: boolean;
  action: string;
  task: string | null;
  startedAt: number | null;
  toolCount: number;
  view: ProgressView;
  /** Raw details, shown only in debug mode. */
  debug: { state: string; phase: string; queue: string | null };
}

// ============================================================================
// DATA
// ============================================================================

/**
 * The fields the rows need, flattened to primitives so `useShallow` skips the
 * per-frame position updates of the agents Map (ARC-006).
 */
const FIELDS = 13;

function useAgentFields(): readonly unknown[] {
  return useGameStore(
    useShallow((s) => {
      const flat: unknown[] = [];
      for (const a of s.agents.values()) {
        flat.push(
          a.id,
          a.name,
          a.color,
          a.number,
          a.backendState,
          a.isTyping,
          a.currentTask,
          a.phase,
          a.queueType,
          a.queueIndex,
          a.progress,
          a.restingSince,
          a.waitingSince,
        );
      }
      return flat;
    }),
  );
}

/** The rows for everyone in the office, sorted: boss, needs-you, busy, idle. */
export function useTeamRows(): TeamRow[] {
  const { t } = useTranslation();
  const fields = useAgentFields();
  const boss = useGameStore(
    useShallow((s) => ({
      state: s.boss.backendState,
      isTyping: s.boss.isTyping,
      task: s.boss.currentTask,
      progress: s.boss.progress,
      waitingSince: s.boss.waitingSince,
    })),
  );
  const eventLog = useGameStore(selectEventLog);
  const lifespans = useGameStore((s) => s.whiteboardData.agentLifespans);

  const tools = useMemo(() => lastToolByAgent(eventLog), [eventLog]);
  const counts = useMemo(() => toolCountsByAgent(eventLog), [eventLog]);
  const starts = useMemo(() => agentRunTimes(lifespans ?? []), [lifespans]);
  const bossStart = useMemo(() => bossTurnStart(eventLog), [eventLog]);

  return useMemo(() => {
    const row = (input: {
      id: string;
      key: string;
      name: string;
      color: string;
      isBoss: boolean;
      state: string;
      isTyping: boolean;
      task: string | null;
      progress: AgentProgress | null;
      busy: boolean;
      phase: string;
      queue: string | null;
      restingSince?: number | null;
      /** Start of a permission wait: "Waiting for permission · 1m" counts from it. */
      waitingSince?: number | null;
    }): TeamRow => {
      const action = describeAction({
        state: input.state,
        isTyping: input.isTyping,
        tool: tools.get(input.key) ?? null,
      });
      return {
        id: input.id,
        name: input.name,
        color: input.color,
        isBoss: input.isBoss,
        busy: input.busy,
        waiting: input.state === "waiting_permission",
        resting: input.state === "resting",
        action,
        task: input.task ? cleanPromptText(input.task) : null,
        startedAt:
          input.state === "waiting_permission" && input.waitingSince
            ? input.waitingSince
            : input.isBoss
              ? bossStart
              : (starts.get(input.id) ?? null),
        toolCount: counts.get(input.key) ?? 0,
        view: progressView(
          input.progress,
          input.state,
          action,
          input.isTyping,
          input.restingSince ?? null,
        ),
        debug: { state: input.state, phase: input.phase, queue: input.queue },
      };
    };

    const agents: (TeamRow & { number: number })[] = [];
    for (let i = 0; i + FIELDS <= fields.length; i += FIELDS) {
      const [
        id,
        name,
        color,
        number,
        state,
        isTyping,
        task,
        phase,
        queueType,
        queueIndex,
        progress,
        restingSince,
        waitingSince,
      ] = fields.slice(i, i + FIELDS) as [
        string,
        string | null,
        string,
        number,
        Parameters<typeof isAgentBusy>[0],
        boolean,
        string | null,
        string,
        string | null,
        number,
        AgentProgress | null,
        number | null,
        number | null,
      ];
      agents.push({
        ...row({
          id,
          key: id,
          name: name ?? `${t("agentStatus.agent")} ${number}`,
          color,
          isBoss: false,
          state,
          isTyping,
          task,
          progress,
          busy: isAgentBusy(state, isTyping),
          phase,
          restingSince,
          waitingSince,
          queue:
            queueType && queueIndex >= 0
              ? t("agentStatus.inQueue", {
                  queueType,
                  position: queueIndex + 1,
                })
              : null,
        }),
        number,
      });
    }
    const rank = (r: TeamRow) => (r.waiting ? 0 : r.busy ? 1 : 2);
    agents.sort((a, b) => rank(a) - rank(b) || a.number - b.number);

    const bossRow = row({
      id: "boss",
      key: "boss",
      name: t("mobile.boss"),
      color: "var(--qo-max)",
      isBoss: true,
      state: boss.state,
      isTyping: boss.isTyping,
      task: boss.task,
      progress: boss.progress,
      busy: isBossBusy(boss.state),
      phase: "-",
      queue: null,
      waitingSince: boss.waitingSince,
    });
    return [bossRow, ...agents];
  }, [fields, boss, tools, counts, starts, bossStart, t]);
}

/** A clock that ticks every `ms` (for "4m" labels). */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

// ============================================================================
// VIEW
// ============================================================================

/** The bar: real progress, the striped "working" pulse, or "needs you". */
export function ActivityBar({
  view,
  color,
}: {
  view: ProgressView;
  color: string;
}): ReactNode {
  const { t } = useTranslation();
  if (view.kind === "none") return null;
  const done = view.kind === "bar" && view.percent >= 100;
  const style = {
    "--qo-bar": done ? "var(--qo-accent)" : color,
  } as React.CSSProperties;
  if (view.kind === "bar") {
    return (
      <div
        className="qo-progress"
        style={style}
        role="progressbar"
        aria-label={t("team.progress")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={view.percent}
      >
        <span style={{ width: `${view.percent}%` }} />
      </div>
    );
  }
  return (
    <div
      className={`qo-progress ${
        view.kind === "wait" ? "qo-progress-wait" : "qo-progress-busy"
      }`}
      style={style}
      aria-hidden="true"
    >
      <span />
    </div>
  );
}

interface TeamRowItemProps {
  row: TeamRow;
  now: number;
  debugMode: boolean;
  /** Phones: a bit larger text, the "says" line is not used. */
  size?: "sm" | "md";
}

function TeamRowItemComponent({
  row,
  now,
  debugMode,
  size = "sm",
}: TeamRowItemProps): ReactNode {
  const { t } = useTranslation();
  const md = size === "md";
  const lines = activityLines({
    view: row.view,
    action: row.action,
    toolCount: row.toolCount,
    startedAt: row.startedAt,
    now,
  });

  const text = md ? "text-[13px]" : "text-[12.5px]";

  return (
    <li
      className={`flex flex-col gap-1 px-3 py-2.5 rounded-xl2 transition-colors ${
        row.waiting ? "bg-max-dim" : row.busy ? "bg-panel-2" : ""
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span
          aria-hidden="true"
          className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
            row.busy && !row.waiting ? "qo-live-dot" : ""
          }`}
          style={{
            background: row.resting ? "var(--qo-ink-faint)" : row.color,
          }}
        />
        <span
          className={`${md ? "text-[14.5px]" : "text-[13.5px]"} font-extrabold text-ink truncate`}
        >
          {row.name}
        </span>
        <span className="ml-auto flex-shrink-0 flex items-center gap-1.5">
          {row.waiting ? (
            <span className="qo-badge qo-badge-max !h-[22px] !px-2 !text-[11.5px]">
              <span
                aria-hidden="true"
                className="w-3.5 h-3.5 rounded-full bg-max text-on-accent text-[10px] font-extrabold flex items-center justify-center"
              >
                !
              </span>
              {t("team.needsYou")}
            </span>
          ) : row.view.kind === "bar" ? (
            <span
              className={`text-[12px] font-extrabold tabular-nums ${
                row.view.percent >= 100 ? "text-accent" : "text-ink-soft"
              }`}
            >
              {row.view.percent}%
            </span>
          ) : null}
        </span>
      </div>

      <p
        className={`m-0 pl-5 ${text} font-bold truncate ${
          row.waiting ? "text-max" : row.busy ? "text-accent" : "text-ink-faint"
        }`}
        title={lines.status}
      >
        {lines.status}
      </p>

      {lines.action && (
        <p
          className={`m-0 pl-5 -mt-0.5 ${text} font-semibold text-ink truncate`}
          title={lines.action}
        >
          {lines.action}
        </p>
      )}

      {row.view.kind !== "none" && (
        <div className="pl-5 pt-0.5">
          <ActivityBar view={row.view} color={row.color} />
        </div>
      )}

      {row.task && (
        <p
          className={`m-0 pl-5 pt-0.5 ${text} leading-snug text-ink-soft line-clamp-2`}
        >
          {row.task}
        </p>
      )}

      {debugMode && (
        <p className="m-0 pl-5 font-mono text-[11px] text-ink-faint truncate">
          {row.debug.state} · {row.debug.phase}
          {row.debug.queue ? ` · ${row.debug.queue}` : ""}
          {row.isBoss ? "" : ` · #${row.id.slice(0, 7)}`}
        </p>
      )}
    </li>
  );
}

export const TeamRowItem = memo(TeamRowItemComponent);
