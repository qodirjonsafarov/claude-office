"use client";

import { HelpCircle, Settings, Bell } from "lucide-react";
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
}: HeaderControlsProps): React.ReactNode {
  const { t } = useTranslation();
  const unreadCount = useAttentionStore(selectUnreadCount);
  const openCommandBar = useAttentionStore((s) => s.openCommandBar);

  return (
    <div className="flex gap-2 items-center">
      {unreadCount > 0 && (
        <button
          onClick={openCommandBar}
          className="qo-btn qo-btn-secondary relative !text-orange-400"
          title="Attention Queue"
        >
          <Bell size={15} />
          <span className="absolute -top-1.5 -right-1.5 bg-orange-400 text-on-accent text-[9px] font-extrabold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        </button>
      )}

      <button
        onClick={onOpenSettings}
        data-tour-id="settings-btn"
        className="qo-btn qo-btn-secondary"
      >
        <Settings size={15} />
        {t("header.settings")}
      </button>

      <button onClick={onOpenHelp} className="qo-btn qo-btn-secondary">
        <HelpCircle size={15} />
        {t("header.help")}
      </button>

      {/* Rarely-used developer/maintenance actions */}
      <HeaderMoreMenu
        debugMode={debugMode}
        onSimulate={onSimulate}
        onReset={onReset}
        onClearDB={onClearDB}
        onToggleDebug={onToggleDebug}
      />

      {/* Connection status */}
      <div
        className="qo-pill ml-1"
        title={`${t("header.status")}: ${
          isConnected ? t("header.connected") : t("header.disconnected")
        }`}
      >
        <span
          aria-hidden="true"
          className={`qo-live-dot ${isConnected ? "" : "qo-live-dot-off"}`}
        />
        <span className={isConnected ? "text-ink" : "text-danger"}>
          {isConnected ? t("header.connected") : t("header.disconnected")}
        </span>
      </div>
    </div>
  );
}
