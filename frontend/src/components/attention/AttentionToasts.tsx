"use client";

import { useEffect, useCallback, type ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  ShieldAlert,
  X,
  type LucideIcon,
} from "lucide-react";
import { useAttentionStore, type UrgencyLevel } from "@/stores/attentionStore";

/** Olymp tones per urgency: the card's left edge and the icon chip. */
const URGENCY_TONES: Record<UrgencyLevel, { edge: string; chip: string }> = {
  critical: { edge: "border-l-danger", chip: "bg-danger-dim text-danger" },
  high: { edge: "border-l-warn", chip: "bg-warn-dim text-warn" },
  low: { edge: "border-l-accent", chip: "bg-accent-dim text-accent" },
  info: { edge: "border-l-info", chip: "bg-info-dim text-info" },
};

const URGENCY_ICONS: Record<UrgencyLevel, LucideIcon> = {
  critical: ShieldAlert,
  high: AlertTriangle,
  low: CheckCircle2,
  info: Info,
};

export default function AttentionToasts(): ReactNode {
  const toasts = useAttentionStore(
    useShallow((s) => s.toastQueue.filter((t) => !t.dismissed)),
  );
  const dismissToast = useAttentionStore((s) => s.dismissToast);
  const openFocusPopup = useAttentionStore((s) => s.openFocusPopup);

  const handleToastClick = useCallback(
    (toast: (typeof toasts)[number]) => {
      if (toast.agentId) {
        openFocusPopup(toast.agentId, window.innerWidth / 2, 120);
      }
      dismissToast(toast.id);
    },
    [dismissToast, openFocusPopup],
  );

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-16 right-4 z-50 flex flex-col gap-2 w-80 pointer-events-none">
      {toasts.slice(0, 5).map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onClick={() => handleToastClick(toast)}
          onDismiss={() => dismissToast(toast.id)}
        />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onClick,
  onDismiss,
}: {
  toast: {
    id: string;
    urgencyLevel: UrgencyLevel;
    agentName: string | null;
    title: string;
    description: string;
    autoDismissMs: number | null;
  };
  onClick: () => void;
  onDismiss: () => void;
}): ReactNode {
  const tone = URGENCY_TONES[toast.urgencyLevel];
  const Icon = URGENCY_ICONS[toast.urgencyLevel];
  const headline = toast.agentName
    ? `${toast.agentName} · ${toast.title}`
    : toast.title;

  useEffect(() => {
    if (toast.autoDismissMs === null) return;
    const timer = setTimeout(onDismiss, toast.autoDismissMs);
    return () => clearTimeout(timer);
  }, [toast.autoDismissMs, toast.id, onDismiss]);

  return (
    <div
      className={`qo-pop pointer-events-auto flex items-center gap-3 p-2.5 pr-2 bg-panel border border-line-strong border-l-4 rounded-xl2 cursor-pointer shadow-[0_8px_24px_var(--qo-float-shade)] ${tone.edge}`}
      onClick={onClick}
      role="alert"
    >
      <span
        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${tone.chip}`}
      >
        <Icon size={17} strokeWidth={2.2} aria-hidden="true" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="m-0 text-[13px] font-extrabold text-ink truncate">
          {headline}
        </p>
        {toast.description && (
          <p className="m-0 text-[12px] font-semibold text-ink-soft truncate">
            {toast.description}
          </p>
        )}
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDismiss();
        }}
        className="qo-icon-btn !w-8 !h-8 shrink-0"
        aria-label="Dismiss"
      >
        <X size={15} strokeWidth={2.2} />
      </button>
    </div>
  );
}
