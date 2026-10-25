"use client";

import { ReactNode } from "react";
import Modal from "./Modal";
import {
  usePreferencesStore,
  type ClockType,
  type ClockFormat,
} from "@/stores/preferencesStore";
import { useTranslation } from "@/hooks/useTranslation";

// ============================================================================
// TYPES
// ============================================================================

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// ============================================================================
// HELPER COMPONENT
// ============================================================================

function SettingsToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}): ReactNode {
  return (
    <div
      role="switch"
      aria-checked={checked}
      aria-label={label}
      tabIndex={0}
      onClick={onChange}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onChange();
        }
      }}
      className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800 border border-slate-700 cursor-pointer hover:border-slate-600 transition-colors"
    >
      <span className="text-slate-300 text-sm">{label}</span>
      <div
        className={`w-9 h-5 rounded-full relative transition-colors ${
          checked ? "bg-purple-500" : "bg-slate-600"
        }`}
      >
        <div
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-md transition-transform ${
            checked ? "translate-x-[18px]" : "translate-x-0.5"
          }`}
        />
      </div>
    </div>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function SettingsModal({
  isOpen,
  onClose,
}: SettingsModalProps): ReactNode {
  const clockType = usePreferencesStore((s) => s.clockType);
  const clockFormat = usePreferencesStore((s) => s.clockFormat);
  const autoFollowNewSessions = usePreferencesStore(
    (s) => s.autoFollowNewSessions,
  );
  const setClockType = usePreferencesStore((s) => s.setClockType);
  const setClockFormat = usePreferencesStore((s) => s.setClockFormat);
  const setAutoFollowNewSessions = usePreferencesStore(
    (s) => s.setAutoFollowNewSessions,
  );

  // Attention settings
  const commandBarEnabled = usePreferencesStore((s) => s.commandBarEnabled);
  const clickToFocusEnabled = usePreferencesStore((s) => s.clickToFocusEnabled);
  const toastFilterPermission = usePreferencesStore(
    (s) => s.toastFilterPermission,
  );
  const toastFilterError = usePreferencesStore((s) => s.toastFilterError);
  const toastFilterTaskComplete = usePreferencesStore(
    (s) => s.toastFilterTaskComplete,
  );
  const toastFilterArrival = usePreferencesStore((s) => s.toastFilterArrival);
  const setCommandBarEnabled = usePreferencesStore(
    (s) => s.setCommandBarEnabled,
  );
  const setClickToFocusEnabled = usePreferencesStore(
    (s) => s.setClickToFocusEnabled,
  );
  const setToastFilterPermission = usePreferencesStore(
    (s) => s.setToastFilterPermission,
  );
  const setToastFilterError = usePreferencesStore((s) => s.setToastFilterError);
  const setToastFilterTaskComplete = usePreferencesStore(
    (s) => s.setToastFilterTaskComplete,
  );
  const setToastFilterArrival = usePreferencesStore(
    (s) => s.setToastFilterArrival,
  );

  const { t } = useTranslation();

  const handleClockTypeChange = (type: ClockType) => {
    setClockType(type);
  };

  const handleClockFormatChange = (format: ClockFormat) => {
    setClockFormat(format);
  };

  const handleAutoFollowToggle = () => {
    setAutoFollowNewSessions(!autoFollowNewSessions);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      dismissible={false}
      title={t("settings.title")}
      footer={
        <button onClick={onClose} className="qo-btn qo-btn-lg qo-btn-primary">
          {t("modal.close")}
        </button>
      }
    >
      <div className="space-y-6">
        {/* Clock Type */}
        <div>
          <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-3">
            {t("settings.clockType")}
          </label>
          <div
            className="flex gap-3"
            role="radiogroup"
            aria-label={t("settings.clockType")}
          >
            {(["analog", "digital"] as const).map((type) => (
              <button
                key={type}
                type="button"
                role="radio"
                aria-checked={clockType === type}
                tabIndex={clockType === type ? 0 : -1}
                onClick={() => handleClockTypeChange(type)}
                onKeyDown={(e) => {
                  const values: ClockType[] = ["analog", "digital"];
                  const parent = e.currentTarget.parentElement;
                  if (!parent) return;
                  const buttons = Array.from(parent.children) as HTMLElement[];
                  const idx = buttons.indexOf(e.currentTarget);
                  let nextIdx: number | null = null;
                  if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                    e.preventDefault();
                    nextIdx = (idx + 1) % values.length;
                  } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                    e.preventDefault();
                    nextIdx = (idx - 1 + values.length) % values.length;
                  }
                  if (nextIdx !== null) {
                    handleClockTypeChange(values[nextIdx]);
                    buttons[nextIdx].focus();
                  }
                }}
                className={`flex-1 px-4 py-3 rounded-lg border text-sm font-bold transition-colors focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 outline-none ${
                  clockType === type
                    ? "bg-purple-500/20 border-purple-500 text-purple-300"
                    : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"
                }`}
              >
                {type === "analog"
                  ? t("settings.analog")
                  : t("settings.digital")}
              </button>
            ))}
          </div>
        </div>

        {/* Time Format - only visible when digital */}
        {clockType === "digital" && (
          <div>
            <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-3">
              {t("settings.timeFormat")}
            </label>
            <div
              className="flex gap-3"
              role="radiogroup"
              aria-label={t("settings.timeFormat")}
            >
              {(["12h", "24h"] as const).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  role="radio"
                  aria-checked={clockFormat === fmt}
                  tabIndex={clockFormat === fmt ? 0 : -1}
                  onClick={() => handleClockFormatChange(fmt)}
                  onKeyDown={(e) => {
                    const values: ClockFormat[] = ["12h", "24h"];
                    const parent = e.currentTarget.parentElement;
                    if (!parent) return;
                    const buttons = Array.from(
                      parent.children,
                    ) as HTMLElement[];
                    const idx = buttons.indexOf(e.currentTarget);
                    let nextIdx: number | null = null;
                    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                      e.preventDefault();
                      nextIdx = (idx + 1) % values.length;
                    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                      e.preventDefault();
                      nextIdx = (idx - 1 + values.length) % values.length;
                    }
                    if (nextIdx !== null) {
                      handleClockFormatChange(values[nextIdx]);
                      buttons[nextIdx].focus();
                    }
                  }}
                  className={`flex-1 px-4 py-3 rounded-lg border text-sm font-bold transition-colors focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 outline-none ${
                    clockFormat === fmt
                      ? "bg-purple-500/20 border-purple-500 text-purple-300"
                      : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"
                  }`}
                >
                  {fmt === "12h" ? t("settings.12hour") : t("settings.24hour")}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Session Settings */}
        <div className="pt-4 border-t border-slate-800">
          <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-3">
            {t("settings.sessionBehavior")}
          </label>
          <div
            role="switch"
            aria-checked={autoFollowNewSessions}
            aria-label={t("settings.autoFollow")}
            tabIndex={0}
            onClick={handleAutoFollowToggle}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleAutoFollowToggle();
              }
            }}
            className="flex items-center justify-between p-3 rounded-lg bg-slate-800 border border-slate-700 cursor-pointer hover:border-slate-600 transition-colors"
          >
            <div>
              <p className="text-slate-300 text-sm font-medium">
                {t("settings.autoFollow")}
              </p>
              <p className="text-slate-500 text-xs mt-0.5">
                {t("settings.autoFollowDesc")}
              </p>
            </div>
            <div
              className={`w-11 h-6 rounded-full relative transition-colors ${
                autoFollowNewSessions ? "bg-purple-500" : "bg-slate-600"
              }`}
            >
              <div
                className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-md transition-transform ${
                  autoFollowNewSessions ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </div>
          </div>
        </div>

        {/* Controls: command bar and click-to-focus (not toasts) */}
        <div className="pt-4 border-t border-slate-800">
          <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-3">
            {t("settings.controls")}
          </label>
          <div className="space-y-2">
            <SettingsToggle
              label={t("settings.commandBar")}
              checked={commandBarEnabled}
              onChange={() => setCommandBarEnabled(!commandBarEnabled)}
            />
            <SettingsToggle
              label={t("settings.clickToFocus")}
              checked={clickToFocusEnabled}
              onChange={() => setClickToFocusEnabled(!clickToFocusEnabled)}
            />
          </div>
        </div>

        {/* Attention Settings */}
        <div className="pt-4 border-t border-slate-800">
          <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-3">
            {t("settings.toastFilters")}
          </label>
          <div className="space-y-2">
            <SettingsToggle
              label={t("settings.filterPermission")}
              checked={toastFilterPermission}
              onChange={() => setToastFilterPermission(!toastFilterPermission)}
            />
            <SettingsToggle
              label={t("settings.filterError")}
              checked={toastFilterError}
              onChange={() => setToastFilterError(!toastFilterError)}
            />
            <SettingsToggle
              label={t("settings.filterTaskComplete")}
              checked={toastFilterTaskComplete}
              onChange={() =>
                setToastFilterTaskComplete(!toastFilterTaskComplete)
              }
            />
            <SettingsToggle
              label={t("settings.filterArrival")}
              checked={toastFilterArrival}
              onChange={() => setToastFilterArrival(!toastFilterArrival)}
            />
          </div>
        </div>

        {/* Tip */}
        <div className="pt-4 border-t border-slate-800">
          <p className="text-slate-500 text-xs">{t("settings.clockTip")}</p>
        </div>
      </div>
    </Modal>
  );
}
