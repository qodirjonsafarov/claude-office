"use client";

import { useEffect, useCallback, useRef, type ReactNode } from "react";
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
import { useLayoutMode, type LayoutMode } from "@/hooks/useLayoutMode";

/**
 * Where the stack sits, clear of panel headers and sheet close buttons:
 * desktop over the top of the office (between the two sidebars), portrait
 * just above the tab bar, landscape at the bottom beside the rail.
 */
const STACK_PLACES: Record<LayoutMode, string> = {
  desktop: "top-[84px] left-1/2 -translate-x-1/2 w-80 flex-col",
  portrait:
    "left-3 right-3 bottom-[calc(var(--qo-bar-h)+env(safe-area-inset-bottom)+12px)] flex-col-reverse",
  landscape:
    "left-[calc(var(--qo-rail-w)+12px)] bottom-[max(12px,env(safe-area-inset-bottom))] w-80 flex-col-reverse",
};

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
  const layout = useLayoutMode();

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
    <div
      className={`fixed z-50 flex gap-2 pointer-events-none ${STACK_PLACES[layout]}`}
    >
      {toasts.slice(0, 2).map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onClick={() => handleToastClick(toast)}
          onDismiss={() => dismissToast(toast.id)}
          compact={layout === "desktop"}
        />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onClick,
  onDismiss,
  compact,
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
  /** Desktop: a 32px close button; phones keep the 44px touch target. */
  compact: boolean;
}): ReactNode {
  const tone = URGENCY_TONES[toast.urgencyLevel];
  const Icon = URGENCY_ICONS[toast.urgencyLevel];
  const headline = toast.title;

  // The parent passes a fresh onDismiss each render: keep the latest in a ref
  // so a re-render does not restart the timer (it used to never fire).
  const dismissRef = useRef(onDismiss);
  useEffect(() => {
    dismissRef.current = onDismiss;
  });
  useEffect(() => {
    if (toast.autoDismissMs === null) return;
    const timer = setTimeout(() => dismissRef.current(), toast.autoDismissMs);
    return () => clearTimeout(timer);
  }, [toast.autoDismissMs, toast.id]);

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
        className={`qo-icon-btn shrink-0 ${compact ? "!w-8 !h-8" : ""}`}
        aria-label="Dismiss"
      >
        <X size={15} strokeWidth={2.2} />
      </button>
    </div>
  );
}
