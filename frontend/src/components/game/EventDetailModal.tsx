/**
 * EventDetailModal - Modal showing full details of a clicked event log entry
 */

"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, X } from "lucide-react";
import { format } from "date-fns";
import type { EventLogEntry } from "@/stores/gameStore";
import { useTranslation } from "@/hooks/useTranslation";
import { getEventTypeBadgeClasses } from "@/utils/event-type-styles";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { eventJson } from "@/utils/eventJson";
import { personKey } from "@/utils/agentActivity";
import { EmptyState } from "@/components/ui/EmptyState";

interface EventDetailModalProps {
  event: EventLogEntry;
  onClose: () => void;
}

export function EventDetailModal({ event, onClose }: EventDetailModalProps) {
  const { t } = useTranslation();
  const box = useRef<HTMLDivElement>(null);
  useDialogFocus(box, { onEscape: onClose });

  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(id);
  }, [copied]);
  const copyJson = () => {
    void navigator.clipboard
      ?.writeText(eventJson(event))
      .then(() => setCopied(true))
      .catch(() => undefined);
  };

  const detail = event.detail ?? {};
  const hasDetail = Object.keys(detail).length > 0;

  // One fact of the event: a small label, the value under it.
  const field = (label: string, value: ReactNode, tone = "text-ink") => (
    <div>
      <div className="qo-label mb-1.5">{label}</div>
      <div
        className={`text-[13.5px] leading-relaxed whitespace-pre-wrap ${tone}`}
      >
        {value}
      </div>
    </div>
  );
  // A long text (a prompt, the thinking) on a soft plate.
  const block = (label: string, value: string, tone = "text-ink") => (
    <div>
      <div className="qo-label mb-1.5">{label}</div>
      <div
        className={`text-[13px] leading-relaxed whitespace-pre-wrap rounded-xl2 bg-panel-2 px-3.5 py-3 ${tone}`}
      >
        {value}
      </div>
    </div>
  );

  // Portaled to <body>: inside a phone sheet (a transformed box) a fixed
  // element would be positioned relative to the sheet instead of the screen.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-scrim qo-fade-in" onClick={onClose} />

      {/* Modal Panel */}
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-label={`${event.type.replace(/_/g, " ")} — ${event.summary}`}
        className="qo-pop relative z-10 w-full min-w-0 sm:max-w-2xl max-h-[88svh] sm:max-h-[82vh] flex flex-col bg-panel border border-line rounded-t-xl3 sm:rounded-xl3 shadow-[var(--qo-shadow-pop)] overflow-hidden"
      >
        {/* Header: the kind, who and when */}
        <div className="flex items-center gap-x-3 gap-y-1 pl-6 pr-3 pt-3 pb-2 flex-shrink-0 min-w-0">
          <span
            className={`qo-badge !text-[11px] uppercase tracking-[0.08em] ${getEventTypeBadgeClasses(event.type)}`}
          >
            {event.type.replace(/_/g, " ")}
          </span>
          <span className="min-w-0 text-[13px] font-extrabold text-ink truncate">
            {personKey(event.agentId) === "boss" ? "Boss" : event.agentId}
          </span>
          <span className="flex-shrink-0 text-[12.5px] font-semibold text-ink-faint tabular-nums">
            {format(event.timestamp, "HH:mm:ss.SSS")}
          </span>
          <button
            onClick={onClose}
            className="qo-icon-btn ml-auto"
            aria-label={t("modal.close")}
            data-autofocus
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-grow min-w-0 overflow-y-auto overflow-x-hidden overscroll-contain px-6 pt-2 pb-5 flex flex-col gap-4 [overflow-wrap:anywhere]">
          {field(t("eventDetail.summary"), event.summary)}

          {/* Detail fields */}
          {hasDetail ? (
            <>
              {detail.toolName &&
                field(
                  t("eventDetail.tool"),
                  String(detail.toolName),
                  "text-warn font-bold",
                )}
              {detail.agentName &&
                field(
                  t("eventDetail.agentName"),
                  String(detail.agentName),
                  "text-info font-bold",
                )}
              {detail.taskDescription &&
                field(
                  t("eventDetail.taskDescription"),
                  String(detail.taskDescription),
                )}
              {detail.prompt &&
                block(t("eventDetail.userPrompt"), String(detail.prompt))}
              {detail.thinking &&
                block(
                  t("eventDetail.thinking"),
                  String(detail.thinking),
                  "text-ink-soft",
                )}
              {detail.message &&
                field(t("eventDetail.message"), String(detail.message))}
              {detail.resultSummary &&
                field(
                  t("eventDetail.resultSummary"),
                  String(detail.resultSummary),
                  "text-accent",
                )}
              {detail.errorType &&
                field(
                  t("eventDetail.errorType"),
                  String(detail.errorType),
                  "text-danger font-bold",
                )}
              {detail.toolInput && (
                <div>
                  <div className="qo-label mb-1.5">
                    {t("eventDetail.toolInput")}
                  </div>
                  <pre className="m-0 max-w-full max-h-72 overflow-auto whitespace-pre [overflow-wrap:normal] font-mono text-ink-soft text-[12px] bg-panel-2 rounded-xl2 px-3.5 py-3 leading-relaxed">
                    {JSON.stringify(detail.toolInput, null, 2)}
                  </pre>
                </div>
              )}
            </>
          ) : (
            <EmptyState title={t("eventDetail.noDetail")} />
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 pt-1 pb-[max(20px,env(safe-area-inset-bottom))] sm:pb-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={copyJson}
            className="qo-btn qo-btn-lg qo-btn-ghost"
            aria-live="polite"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? t("eventDetail.copied") : t("eventDetail.copyJson")}
          </button>
          <button
            onClick={onClose}
            className="qo-btn qo-btn-lg qo-btn-secondary"
          >
            {t("modal.close")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
