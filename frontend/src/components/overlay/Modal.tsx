"use client";

import { X } from "lucide-react";
import { ReactNode, useId, useRef } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { useDialogFocus } from "@/hooks/useDialogFocus";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  dismissible?: boolean;
  /** A wider window, for settings with several groups. */
  wide?: boolean;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  dismissible = true,
  wide = false,
}: ModalProps) {
  const { t } = useTranslation();
  const titleId = useId();

  const box = useRef<HTMLDivElement>(null);
  // Focus the close button, trap Tab, Escape closes (only if dismissible)
  useDialogFocus(box, {
    active: isOpen,
    onEscape: dismissible ? onClose : undefined,
  });

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 bg-scrim qo-fade-in"
      onClick={dismissible ? onClose : undefined}
    >
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`qo-pop bg-panel border border-line rounded-t-xl3 sm:rounded-xl3 shadow-[var(--qo-shadow-pop)] w-full ${
          wide ? "sm:max-w-[520px]" : "sm:max-w-[440px]"
        } max-h-[88svh] sm:max-h-[min(760px,86vh)] flex flex-col overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: the title and the cross, no line under them */}
        <div className="flex items-center justify-between gap-3 pl-6 pr-3 pt-3 pb-1 flex-shrink-0">
          <h2
            id={titleId}
            className="m-0 text-[18px] leading-tight font-extrabold text-ink tracking-tight"
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label={t("modal.close")}
            className="qo-icon-btn"
            data-autofocus
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 pt-3 pb-6 text-ink-soft text-[14.5px] leading-relaxed overflow-y-auto overscroll-contain flex-1 min-h-0">
          {children}
        </div>

        {/* Footer: the actions at the end, the main one last */}
        {footer && (
          <div className="flex items-center justify-end gap-2 px-6 pt-1 pb-[max(20px,env(safe-area-inset-bottom))] sm:pb-5 flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
