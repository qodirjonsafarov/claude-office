"use client";

import type { ReactNode } from "react";
import { MousePointerClick, Play } from "lucide-react";
import type { TourStepType } from "@/stores/tourStore";
import { useTranslation } from "@/hooks/useTranslation";

interface NarratorBarProps {
  title: string;
  description: string;
  stepType: TourStepType;
  stepIndex: number;
  totalSteps: number;
  onSkip: () => void;
}

/**
 * Bottom bar showing tour step title, description, progress bar, and skip button.
 */
export function NarratorBar({
  title,
  description,
  stepType,
  stepIndex,
  totalSteps,
  onSkip,
}: NarratorBarProps): ReactNode {
  const progress = ((stepIndex + 1) / totalSteps) * 100;
  const { t } = useTranslation();

  const Icon = stepType === "interactive" ? MousePointerClick : Play;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[60] pointer-events-auto flex justify-center px-4 pb-[max(16px,env(safe-area-inset-bottom))]">
      <div className="qo-pop w-full max-w-[680px] bg-panel border border-line-strong rounded-xl3 pl-4 pr-5 py-4 flex items-center gap-4 shadow-[var(--qo-shadow-pop)]">
        <span className="w-10 h-10 rounded-full bg-accent-dim text-accent flex items-center justify-center flex-shrink-0">
          <Icon size={18} strokeWidth={2.4} aria-hidden="true" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="qo-label !text-accent mb-1">
            {stepIndex + 1} / {totalSteps}
          </div>
          <div className="text-[15px] font-extrabold text-ink leading-tight">
            {title}
          </div>
          <div className="mt-1 text-[13.5px] text-ink-soft leading-snug">
            {description}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2.5 flex-shrink-0">
          <div className="w-24 h-1.5 bg-panel-3 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <button onClick={onSkip} className="qo-btn qo-btn-ghost !h-8 !px-3">
            {t("tour.skip")}
          </button>
        </div>
      </div>
    </div>
  );
}
