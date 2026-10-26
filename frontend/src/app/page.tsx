/**
 * Claude Office Visualizer - Main Page
 *
 * Uses the unified Zustand store, XState machines, and OfficeGame component.
 * Layout and logic are delegated to extracted components and custom hooks.
 *
 * One view: the office (sessions sidebar + canvas + team/events sidebar on
 * desktop, MobileOffice on phones). One session at a time.
 */

"use client";

import {
  browserStorage,
  readStoredFlag,
  writeStoredFlag,
} from "@/utils/storedSize";
import dynamic from "next/dynamic";
import { useState, useEffect, useCallback } from "react";
import { useWebSocketEvents } from "@/hooks/useWebSocketEvents";
import { useSessions } from "@/hooks/useSessions";
import { useSessionSwitch } from "@/hooks/useSessionSwitch";
import { useLayoutMode } from "@/hooks/useLayoutMode";
import { useFocusMode } from "@/hooks/useFocusMode";
import { useBackgroundAlerts } from "@/hooks/useBackgroundAlerts";
import {
  useGameStore,
  selectIsConnected,
  selectDebugMode,
} from "@/stores/gameStore";
import { useTourStore } from "@/stores/tourStore";
import { initApiKeyFromBrowser, loadAuthStatus } from "@/utils/api";
import { Map, Minimize2 } from "lucide-react";
import { SessionSidebar } from "@/components/layout/SessionSidebar";
import { MobileOffice } from "@/components/layout/MobileOffice";
import { BrandMark } from "@/components/layout/BrandMark";
import { AccessTokenPrompt } from "@/components/layout/AccessTokenPrompt";
import { RightSidebar } from "@/components/layout/RightSidebar";
import { HudStats } from "@/components/layout/HudStats";
import { HeaderControls } from "@/components/layout/HeaderControls";
import {
  StatusToast,
  type StatusMessage,
} from "@/components/layout/StatusToast";
import Modal from "@/components/overlay/Modal";
import SettingsModal from "@/components/overlay/SettingsModal";
import { TourOverlay } from "@/components/tour/TourOverlay";
import CommandBar from "@/components/attention/CommandBar";
import AttentionToasts from "@/components/attention/AttentionToasts";
import AgentPopup from "@/components/attention/AgentPopup";
import { useAttentionStore } from "@/stores/attentionStore";
import { usePreferencesStore } from "@/stores/preferencesStore";
import { useTranslation } from "@/hooks/useTranslation";
import type { Session } from "@/hooks/useSessions";

// ============================================================================
// DYNAMIC IMPORT
// ============================================================================

function LoadingFallback() {
  const { t } = useTranslation();
  return (
    <div className="w-full h-full qo-studio flex flex-col items-center justify-center gap-3 text-center">
      <span className="qo-spinner !w-10 !h-10 !border-4" aria-hidden="true" />
      <span className="text-[13px] font-bold text-ink-soft">
        {t("app.initializingSystems")}
      </span>
    </div>
  );
}

const OfficeGame = dynamic(
  () =>
    import("@/components/game/OfficeGame").then((m) => ({
      default: m.OfficeGame,
    })),
  {
    ssr: false,
    loading: () => <LoadingFallback />,
  },
);

// ============================================================================
// PAGE COMPONENT
// ============================================================================

export default function V2TestPage(): React.ReactNode {
  // ------------------------------------------------------------------
  // i18n
  // ------------------------------------------------------------------
  const { t } = useTranslation();

  // ------------------------------------------------------------------
  // UI-only state
  // ------------------------------------------------------------------
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(
    null,
  );
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(false);
  // The collapsed sessions panel is remembered (restored after mount).
  useEffect(() => {
    const restore = () => {
      const stored = readStoredFlag(browserStorage(), "qo-left-collapsed");
      if (stored !== null) setLeftSidebarCollapsed(stored);
    };
    restore();
  }, []);
  const layoutMode = useLayoutMode();
  const isMobile = layoutMode !== "desktop";
  // Focus mode: header and side panels hidden, the office fills the window
  const focus = useFocusMode(!isMobile);
  const focused = focus.focused;

  // Session pending delete drives the delete-confirmation modal
  const [sessionPendingDelete, setSessionPendingDelete] =
    useState<Session | null>(null);

  // ------------------------------------------------------------------
  // Status toast helper (stable reference via useCallback)
  // ------------------------------------------------------------------
  const showStatus = useCallback(
    (text: string, type: "info" | "error" | "success" = "info") => {
      setStatusMessage({ text, type });
      setTimeout(() => setStatusMessage(null), 3000);
    },
    [],
  );

  // ------------------------------------------------------------------
  // Session management hooks
  // ------------------------------------------------------------------
  const { sessions, sessionsLoading, sessionId, setSessionId, fetchSessions } =
    useSessions(showStatus);

  const {
    handleSessionSelect,
    handleDeleteSession,
    handleClearDB,
    handleSimulate,
    handleReset,
    handleRenameSession,
  } = useSessionSwitch({ sessionId, setSessionId, fetchSessions, showStatus });

  // ------------------------------------------------------------------
  // Store subscriptions
  // ------------------------------------------------------------------
  const isConnected = useGameStore(selectIsConnected);
  const debugMode = useGameStore(selectDebugMode);
  const loadPersistedDebugSettings = useGameStore(
    (state) => state.loadPersistedDebugSettings,
  );
  const loadPreferences = usePreferencesStore((s) => s.loadPreferences);

  // Onboarding tour now lives in the Help modal (rarely used).
  const startTour = useTourStore((s) => s.startTour);
  const handleStartTour = (): void => {
    startTour();
    setIsHelpModalOpen(false);
  };

  // ------------------------------------------------------------------
  // Tour initialization
  // ------------------------------------------------------------------
  const loadTourSeen = useTourStore((s) => s.loadTourSeen);
  useEffect(() => {
    loadTourSeen();
  }, [loadTourSeen]);

  // ------------------------------------------------------------------
  // WebSocket connection — reconnects when sessionId changes
  // ------------------------------------------------------------------
  useWebSocketEvents({ sessionId });
  useBackgroundAlerts();

  // ------------------------------------------------------------------
  // One-time initialization effects
  // ------------------------------------------------------------------
  useEffect(() => {
    initApiKeyFromBrowser();
    // On a trusted network (tailnet / loopback) the token prompt never shows.
    void loadAuthStatus();
  }, []);

  useEffect(() => {
    loadPersistedDebugSettings();
  }, [loadPersistedDebugSettings]);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  useEffect(() => {
    document.documentElement.lang = "en";
  }, []);

  // Phone styles (44px touch targets) key off this, portaled dialogs too.
  useEffect(() => {
    document.documentElement.dataset.layout = layoutMode;
  }, [layoutMode]);

  // ------------------------------------------------------------------
  // Cmd+K / Ctrl+K command bar toggle
  // ------------------------------------------------------------------
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.querySelector("[role='dialog'][aria-modal='true']")) return;
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        const prefs = usePreferencesStore.getState();
        if (!prefs.commandBarEnabled) return;
        const { isCommandBarOpen, closeCommandBar, openCommandBar } =
          useAttentionStore.getState();
        if (isCommandBarOpen) {
          closeCommandBar();
        } else {
          openCommandBar();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // ------------------------------------------------------------------
  // Derived handlers
  // ------------------------------------------------------------------
  const handleToggleDebug = () =>
    useGameStore.getState().setDebugMode(!debugMode);

  const handleConfirmClearDB = async () => {
    setIsClearModalOpen(false);
    await handleClearDB();
  };

  const handleConfirmDeleteSession = async () => {
    if (!sessionPendingDelete) return;
    const pending = sessionPendingDelete;
    setSessionPendingDelete(null);
    await handleDeleteSession(pending);
  };

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <main
      className={`qo-bg flex h-screen h-[100dvh] flex-col overflow-hidden relative ${
        focused ? "p-0" : "p-3"
      }`}
      data-focus={focused ? "on" : undefined}
    >
      {/* ----------------------------------------------------------------
          Modals
      ---------------------------------------------------------------- */}
      <Modal
        isOpen={isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
        title={t("modal.confirmDbWipe")}
        footer={
          <>
            <button
              onClick={() => setIsClearModalOpen(false)}
              className="qo-btn qo-btn-lg qo-btn-ghost"
            >
              {t("modal.cancel")}
            </button>
            <button
              onClick={handleConfirmClearDB}
              className="qo-btn qo-btn-lg qo-btn-danger"
            >
              {t("modal.wipeAllData")}
            </button>
          </>
        }
      >
        <p>{t("modal.wipeWarning")}</p>
      </Modal>

      <Modal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
        title={t("modal.keyboardShortcuts")}
        footer={
          <>
            <button
              onClick={handleStartTour}
              className="qo-btn qo-btn-lg qo-btn-secondary"
            >
              <Map size={16} />
              {t("help.tour")}
            </button>
            <button
              onClick={() => setIsHelpModalOpen(false)}
              className="qo-btn qo-btn-lg qo-btn-primary"
            >
              {t("modal.close")}
            </button>
          </>
        }
      >
        <div className="qo-group">
          {(
            [
              ["F", t("modal.focusMode")],
              ["D", t("modal.toggleDebug")],
              ["P", t("modal.showAgentPaths")],
              ["Q", t("modal.showQueueSlots")],
              ["L", t("modal.showPhaseLabels")],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="qo-group-row">
              <kbd className="qo-kbd">{key}</kbd>
              <span className="text-[14px] font-bold text-ink">{label}</span>
            </div>
          ))}
        </div>
      </Modal>

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
      />

      <Modal
        isOpen={sessionPendingDelete !== null}
        onClose={() => setSessionPendingDelete(null)}
        title={t("modal.deleteSession")}
        footer={
          <>
            <button
              onClick={() => setSessionPendingDelete(null)}
              className="qo-btn qo-btn-lg qo-btn-ghost"
            >
              {t("modal.cancel")}
            </button>
            <button
              onClick={handleConfirmDeleteSession}
              className="qo-btn qo-btn-lg qo-btn-danger"
            >
              {t("modal.delete")}
            </button>
          </>
        }
      >
        <p>
          {t("modal.deleteSessionConfirm")}{" "}
          <span className="font-extrabold text-ink">
            {sessionPendingDelete?.projectName ||
              sessionPendingDelete?.id.slice(0, 8)}
          </span>
          ?
        </p>
        <p className="m-0 mt-2 text-[13.5px] text-ink-faint">
          {t("modal.deleteSessionWarning")}{" "}
          {sessionPendingDelete?.eventCount ?? 0} {t("modal.events")}.{" "}
          {t("modal.cannotBeUndone")}
        </p>
      </Modal>

      {isMobile ? (
        /* ----------------------------------------------------------------
            Phone: the office with a tab bar (portrait) or a rail (landscape)
        ---------------------------------------------------------------- */
        <MobileOffice
          orientation={layoutMode === "landscape" ? "landscape" : "portrait"}
          scene={<OfficeGame />}
          isConnected={isConnected}
          debugMode={debugMode}
          sessions={sessions}
          sessionsLoading={sessionsLoading}
          sessionId={sessionId}
          onSessionSelect={handleSessionSelect}
          onSimulate={handleSimulate}
          onReset={handleReset}
          onClearDB={() => setIsClearModalOpen(true)}
          onToggleDebug={handleToggleDebug}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
          onOpenHelp={() => setIsHelpModalOpen(true)}
        />
      ) : focused ? null : (
        /* ----------------------------------------------------------------
            Desktop header: the mark, the counters, the controls
        ---------------------------------------------------------------- */
        <header className="flex shrink-0 justify-between items-center gap-4 mb-3 pl-1 relative h-12">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <BrandMark
              size={38}
              title={`Qodirjon ${t("app.title")}`}
              subtitle={t("app.subtitle")}
            />
          </div>

          <div className="hidden xl:flex justify-center min-w-0">
            <HudStats />
          </div>

          <div className="flex flex-1 justify-end min-w-0">
            <HeaderControls
              isConnected={isConnected}
              debugMode={debugMode}
              onSimulate={handleSimulate}
              onReset={handleReset}
              onClearDB={() => setIsClearModalOpen(true)}
              onToggleDebug={handleToggleDebug}
              onOpenSettings={() => setIsSettingsModalOpen(true)}
              onOpenHelp={() => setIsHelpModalOpen(true)}
              onToggleFocus={focus.toggle}
            />
          </div>
        </header>
      )}

      {/* ----------------------------------------------------------------
          Main Content
      ---------------------------------------------------------------- */}
      {isMobile ? null : (
        /* ----------------------------------------------------------------
            The office: sessions, the scene, the team and events
        ---------------------------------------------------------------- */
        <div
          className={`flex-grow flex overflow-hidden min-h-0 ${
            focused ? "" : "gap-2"
          }`}
        >
          {/* Hidden, not unmounted, in focus mode: panels keep their state */}
          <div className={focused ? "hidden" : "contents"}>
            <SessionSidebar
              sessions={sessions}
              sessionsLoading={sessionsLoading}
              sessionId={sessionId}
              isCollapsed={leftSidebarCollapsed}
              onToggleCollapsed={() => {
                setLeftSidebarCollapsed(!leftSidebarCollapsed);
                writeStoredFlag(
                  browserStorage(),
                  "qo-left-collapsed",
                  !leftSidebarCollapsed,
                );
              }}
              onSessionSelect={handleSessionSelect}
              onDeleteSession={setSessionPendingDelete}
              onRenameSession={handleRenameSession}
            />
          </div>

          <div
            data-tour-id="game-canvas"
            className={`qo-stage qo-studio flex-grow overflow-hidden relative ${
              focused ? "qo-stage-focus" : ""
            }`}
          >
            {/* The scene fills the stage; the canvas takes its shape */}
            <div className="qo-stage-inner">
              <div className="qo-stage-screen">
                <OfficeGame />
              </div>
            </div>
            {focused && (
              <button
                type="button"
                onClick={focus.exit}
                className="qo-focus-exit qo-btn qo-btn-secondary"
                title={t("header.exitFocus")}
                aria-label={t("header.exitFocus")}
              >
                <Minimize2 size={16} />
                Esc
              </button>
            )}
          </div>

          <div className={focused ? "hidden" : "contents"}>
            <RightSidebar />
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------
          Attention System
      ---------------------------------------------------------------- */}
      <CommandBar />
      <AttentionToasts />
      <AgentPopup />

      {/* The backend answered 401: ask for the access token */}
      <AccessTokenPrompt onSaved={() => void fetchSessions()} />

      {/* ----------------------------------------------------------------
          Tour Overlay
      ---------------------------------------------------------------- */}
      <TourOverlay />

      {/* ----------------------------------------------------------------
          Status Toast — pinned bottom-center so it never covers the header
      ---------------------------------------------------------------- */}
      <div
        className={`fixed left-1/2 -translate-x-1/2 z-50 flex items-center pointer-events-none ${
          layoutMode === "portrait"
            ? "bottom-[calc(var(--qo-bar-h)+env(safe-area-inset-bottom)+12px)]"
            : "bottom-[max(24px,env(safe-area-inset-bottom))]"
        }`}
      >
        <StatusToast message={statusMessage} />
      </div>
    </main>
  );
}
