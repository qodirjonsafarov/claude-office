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
 * Overflow "⋯" menu holding the rarely-used developer/maintenance actions
 * (Simulate, Reset, Clear DB, Debug) so they don't crowd the header.
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
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void onSimulate();
            }}
            className={`${itemClass} text-emerald-400 hover:bg-emerald-500/15`}
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
            className={`${itemClass} text-amber-400 hover:bg-amber-500/15`}
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
            className={`${itemClass} text-rose-400 hover:bg-rose-500/15`}
          >
            <Trash2 size={14} />
            {t("header.clearDb")}
          </button>

          <button
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onToggleDebug();
            }}
            className={`${itemClass} ${
              debugMode
                ? "text-green-400 hover:bg-green-500/15"
                : "text-slate-400 hover:bg-slate-500/15"
            }`}
          >
            <Bug size={14} />
            {debugMode ? t("header.debugOn") : t("header.debugOff")}
          </button>
        </div>
      )}
    </div>
  );
}
