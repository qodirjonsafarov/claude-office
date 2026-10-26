/**
 * MarqueeText Component
 *
 * A scrolling text display for task descriptions on desks.
 * Text scrolls horizontally if it exceeds the panel width.
 */

"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { Container, Graphics } from "pixi.js";

// ============================================================================
// TYPES
// ============================================================================

export interface MarqueeTextProps {
  text: string;
  width: number;
  color?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function MarqueeText({
  text,
  width,
  color = "#a7f36a",
}: MarqueeTextProps): ReactNode {
  const [offset, setOffset] = useState(0);
  const [maskGraphics, setMaskGraphics] = useState<Graphics | null>(null);
  const textContainerRef = useRef<Container | null>(null);

  // Normalize text to single line (remove newlines, carriage returns, collapse whitespace)
  const normalizedText = clipMarqueeText(text);

  // Estimate text width (approx 5.5px per char at fontSize 9)
  const estimatedTextWidth = normalizedText.length * 5.5;
  const shouldScroll = estimatedTextWidth > width - 16;
  const panelHeight = 14;
  const innerWidth = width - 8; // Padding on each side

  // Scroll animation
  useEffect(() => {
    let animationId: number;

    if (!shouldScroll) {
      // Defer state update to avoid synchronous setState in effect
      animationId = requestAnimationFrame(() => setOffset(0));
      return () => cancelAnimationFrame(animationId);
    }

    // Scroll from right edge to left edge
    const scrollDistance = estimatedTextWidth + innerWidth;
    const scrollDuration = scrollDistance * 40; // 40ms per pixel

    let startTime: number | null = null;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = (elapsed % scrollDuration) / scrollDuration;
      // Start from right edge, scroll left
      setOffset(innerWidth / 2 - progress * scrollDistance);
      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [shouldScroll, estimatedTextWidth, innerWidth]);

  // Draw background panel
  const drawPanel = useCallback(
    (g: Graphics) => {
      g.clear();
      // A small dark LED panel with a thin rim, lit along its top edge
      g.roundRect(-width / 2, -panelHeight / 2, width, panelHeight, 3);
      g.fill({ color: 0x0b1210, alpha: 0.95 });
      g.stroke({ width: 1, color: 0x2f3f37, alignment: 1 });
      g.rect(-width / 2 + 3, -panelHeight / 2 + 1, width - 6, 1);
      g.fill({ color: 0xffffff, alpha: 0.06 });
    },
    [width],
  );

  // Draw mask for text clipping
  const drawMask = useCallback(
    (g: Graphics) => {
      g.clear();
      g.roundRect(
        -width / 2 + 4,
        -panelHeight / 2 + 1,
        width - 8,
        panelHeight - 2,
        2,
      );
      g.fill(0xffffff);
    },
    [width],
  );

  // Apply mask when both mask graphics and container are ready
  useEffect(() => {
    if (maskGraphics && textContainerRef.current) {
      textContainerRef.current.mask = maskGraphics;
    }
    return () => {
      if (textContainerRef.current) {
        textContainerRef.current.mask = null;
      }
    };
  }, [maskGraphics]);

  // Callback ref to capture the mask graphics
  const maskRefCallback = useCallback((ref: Graphics | null) => {
    setMaskGraphics(ref);
  }, []);

  // Callback ref for text container. Reapply the mask here too, so clipping
  // survives the container instance being recreated while maskGraphics is stable
  // (the [maskGraphics]-only effect above wouldn't re-run in that case).
  const textContainerRefCallback = useCallback(
    (ref: Container | null) => {
      textContainerRef.current = ref;
      if (ref && maskGraphics) {
        ref.mask = maskGraphics;
      }
    },
    [maskGraphics],
  );

  return (
    <pixiContainer>
      <pixiGraphics draw={drawPanel} />
      {/* Mask graphics - invisible but used for clipping */}
      <pixiGraphics draw={drawMask} ref={maskRefCallback} />
      {/* Text container with mask applied - render at 2x and scale down for sharpness */}
      <pixiContainer ref={textContainerRefCallback} scale={0.5}>
        <pixiText
          text={normalizedText}
          x={shouldScroll ? offset * 2 : 0}
          y={0}
          anchor={{ x: shouldScroll ? 0 : 0.5, y: 0.5 }}
          style={{
            fontFamily: '"DejaVu Sans Mono", "Courier New", monospace',
            fontSize: 17,
            fill: color,
            fontWeight: "bold",
          }}
        />
      </pixiContainer>
    </pixiContainer>
  );
}

/**
 * Longest marquee line. A whole long prompt drawn as one Pixi text at a
 * high resolution overflows the 32767 px texture pool limit (console spam).
 */
export const MARQUEE_MAX_CHARS = 240;

/** One line, collapsed whitespace, cut to MARQUEE_MAX_CHARS with an ellipsis. */
export function clipMarqueeText(text: string): string {
  const line = text.replace(/\s+/g, " ").trim();
  if (line.length <= MARQUEE_MAX_CHARS) return line;
  return line.slice(0, MARQUEE_MAX_CHARS - 1).trimEnd() + "…";
}
