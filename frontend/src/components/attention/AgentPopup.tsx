"use client";

/**
 * The agent card: tap (or long-press, on phones) a character or its desk and
 * see who it is and what it does now. A popover beside the character on
 * desktop, kept inside the stage; a bottom sheet on phones that closes on a
 * pull down. Focus stays inside while it is open, Escape closes it and gives
 * focus back. It rises and fades in and out, or just appears with reduced
 * motion. Numbers come from the team rows, the event log and the per-person
 * token usage of the state updates.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { X, ScrollText, SquareTerminal } from "lucide-react";
import { useAttentionStore, selectFocusPopup } from "@/stores/attentionStore";
import {
  useGameStore,
  selectEventLog,
  selectSessionId,
} from "@/stores/gameStore";
import { useTranslation } from "@/hooks/useTranslation";
import { useLayoutMode } from "@/hooks/useLayoutMode";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { usePresence } from "@/hooks/usePresence";
import { useSheetPull } from "@/hooks/useSheetPull";
import { useReducedMotion } from "@/systems/reducedMotion";
import { placePopover, type Rect } from "@/utils/popoverPlacement";
import {
  ActivityBar,
  useNow,
  useTeamRows,
  type TeamRow,
} from "@/components/layout/TeamActivity";
import {
  firstSeenAt,
  formatDuration,
  lastToolByAgent,
  recentActions,
  toolTarget,
} from "@/utils/agentActivity";
import { cardUsage } from "@/utils/tokenUsage";

const POPOVER_WIDTH = 340;
/** The card's height before it is measured. */
const POPOVER_HEIGHT = 470;
const RECENT_LIMIT = 5;
/** The close animation (qo-pop-out / qo-sheet-down in tokens.css). */
const EXIT_MS = 180;

/** The office area on screen (desktop), within the window. */
function stageRect(): Rect {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const r = document.querySelector(".qo-stage")?.getBoundingClientRect();
  if (!r) return { left: 0, top: 0, right: vw, bottom: vh };
  return {
    left: Math.max(0, r.left),
    top: Math.max(0, r.top),
    right: Math.min(vw, r.right),
    bottom: Math.min(vh, r.bottom),
  };
}

type CardState = "needsYou" | "working" | "resting" | "idle";

function cardState(row: TeamRow): CardState {
  if (row.waiting) return "needsYou";
  if (row.resting) return "resting";
  if (row.busy) return "working";
  return "idle";
}

const STATE_PILL: Record<CardState, string> = {
  needsYou: "!bg-max-dim !border-transparent text-max",
  working: "qo-pill-accent",
  resting: "text-ink-soft",
  idle: "text-ink-faint",
};

function Stat({
  label,
  value,
  title,
}: {
  label: string;
  value: string;
  title?: string | null;
}): ReactNode {
  return (
    <div
      className="rounded-xl2 bg-panel-2 border border-line px-3 py-2 min-w-0"
      title={title ?? undefined}
    >
      <div className="text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-ink-faint truncate">
        {label}
      </div>
      <div className="text-[15px] font-extrabold text-ink tabular-nums truncate">
        {value}
      </div>
    </div>
  );
}

export default function AgentPopup(): ReactNode {
  const focusPopup = useAttentionStore(selectFocusPopup);
  const reduced = useReducedMotion();
  // The last card stays for its close animation.
  const { shown, leaving } = usePresence(focusPopup, reduced ? 0 : EXIT_MS);
  if (!shown) return null;
  if (typeof document === "undefined") return null;
  return createPortal(
    <AgentCard key={shown.agentId} {...shown} leaving={leaving} />,
    document.body,
  );
}

function AgentCard({
  agentId,
  screenX,
  screenY,
  leaving,
}: {
  agentId: string;
  screenX: number;
  screenY: number;
  leaving: boolean;
}): ReactNode {
  const { t } = useTranslation();
  const layout = useLayoutMode();
  const phone = layout !== "desktop";
  const closeFocusPopup = useAttentionStore((s) => s.closeFocusPopup);
  const focusAgentTerminal = useAttentionStore((s) => s.focusAgentTerminal);
  const jumpToLog = useAttentionStore((s) => s.jumpToLog);
  const sessionId = useGameStore(selectSessionId);
  const eventLog = useGameStore(selectEventLog);
  const usage = useGameStore((s) => s.agentUsage.get(agentId) ?? null);
  const agentType = useGameStore((s) =>
    agentId === "boss" ? null : (s.agents.get(agentId)?.agentType ?? null),
  );
  const desk = useGameStore((s) =>
    agentId === "boss" ? null : (s.agents.get(agentId)?.desk ?? null),
  );
  const rows = useTeamRows();
  const row = rows.find((r) => r.id === agentId) ?? null;
  const now = useNow();
  // The sheet follows a pull down on its head and closes past a point.
  const { box, handlers: pullHandlers } =
    useSheetPull<HTMLDivElement>(closeFocusPopup);
  // Focus inside while open; given back the moment it starts closing.
  useDialogFocus(box, { active: !leaving, onEscape: closeFocusPopup });

  // Desktop: the measured card height and the window size place the popover.
  const [height, setHeight] = useState(POPOVER_HEIGHT);
  const [, setViewport] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (phone || !el) return;
    // The natural height: the content plus the borders (not capped).
    const observer = new ResizeObserver(() =>
      setHeight(el.scrollHeight + el.offsetHeight - el.clientHeight),
    );
    observer.observe(el);
    const onResize = () => setViewport((n) => n + 1);
    window.addEventListener("resize", onResize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, [phone, box]);

  const tool = useMemo(
    () => lastToolByAgent(eventLog).get(agentId) ?? null,
    [eventLog, agentId],
  );
  const recent = useMemo(
    () => recentActions(eventLog, agentId, RECENT_LIMIT),
    [eventLog, agentId],
  );

  const seenAt = useMemo(
    () => firstSeenAt(eventLog, agentId),
    [eventLog, agentId],
  );

  const handleFocusTerminal = useCallback(() => {
    if (!sessionId) return;
    focusAgentTerminal(sessionId, agentId === "boss" ? null : agentId);
  }, [sessionId, focusAgentTerminal, agentId]);

  if (!row) return null;

  const state = cardState(row);
  const role = row.isBoss
    ? t("card.roleLead")
    : (agentType ?? t("card.roleSubagent"));
  const target = row.busy || row.waiting ? toolTarget(tool) : null;
  // No lifespan from the whiteboard yet: count from the first event in the log.
  const startedAt = row.startedAt ?? seenAt;
  const elapsed = startedAt !== null ? formatDuration(now - startedAt) : "—";
  // Tokens and cost from this person's own transcript ("—" until known).
  const spent = cardUsage(usage);

  const head = (
    <>
      {/* Head: who, role, state */}
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-[16px] font-extrabold text-on-accent"
          style={{ background: row.color }}
        >
          {row.name.slice(0, 1).toUpperCase()}
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="m-0 text-[17px] leading-tight font-extrabold text-ink truncate">
            {row.name}
          </h2>
          <div className="mt-1 flex items-center gap-2 min-w-0">
            <span
              className={`qo-pill !h-6 !px-2.5 !gap-1.5 !text-[11.5px] flex-shrink-0 ${STATE_PILL[state]}`}
            >
              {state === "working" && (
                <span
                  aria-hidden="true"
                  className="qo-live-dot !w-1.5 !h-1.5"
                />
              )}
              {t(`card.state.${state}`)}
            </span>
            <span className="text-[12.5px] font-bold text-ink-soft truncate">
              {role}
              {desk !== null && ` · ${t("card.desk")} ${desk}`}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={closeFocusPopup}
          aria-label={t("modal.close")}
          className="qo-icon-btn -mr-2 -mt-2"
          data-autofocus
        >
          <X size={18} />
        </button>
      </div>
    </>
  );

  const body = (
    <>
      {/* Now: the action and what it works on */}
      <div className="mt-3 rounded-xl2 bg-panel-2 border border-line p-3">
        <div className="qo-eyebrow">{t("card.now")}</div>
        <p
          className={`m-0 mt-1 text-[14px] font-extrabold truncate ${
            row.waiting ? "text-max" : row.busy ? "text-accent" : "text-ink"
          }`}
        >
          {row.action}
        </p>
        {target && (
          <p
            className="m-0 mt-0.5 font-mono text-[12px] text-ink-soft truncate"
            title={target}
          >
            {target}
          </p>
        )}
        {row.view.kind !== "none" && (
          <div className="mt-2">
            <ActivityBar view={row.view} color={row.color} />
          </div>
        )}
      </div>

      {row.task && (
        <div className="mt-3">
          <div className="qo-eyebrow">{t("card.task")}</div>
          <p className="m-0 mt-1 text-[13px] text-ink-soft line-clamp-3">
            {row.task}
          </p>
        </div>
      )}

      {/* Numbers */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Stat label={t("card.elapsed")} value={elapsed} />
        <Stat label={t("card.tools")} value={String(row.toolCount)} />
        <Stat
          label={t("card.tokens")}
          value={spent.tokens}
          title={spent.title}
        />
        <Stat label={t("card.cost")} value={spent.cost} title={spent.title} />
      </div>

      {/* Recent actions */}
      <div className="mt-3">
        <div className="qo-eyebrow">{t("card.recent")}</div>
        {recent.length === 0 ? (
          <p className="m-0 mt-1 text-[12.5px] text-ink-faint">
            {t("card.noRecent")}
          </p>
        ) : (
          <ul className="m-0 mt-1 p-0 list-none space-y-1">
            {recent.map((r, i) => (
              <li
                key={`${r.at}-${i}`}
                className="flex items-center gap-2 text-[12.5px]"
              >
                <span
                  aria-hidden="true"
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{
                    background: i === 0 ? row.color : "var(--qo-line-strong)",
                  }}
                />
                <span className="flex-1 min-w-0 font-bold text-ink truncate">
                  {r.text}
                </span>
                <span className="flex-shrink-0 text-ink-faint tabular-nums">
                  {t("card.ago", { time: formatDuration(now - r.at) })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Actions */}
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => jumpToLog(agentId)}
          className={`qo-btn qo-btn-primary flex-1 ${phone ? "qo-btn-lg" : ""}`}
        >
          <ScrollText size={16} aria-hidden="true" />
          {t("card.jumpToLog")}
        </button>
        <button
          type="button"
          onClick={handleFocusTerminal}
          className={`qo-btn qo-btn-secondary ${phone ? "qo-btn-lg" : ""}`}
          title={t("card.terminalTitle")}
        >
          <SquareTerminal size={16} aria-hidden="true" />
          {t("card.terminal")}
        </button>
      </div>
    </>
  );

  if (phone) {
    return (
      <div
        className={`fixed inset-0 z-[90] flex items-end justify-center bg-scrim ${
          leaving ? "qo-fade-out pointer-events-none" : "qo-fade-in"
        }`}
        onClick={closeFocusPopup}
      >
        <div
          ref={box}
          role="dialog"
          aria-modal="true"
          aria-label={row.name}
          onClick={(e) => e.stopPropagation()}
          className={`${
            leaving ? "qo-sheet-down" : "qo-sheet-up"
          } w-full max-w-[560px] max-h-[88svh] overflow-y-auto overscroll-contain rounded-t-xl3 bg-panel border border-line border-b-0 shadow-[0_-8px_32px_var(--qo-float-shade)] [--qo-gutter:20px] pb-[max(16px,env(safe-area-inset-bottom))] qo-safe-x`}
        >
          {/* The handle and the head: pull down here to close */}
          <div className="touch-none pt-2.5" {...pullHandlers}>
            <span
              aria-hidden="true"
              className="block w-10 h-1 mx-auto mb-3 rounded-full bg-line-strong"
            />
            {head}
          </div>
          {body}
        </div>
      </div>
    );
  }

  // Desktop: beside the character, kept inside the stage.
  const place = placePopover(
    { x: screenX, y: screenY },
    { width: POPOVER_WIDTH, height },
    stageRect(),
  );

  return (
    <div
      className={`fixed inset-0 z-[90] ${leaving ? "pointer-events-none" : ""}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeFocusPopup();
      }}
    >
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-label={row.name}
        data-side={place.side}
        className={`absolute qo-card ${
          leaving ? "qo-pop-out" : "qo-pop"
        } p-4 shadow-[0_12px_40px_var(--qo-float-shade)] overflow-y-auto overscroll-contain`}
        style={{
          left: place.left,
          top: place.top,
          width: POPOVER_WIDTH,
          maxHeight: place.maxHeight,
        }}
      >
        {head}
        {body}
      </div>
    </div>
  );
}
