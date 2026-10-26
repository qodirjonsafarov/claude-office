"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, Play, RefreshCw, Trash2, Bug } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { SwitchMark } from "@/components/ui/SwitchMark";

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

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("header.moreMenu")}
        title={t("header.more")}
        className="qo-icon-btn-sm"
      >
        <MoreHorizontal size={18} />
      </button>

      {open && (
        <div
          role="menu"
          className="qo-menu qo-pop absolute right-0 top-full mt-2.5 z-50 w-60"
        >
          <button
            role="menuitemcheckbox"
            onClick={() => {
              setOpen(false);
              onToggleDebug();
            }}
            aria-checked={debugMode}
            className="qo-menu-item"
          >
            <Bug size={16} className="text-ink-faint" />
            {t("header.debugMode")}
            <SwitchMark
              on={debugMode}
              onLabel={t("header.on")}
              offLabel={t("header.off")}
            />
          </button>

          {/* Developer actions: only in debug mode */}
          {debugMode && (
            <>
              <div aria-hidden="true" className="qo-menu-sep" />
              <button
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  void onSimulate();
                }}
                className="qo-menu-item"
              >
                <Play size={16} className="text-accent" />
                {t("header.simulate")}
              </button>

              <button
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onReset();
                }}
                className="qo-menu-item"
              >
                <RefreshCw size={16} className="text-warn" />
                {t("header.reset")}
              </button>

              {/* The destructive action sits apart from Reset. */}
              <div aria-hidden="true" className="qo-menu-sep" />
              <div className="qo-label px-3 pt-1.5 pb-1 !text-danger">
                {t("header.dangerZone")}
              </div>
              <button
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onClearDB();
                }}
                className="qo-menu-item !text-danger hover:!bg-danger-dim"
              >
                <Trash2 size={16} />
                {t("header.clearDb")}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
