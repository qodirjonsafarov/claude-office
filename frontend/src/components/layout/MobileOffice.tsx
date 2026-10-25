"use client";

import { useState, type ReactNode } from "react";
import {
  Bug,
  HelpCircle,
  LayoutGrid,
  Play,
  RefreshCw,
  Settings,
  Trash2,
} from "lucide-react";
import { BrandMark } from "@/components/layout/BrandMark";
import { ConversationHistory } from "@/components/layout/ConversationHistory";
import { EventLog } from "@/components/layout/EventLog";
import { HudStats } from "@/components/layout/HudStats";
import { MobileAgentActivity } from "@/components/layout/MobileAgentActivity";
import { MobileSessionList } from "@/components/layout/MobileSessionList";
import { MobileSheet } from "@/components/layout/MobileSheet";
import { MobileTabBar, type MobileTab } from "@/components/layout/MobileTabBar";
import { useTranslation } from "@/hooks/useTranslation";
import type { Session } from "@/hooks/useSessions";
import { useGameStore, selectEventLog } from "@/stores/gameStore";
import { useNavigationStore } from "@/stores/navigationStore";
import { countWorking } from "@/utils/workStatus";

// ============================================================================
// TYPES
// ============================================================================

interface MobileOfficeProps {
  /** "portrait": bars on top and bottom; "landscape": a rail at the side. */
  orientation: "portrait" | "landscape";
  /** The office scene (OfficeGame). */
  scene: ReactNode;
  isConnected: boolean;
  debugMode: boolean;
  aiSummaryEnabled: boolean | null;
  activeSessionCount: number;
  sessions: Session[];
  sessionsLoading: boolean;
  sessionId: string;
  onSessionSelect: (id: string) => Promise<void>;
  onSimulate: () => Promise<void>;
  onReset: () => void;
  onClearDB: () => void;
  onToggleDebug: () => void;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
}

// ============================================================================
// HELPERS
// ============================================================================

/** How many events came after `since` (the log is newest first). */
function countNewer(log: { timestamp: Date }[], since: number): number {
  let count = 0;
  for (const entry of log) {
    if (entry.timestamp.getTime() <= since) break;
    count += 1;
  }
  return count;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * The office on a phone, in the Olymp look. The office is the home tab and
 * stays on screen; events, sessions and the actions open as sheets over it.
 * Portrait: a glass top bar, the office across the full width, the team list
 * under it and the tab bar under the thumb. Landscape: a rail of tabs at the
 * side, the office filling the height and the team list beside it.
 */
export function MobileOffice({
  orientation,
  scene,
  isConnected,
  debugMode,
  aiSummaryEnabled,
  activeSessionCount,
  sessions,
  sessionsLoading,
  sessionId,
  onSessionSelect,
  onSimulate,
  onReset,
  onClearDB,
  onToggleDebug,
  onOpenSettings,
  onOpenHelp,
}: MobileOfficeProps): React.ReactNode {
  const { t } = useTranslation();
  const [tab, setTab] = useState<MobileTab>("office");
  const [logTab, setLogTab] = useState<"events" | "conversation">("events");
  const [eventsSeenAt, setEventsSeenAt] = useState(() => Date.now());
  const goToCommand = useNavigationStore((s) => s.goToCommand);

  const eventLog = useGameStore(selectEventLog);
  const working = useGameStore((s) =>
    countWorking(s.boss.backendState, s.agents.values()),
  );
  const newEvents = tab === "events" ? 0 : countNewer(eventLog, eventsSeenAt);

  const close = () => {
    if (tab === "events") setEventsSeenAt(Date.now());
    setTab("office");
  };
  const select = (next: MobileTab) => {
    if (tab === "events") setEventsSeenAt(Date.now());
    setTab(next === tab ? "office" : next);
  };
  const run = (action: () => void) => () => {
    setTab("office");
    action();
  };

  const landscape = orientation === "landscape";

  const status = (
    <div
      className={working > 0 ? "qo-pill qo-pill-accent" : "qo-pill"}
      title={isConnected ? t("header.connected") : t("header.disconnected")}
    >
      <span
        aria-hidden="true"
        className={`qo-live-dot ${
          !isConnected
            ? "qo-live-dot-off"
            : working > 0
              ? ""
              : "qo-live-dot-idle"
        }`}
      />
      {!isConnected
        ? t("header.disconnected")
        : working > 0
          ? t("mobile.workingNow", { count: working })
          : t("mobile.allIdle")}
    </div>
  );

  const stage = (
    <div data-tour-id="game-canvas" className="qo-stage-phone qo-studio">
      {scene}
    </div>
  );

  const actionClass =
    "w-full min-h-[48px] px-4 rounded-xl2 flex items-center gap-3 text-[14.5px] font-bold text-left transition-colors";

  return (
    <div
      className={`fixed inset-0 flex ${landscape ? "flex-row" : "flex-col"} bg-appbg`}
    >
      {landscape ? (
        <div className="flex flex-col items-center pl-[env(safe-area-inset-left)] qo-glass-panel border-r border-line">
          <div className="pt-3 pb-1 pl-[10px] pr-[10px]">
            <BrandMark size={40} />
          </div>
          <div className="flex-1 flex items-center">
            <MobileTabBar
              variant="rail"
              active={tab}
              onSelect={select}
              badges={{ events: newEvents }}
            />
          </div>
          <div className="pb-[max(12px,env(safe-area-inset-bottom))]" />
        </div>
      ) : (
        <header className="flex-shrink-0 qo-glass border-b border-line qo-safe-top qo-safe-x">
          <div className="h-14 px-3.5 flex items-center justify-between gap-3">
            <BrandMark size={38} title="Qodirjon" />
            {status}
          </div>
        </header>
      )}

      {landscape ? (
        <main className="flex-1 min-w-0 flex gap-3 p-3 pr-[max(12px,env(safe-area-inset-right))] pb-[max(12px,env(safe-area-inset-bottom))]">
          <div className="relative flex-1 min-w-0 [container-type:size]">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-[min(100cqw,125cqh)]">{stage}</div>
            </div>
          </div>
          <div className="w-[clamp(190px,32%,280px)] flex flex-col gap-2 min-h-0">
            {status}
            <MobileAgentActivity className="flex-1" />
          </div>
        </main>
      ) : (
        <main className="flex-1 min-h-0 flex flex-col gap-3 py-3 qo-safe-x [--qo-gutter:12px]">
          {stage}
          <div className="-mx-3 px-3 overflow-x-auto flex-shrink-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <HudStats />
          </div>
          <MobileAgentActivity className="flex-1" />
        </main>
      )}

      {!landscape && (
        <MobileTabBar
          variant="bar"
          active={tab}
          onSelect={select}
          badges={{ events: newEvents }}
        />
      )}

      {tab === "events" && (
        <MobileSheet title={t("mobile.events")} onClose={close} fill>
          <div role="tablist" className="qo-segmented mb-3 flex-shrink-0">
            <button
              type="button"
              role="tab"
              aria-selected={logTab === "events"}
              onClick={() => setLogTab("events")}
            >
              {t("sidebar.events")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={logTab === "conversation"}
              onClick={() => setLogTab("conversation")}
            >
              {t("sidebar.conversation")}
            </button>
          </div>
          <div className="flex-1 min-h-0">
            {logTab === "events" ? <EventLog /> : <ConversationHistory />}
          </div>
        </MobileSheet>
      )}

      {tab === "sessions" && (
        <MobileSheet
          title={t("sessions.title")}
          note={String(sessions.length)}
          onClose={close}
        >
          <MobileSessionList
            sessions={sessions}
            sessionsLoading={sessionsLoading}
            sessionId={sessionId}
            onSessionSelect={(id) => {
              setTab("office");
              void onSessionSelect(id);
            }}
          />
        </MobileSheet>
      )}

      {tab === "more" && (
        <MobileSheet title={t("mobile.actions")} onClose={close}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {status}
              <div className="qo-pill">
                <span
                  className={
                    aiSummaryEnabled ? "text-accent" : "text-ink-faint"
                  }
                >
                  AI {aiSummaryEnabled ? t("header.aiOn") : t("header.aiOff")}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              {activeSessionCount >= 2 && (
                <button
                  type="button"
                  onClick={run(goToCommand)}
                  className={`${actionClass} text-ink hover:bg-panel-2`}
                >
                  <LayoutGrid size={20} className="text-ink-faint" />
                  {t("commandCenter.title")}
                </button>
              )}
              <button
                type="button"
                onClick={run(onOpenSettings)}
                className={`${actionClass} text-ink hover:bg-panel-2`}
              >
                <Settings size={20} className="text-ink-faint" />
                {t("header.settings")}
              </button>
              <button
                type="button"
                onClick={run(onOpenHelp)}
                className={`${actionClass} text-ink hover:bg-panel-2`}
              >
                <HelpCircle size={20} className="text-ink-faint" />
                {t("header.help")}
              </button>
            </div>

            <div className="qo-eyebrow px-1">{t("header.more")}</div>
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={run(() => void onSimulate())}
                className={`${actionClass} text-ink hover:bg-panel-2`}
              >
                <Play size={20} className="text-accent" />
                {t("header.simulate")}
              </button>
              <button
                type="button"
                onClick={run(onReset)}
                className={`${actionClass} text-ink hover:bg-panel-2`}
              >
                <RefreshCw size={20} className="text-warn" />
                {t("header.reset")}
              </button>
              <button
                type="button"
                onClick={run(onToggleDebug)}
                aria-pressed={debugMode}
                className={`${actionClass} hover:bg-panel-2 ${
                  debugMode ? "text-accent" : "text-ink"
                }`}
              >
                <Bug size={20} className="text-ink-faint" />
                {debugMode ? t("header.debugOn") : t("header.debugOff")}
              </button>
              <button
                type="button"
                onClick={run(onClearDB)}
                className={`${actionClass} text-danger bg-danger-dim mt-2`}
              >
                <Trash2 size={20} />
                {t("header.clearDb")}
              </button>
            </div>
          </div>
        </MobileSheet>
      )}
    </div>
  );
}
