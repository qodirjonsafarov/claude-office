"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, Play, RefreshCw, Trash2, Bug } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

// ============================================================================
// TYPES
// ============================================================================

interface HeaderMoreMenuProps {
  debugMode: boolean;
  onSimulate: () => Promise<void>;
  onReset: () => void;
  onClearDB: () => void;
  onToggleDebug: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Overflow "⋯" menu: the debug toggle, and in debug mode the developer
 * actions (Simulate, Reset, Clear DB), so they don't crowd the header.
 * Closes on outside click or Escape.
 */
export function HeaderMoreMenu({
  debugMode,
  onSimulate,
  onReset,
  onClearDB,
  onToggleDebug,
}: HeaderMoreMenuProps): React.ReactNode {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const itemClass =
    "flex w-full items-center gap-2.5 h-10 px-3 text-[13px] font-bold rounded-xl transition-colors text-left";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("header.moreMenu")}
        title={t("header.more")}
        className="qo-btn qo-btn-secondary"
      >
        <MoreHorizontal size={15} />
        {t("header.more")}
      </button>

      {open && (
        <div
          role="menu"
          className="qo-pop absolute right-0 top-full mt-2 z-50 min-w-[12rem] p-1.5 bg-panel border border-line-strong rounded-xl3 shadow-[0_8px_24px_var(--qo-float-shade)]"
        >
          <button
            role="menuitemcheckbox"
            onClick={() => {
              setOpen(false);
              onToggleDebug();
            }}
            aria-checked={debugMode}
            className={`${itemClass} ${
              debugMode
                ? "text-accent hover:bg-accent-dim"
                : "text-ink-soft hover:bg-panel-2"
            }`}
          >
            <Bug size={14} />
            {debugMode ? t("header.debugOn") : t("header.debugOff")}
          </button>

          {/* Developer actions: only in debug mode */}
          {debugMode && (
            <>
              <div aria-hidden="true" className="h-px my-1 bg-line" />
              <button
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  void onSimulate();
                }}
                className={`${itemClass} text-accent hover:bg-accent-dim`}
              >
                <Play size={14} fill="currentColor" />
                {t("header.simulate")}
              </button>

              <button
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onReset();
                }}
                className={`${itemClass} text-warn hover:bg-warn-dim`}
              >
                <RefreshCw size={14} />
                {t("header.reset")}
              </button>

              <button
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onClearDB();
                }}
                className={`${itemClass} text-danger hover:bg-danger-dim`}
              >
                <Trash2 size={14} />
                {t("header.clearDb")}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
