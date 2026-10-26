"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { MousePointerClick } from "lucide-react";

interface PointerRingProps {
  targetTourId: string | null;
  label: string | null;
}

/**
 * Animated highlight ring that appears around the targeted element.
 * Uses data-tour-id attributes to locate elements.
 */
export function PointerRing({
  targetTourId,
  label,
}: PointerRingProps): ReactNode {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const rafIdRef = useRef<number | null>(null);

  const updatePosition = useCallback(() => {
    // Use rAF to batch the setState outside the synchronous effect path
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }
    rafIdRef.current = requestAnimationFrame(() => {
      if (!targetTourId) {
        setRect(null);
        return;
      }
      const el = document.querySelector(`[data-tour-id="${targetTourId}"]`);
      if (el) {
        setRect(el.getBoundingClientRect());
      } else {
        setRect(null);
      }
    });
  }, [targetTourId]);

  useEffect(() => {
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    const interval = setInterval(updatePosition, 500);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      clearInterval(interval);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [updatePosition]);

  if (!rect || !targetTourId) return null;

  const padding = 6;

  return (
    <div
      className="fixed z-[55] pointer-events-none"
      style={{
        left: rect.left - padding,
        top: rect.top - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
      }}
    >
      <div className="absolute inset-0 rounded-xl2 border-2 border-accent motion-safe:animate-[tourPulse_2s_ease-in-out_infinite]" />
      {label && (
        <div className="absolute -bottom-9 left-1/2 -translate-x-1/2 whitespace-nowrap h-7 px-3 rounded-full bg-accent text-on-accent text-[12.5px] font-extrabold flex items-center gap-1.5 shadow-[var(--qo-shadow-float)]">
          <MousePointerClick size={14} strokeWidth={2.4} aria-hidden="true" />
          {label}
        </div>
      )}
    </div>
  );
}
