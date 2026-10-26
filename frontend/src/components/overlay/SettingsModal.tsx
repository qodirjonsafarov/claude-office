"use client";

import { ReactNode } from "react";
import Modal from "./Modal";
import {
  usePreferencesStore,
  type ClockType,
  type ClockFormat,
} from "@/stores/preferencesStore";
import { useTranslation } from "@/hooks/useTranslation";
import { useThemePref } from "@/systems/themeStore";
import type { ThemePref } from "@/systems/theme";

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
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
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
      className="qo-group-row"
    >
      <div className="min-w-0">
        <p className="m-0 text-[14px] font-bold text-ink">{label}</p>
        {description && (
          <p className="m-0 mt-0.5 text-[12.5px] font-semibold leading-snug text-ink-faint">
            {description}
          </p>
        )}
      </div>
      <span aria-hidden="true" className="qo-switch" data-on={checked} />
    </div>
  );
}

/** A group of settings: a small label, then its controls. */
function Section({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}): ReactNode {
  return (
    <section>
      <h3 className="qo-label m-0 mb-2.5 px-1">{label}</h3>
      {children}
    </section>
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
  const [themePref, setThemePref] = useThemePref();
  const themeLabels: Record<ThemePref, string> = {
    dark: t("settings.themeDark"),
    light: t("settings.themeLight"),
    system: t("settings.themeSystem"),
  };

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
      wide
      footer={
        <button onClick={onClose} className="qo-btn qo-btn-lg qo-btn-primary">
          {t("modal.close")}
        </button>
      }
    >
      <div className="flex flex-col gap-6">
        {/* Theme: dark, light or the OS choice */}
        <Section label={t("settings.theme")}>
          <div
            className="qo-segmented"
            role="radiogroup"
            aria-label={t("settings.theme")}
          >
            {(["dark", "light", "system"] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={themePref === value}
                onClick={() => setThemePref(value)}
              >
                {themeLabels[value]}
              </button>
            ))}
          </div>
        </Section>

        {/* Clock Type */}
        <Section label={t("settings.clockType")}>
          <div
            className="qo-segmented"
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
              >
                {type === "analog"
                  ? t("settings.analog")
                  : t("settings.digital")}
              </button>
            ))}
          </div>
        </Section>

        {/* Time Format - only visible when digital */}
        {clockType === "digital" && (
          <Section label={t("settings.timeFormat")}>
            <div
              className="qo-segmented"
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
                >
                  {fmt === "12h" ? t("settings.12hour") : t("settings.24hour")}
                </button>
              ))}
            </div>
          </Section>
        )}

        {/* Session Settings */}
        <Section label={t("settings.sessionBehavior")}>
          <div className="qo-group">
            <SettingsToggle
              label={t("settings.autoFollow")}
              description={t("settings.autoFollowDesc")}
              checked={autoFollowNewSessions}
              onChange={handleAutoFollowToggle}
            />
          </div>
        </Section>

        {/* Controls: command bar and click-to-focus (not toasts) */}
        <Section label={t("settings.controls")}>
          <div className="qo-group">
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
        </Section>

        {/* Attention Settings */}
        <Section label={t("settings.toastFilters")}>
          <div className="qo-group">
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
        </Section>

        {/* Tip */}
        <p className="m-0 px-1 text-[12.5px] leading-snug text-ink-faint">
          {t("settings.clockTip")}
        </p>
      </div>
    </Modal>
  );
}
