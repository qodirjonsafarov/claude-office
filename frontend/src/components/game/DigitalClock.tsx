"use client";

import { Graphics, TextStyle } from "pixi.js";
import { useState, useCallback, useEffect, type ReactNode } from "react";
import type { ClockFormat } from "@/stores/preferencesStore";
import { scenePalette } from "@/systems/scenePalette";
import { useTheme } from "@/systems/themeStore";

/** The LCD digits: the Olymp lime. */
const LCD = 0xa7f36a;

/**
 * DigitalClock - LED-style digital clock display for the office wall
 *
 * Displays current time on a graphite LCD with lime digits.
 * Supports 12h and 24h time formats.
 */
interface DigitalClockProps {
  format: ClockFormat;
}

export function DigitalClock({ format }: DigitalClockProps): ReactNode {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = useCallback(
    (date: Date): string => {
      let hours = date.getHours();
      const mins = date.getMinutes();
      const secs = date.getSeconds();

      if (format === "12h") {
        hours = hours % 12 || 12;
        return `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
      }

      return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    },
    [format],
  );

  const getAmPm = useCallback((date: Date): string => {
    return date.getHours() >= 12 ? "PM" : "AM";
  }, []);

  const palette = scenePalette(useTheme());
  const drawClockBody = useCallback(
    (g: Graphics) => {
      g.clear();
      const m = palette.materials;
      // Shadow, graphite casing with a lit top edge, a recessed LCD
      g.roundRect(-52, -24, 108, 56, 6);
      g.fill(palette.shadow);
      g.roundRect(-54, -28, 108, 56, 6);
      g.fill(m.outline);
      g.roundRect(-53, -27, 106, 54, 5);
      g.fill(palette.frame);
      g.rect(-48, -26, 96, 1);
      g.fill(palette.frameLight);
      g.roundRect(-48, -22, 96, 44, 3);
      g.fill(m.screen);
      g.rect(-46, -21, 92, 1);
      g.fill({ color: 0x000000, alpha: 0.4 });
      // Faint glass reflection
      g.rect(-46, -18, 30, 1);
      g.fill({ color: 0xffffff, alpha: 0.06 });
    },
    [palette],
  );

  const timeString = formatTime(time);

  return (
    <pixiContainer>
      <pixiGraphics draw={drawClockBody} />
      {/* Main time display */}
      <pixiText
        text={timeString}
        x={format === "12h" ? -8 : 0}
        y={-2}
        anchor={0.5}
        style={
          new TextStyle({
            fontFamily: "monospace",
            fontSize: 16,
            fontWeight: "bold",
            fill: LCD,
            dropShadow: {
              color: LCD,
              blur: 4,
              alpha: 0.6,
              distance: 0,
            },
          })
        }
      />
      {/* AM/PM indicator for 12h format */}
      {format === "12h" && (
        <pixiText
          text={getAmPm(time)}
          x={36}
          y={-2}
          anchor={0.5}
          style={
            new TextStyle({
              fontFamily: "monospace",
              fontSize: 8,
              fontWeight: "bold",
              fill: LCD,
              dropShadow: {
                color: LCD,
                blur: 2,
                alpha: 0.4,
                distance: 0,
              },
            })
          }
        />
      )}
    </pixiContainer>
  );
}
