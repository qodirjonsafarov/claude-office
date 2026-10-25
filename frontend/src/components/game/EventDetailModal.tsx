/**
 * EventDetailModal - Modal showing full details of a clicked event log entry
 */

"use client";

import { useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { format } from "date-fns";
import type { EventLogEntry } from "@/stores/gameStore";
import { useTranslation } from "@/hooks/useTranslation";
import { getEventTypeBadgeClasses } from "@/utils/event-type-styles";
import { useDialogFocus } from "@/hooks/useDialogFocus";

interface EventDetailModalProps {
  event: EventLogEntry;
  onClose: () => void;
}

export function EventDetailModal({ event, onClose }: EventDetailModalProps) {
  const { t } = useTranslation();
  const box = useRef<HTMLDivElement>(null);
  useDialogFocus(box, { onEscape: onClose });

  const detail = event.detail ?? {};
  const hasDetail = Object.keys(detail).length > 0;

  // Portaled to <body>: inside a phone sheet (a transformed box) a fixed
  // element would be positioned relative to the sheet instead of the screen.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-scrim qo-fade-in" onClick={onClose} />

      {/* Modal Panel */}
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-label={`${event.type.replace(/_/g, " ")} — ${event.summary}`}
        className="qo-pop relative z-10 w-full max-w-2xl max-h-[80vh] flex flex-col bg-panel border border-line rounded-xl3 shadow-[0_16px_48px_var(--qo-float-shade)] overflow-hidden font-mono text-xs"
      >
        {/* Header */}
        <div className="flex items-center gap-3 pl-4 pr-2 py-2 border-b border-line flex-shrink-0">
          <span
            className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider ${getEventTypeBadgeClasses(event.type)}`}
          >
            {event.type.replace(/_/g, " ")}
          </span>
          <span className="text-slate-400 text-[11px]">
            {format(event.timestamp, "HH:mm:ss.SSS")}
          </span>
          {event.agentId && (
            <span className="text-blue-400 text-[10px] font-mono">
              @{event.agentId}
            </span>
          )}
          <button
            onClick={onClose}
            className="qo-icon-btn ml-auto"
            aria-label={t("modal.close")}
            data-autofocus
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-grow overflow-y-auto p-4 space-y-3">
          {/* Summary */}
          <div>
            <div className="text-slate-500 text-[10px] uppercase tracking-widest mb-1">
              {t("eventDetail.summary")}
            </div>
            <div className="text-slate-200 text-[12px]">{event.summary}</div>
          </div>

          {/* Detail fields */}
          {hasDetail ? (
            <>
              {detail.toolName && (
                <div>
                  <div className="text-slate-500 text-[10px] uppercase tracking-widest mb-1">
                    {t("eventDetail.tool")}
                  </div>
                  <div className="text-amber-300 text-[12px]">
                    {String(detail.toolName)}
                  </div>
                </div>
              )}

              {detail.agentName && (
                <div>
                  <div className="text-slate-500 text-[10px] uppercase tracking-widest mb-1">
                    {t("eventDetail.agentName")}
                  </div>
                  <div className="text-blue-300 text-[12px]">
                    {String(detail.agentName)}
                  </div>
                </div>
              )}

              {detail.taskDescription && (
                <div>
                  <div className="text-slate-500 text-[10px] uppercase tracking-widest mb-1">
                    {t("eventDetail.taskDescription")}
                  </div>
                  <div className="text-slate-200 text-[12px] whitespace-pre-wrap leading-relaxed">
                    {String(detail.taskDescription)}
                  </div>
                </div>
              )}

              {detail.prompt && (
                <div>
                  <div className="text-slate-500 text-[10px] uppercase tracking-widest mb-1">
                    {t("eventDetail.userPrompt")}
                  </div>
                  <div className="text-cyan-200 text-[12px] whitespace-pre-wrap leading-relaxed bg-slate-800/50 rounded p-2 border border-slate-700">
                    {String(detail.prompt)}
                  </div>
                </div>
              )}

              {detail.thinking && (
                <div>
                  <div className="text-slate-500 text-[10px] uppercase tracking-widest mb-1">
                    {t("eventDetail.thinking")}
                  </div>
                  <div className="text-slate-400 italic text-[12px] whitespace-pre-wrap leading-relaxed bg-slate-800/30 rounded p-2 border border-slate-700/50">
                    {String(detail.thinking)}
                  </div>
                </div>
              )}

              {detail.message && (
                <div>
                  <div className="text-slate-500 text-[10px] uppercase tracking-widest mb-1">
                    {t("eventDetail.message")}
                  </div>
                  <div className="text-slate-200 text-[12px] whitespace-pre-wrap leading-relaxed">
                    {String(detail.message)}
                  </div>
                </div>
              )}

              {detail.resultSummary && (
                <div>
                  <div className="text-slate-500 text-[10px] uppercase tracking-widest mb-1">
                    {t("eventDetail.resultSummary")}
                  </div>
                  <div className="text-emerald-300 text-[12px] whitespace-pre-wrap leading-relaxed">
                    {String(detail.resultSummary)}
                  </div>
                </div>
              )}

              {detail.errorType && (
                <div>
                  <div className="text-slate-500 text-[10px] uppercase tracking-widest mb-1">
                    {t("eventDetail.errorType")}
                  </div>
                  <div className="text-red-400 text-[12px]">
                    {String(detail.errorType)}
                  </div>
                </div>
              )}

              {detail.toolInput && (
                <div>
                  <div className="text-slate-500 text-[10px] uppercase tracking-widest mb-1">
                    {t("eventDetail.toolInput")}
                  </div>
                  <pre className="text-slate-300 text-[11px] bg-slate-800 rounded p-3 border border-slate-700 overflow-x-auto whitespace-pre-wrap break-words leading-relaxed">
                    {JSON.stringify(detail.toolInput, null, 2)}
                  </pre>
                </div>
              )}
            </>
          ) : (
            <div className="text-slate-600 italic text-center py-4">
              {t("eventDetail.noDetail")}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-4 py-3 border-t border-line flex justify-end">
          <button onClick={onClose} className="qo-btn qo-btn-secondary">
            {t("modal.close")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
