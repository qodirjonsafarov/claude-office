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
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  dismissible = true,
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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-scrim qo-fade-in"
      onClick={dismissible ? onClose : undefined}
    >
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="qo-pop bg-panel border border-line rounded-t-xl3 sm:rounded-xl3 shadow-[0_16px_48px_var(--qo-float-shade)] w-full sm:max-w-md max-h-[85svh] sm:max-h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pl-5 pr-3 py-3 border-b border-line flex-shrink-0">
          <h2
            id={titleId}
            className="text-[18px] font-extrabold text-ink tracking-tight"
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
        <div className="px-5 py-5 text-ink-soft text-sm leading-relaxed overflow-y-auto flex-1 min-h-0">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-2 px-5 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:pb-3 border-t border-line flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
