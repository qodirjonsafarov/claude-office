/**
 * ZoomControls Component
 *
 * Provides zoom in/out and reset controls for the game canvas.
 * Uses react-zoom-pan-pinch hooks for control.
 */

import { type ReactNode } from "react";
import { useControls } from "react-zoom-pan-pinch";
import { useTranslation } from "@/hooks/useTranslation";

export function ZoomControls(): ReactNode {
  const { zoomIn, zoomOut, resetTransform } = useControls();
  const { t } = useTranslation();

  // Olymp-style round buttons in a capsule; on a phone (.qo-stage-phone) the
  // +/- steps are hidden in CSS, pinch zooms and only the reset stays.
  const button =
    "w-11 h-11 rounded-full flex items-center justify-center text-ink-soft hover:text-ink hover:bg-panel-3 font-extrabold transition-colors active:scale-95";

  return (
    <div className="qo-zoom absolute bottom-4 right-4 z-10 flex flex-row gap-1 p-1 rounded-full qo-glass-panel border border-line-strong shadow-[0_8px_24px_var(--qo-float-shade)] opacity-85 hover:opacity-100 transition-opacity">
      <button
        onClick={() => zoomIn()}
        className={`qo-zoom-step ${button} text-xl`}
        aria-label={t("zoom.in")}
      >
        +
      </button>
      <button
        onClick={() => zoomOut()}
        className={`qo-zoom-step ${button} text-xl`}
        aria-label={t("zoom.out")}
      >
        −
      </button>
      <button
        onClick={() => resetTransform()}
        className={`${button} text-xs`}
        aria-label={t("zoom.reset")}
      >
        1:1
      </button>
    </div>
  );
}
