"use client";

import { HelpCircle, Settings, Bell, Maximize2 } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useAttentionStore, selectUnreadCount } from "@/stores/attentionStore";
import { HeaderMoreMenu } from "@/components/layout/HeaderMoreMenu";

// ============================================================================
// TYPES
// ============================================================================

interface HeaderControlsProps {
  isConnected: boolean;
  debugMode: boolean;
  onSimulate: () => Promise<void>;
  onReset: () => void;
  onClearDB: () => void;
  onToggleDebug: () => void;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
  /** Focus mode: the office fills the screen (also the F key). */
  onToggleFocus: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Desktop-only header controls. Frequently-used entry points (Settings,
 * Help, attention queue) stay visible; the rarely-used
 * developer/maintenance actions live in the "⋯" overflow menu, and the tour
 * moved into the Help modal — keeping the header readable.
 *
 * Hidden on phones — MobileOffice puts those actions in its "More" sheet.
 */
export function HeaderControls({
  isConnected,
  debugMode,
  onSimulate,
  onReset,
  onClearDB,
  onToggleDebug,
  onOpenSettings,
  onOpenHelp,
  onToggleFocus,
}: HeaderControlsProps): React.ReactNode {
  const { t } = useTranslation();
  const unreadCount = useAttentionStore(selectUnreadCount);
  const openCommandBar = useAttentionStore((s) => s.openCommandBar);

  const status = `${t("header.status")}: ${
    isConnected ? t("header.connected") : t("header.disconnected")
  }`;

  return (
    <div className="flex gap-2 items-center">
      {unreadCount > 0 && (
        <div className="qo-capsule">
          <button
            onClick={openCommandBar}
            className="qo-icon-btn-sm !text-max"
            title="Attention Queue"
            aria-label="Attention Queue"
          >
            <Bell size={17} />
            <span className="absolute top-0 right-0 bg-max text-on-accent text-[10.5px] font-extrabold rounded-full min-w-[17px] h-[17px] px-1 flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          </button>
        </div>
      )}

      {/* The connection, then the screen's few controls, in one capsule */}
      <div className="qo-capsule">
        <div className="qo-capsule-item !pl-3 !pr-3.5" title={status}>
          <span
            aria-hidden="true"
            className={`qo-live-dot ${isConnected ? "" : "qo-live-dot-off"}`}
          />
          <span className={isConnected ? "text-ink-soft" : "text-danger"}>
            {isConnected ? t("header.connected") : t("header.disconnected")}
          </span>
        </div>
        <span className="qo-capsule-sep" aria-hidden="true" />

        <button
          onClick={onToggleFocus}
          className="qo-icon-btn-sm"
          title={t("header.focusHint")}
          aria-label={t("header.focus")}
          aria-keyshortcuts="F"
        >
          <Maximize2 size={17} />
        </button>

        <button
          onClick={onOpenSettings}
          data-tour-id="settings-btn"
          className="qo-icon-btn-sm"
          title={t("header.settings")}
          aria-label={t("header.settings")}
        >
          <Settings size={17} />
        </button>

        <button
          onClick={onOpenHelp}
          className="qo-icon-btn-sm"
          title={t("header.help")}
          aria-label={t("header.help")}
        >
          <HelpCircle size={17} />
        </button>

        {/* Rarely-used developer/maintenance actions */}
        <HeaderMoreMenu
          debugMode={debugMode}
          onSimulate={onSimulate}
          onReset={onReset}
          onClearDB={onClearDB}
          onToggleDebug={onToggleDebug}
        />
      </div>
    </div>
  );
}
