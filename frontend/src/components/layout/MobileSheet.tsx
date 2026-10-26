"use client";

import { X } from "lucide-react";
import { useCallback, type ReactNode } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { useSheetPull } from "@/hooks/useSheetPull";

interface MobileSheetProps {
  title: string;
  /** A short grey note beside the title (a count). */
  note?: string;
  onClose: () => void;
  children: ReactNode;
  /** The content fills the sheet and scrolls by itself (an event log). */
  fill?: boolean;
  /** Controls on the title row (phone landscape: tabs and search). */
  headerContent?: ReactNode;
}

/**
 * A sheet that rises from the bottom of a phone over the office, as in Olymp:
 * a handle, the title, a 44px close button; the content scrolls under them.
 * Closes on the cross, a tap on the scrim, Escape or a pull down on the head.
 * The office stays visible (and animated) above it.
 */
export function MobileSheet({
  title,
  note,
  onClose,
  children,
  fill = false,
  headerContent,
}: MobileSheetProps): React.ReactNode {
  const { t } = useTranslation();
  const close = useCallback(() => onClose(), [onClose]);
  const { box, handlers: pullHandlers } = useSheetPull<HTMLDivElement>(close);

  // Focus the close button, trap Tab; Escape only while no modal is on top.
  useDialogFocus(box, { onEscape: close });

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-scrim qo-fade-in"
      onClick={close}
    >
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="qo-sheet-up w-full max-w-[560px] h-[min(78svh,680px)] [@media(max-height:520px)]:h-[92svh] flex flex-col rounded-t-xl3 bg-panel border border-line border-b-0 shadow-[0_-8px_32px_var(--qo-float-shade)] qo-safe-x"
      >
        <div
          className="flex-shrink-0 touch-none px-5 pt-2.5 pb-2 border-b border-line"
          {...pullHandlers}
        >
          <span
            aria-hidden="true"
            className={`block w-10 h-1 mx-auto rounded-full bg-line-strong ${
              headerContent ? "mb-1.5" : "mb-2"
            }`}
          />
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-baseline gap-2 min-w-0 flex-shrink-0">
              <h2 className="m-0 text-[18px] leading-tight font-extrabold text-ink truncate">
                {title}
              </h2>
              {note && (
                <span className="text-[13px] font-bold text-ink-faint">
                  {note}
                </span>
              )}
            </div>
            {headerContent && (
              // Taps on the controls must not start a pull-down.
              <div
                className="flex-1 min-w-0 flex items-center gap-2 touch-auto"
                onPointerDown={(e) => e.stopPropagation()}
              >
                {headerContent}
              </div>
            )}
            <button
              type="button"
              onClick={close}
              aria-label={t("modal.close")}
              className="qo-icon-btn -mr-2"
              data-autofocus
            >
              <X size={20} />
            </button>
          </div>
        </div>
        <div
          className={`flex-1 min-h-0 overscroll-contain pb-[max(16px,env(safe-area-inset-bottom))] ${
            fill ? "flex flex-col p-3" : "overflow-y-auto p-4"
          }`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
