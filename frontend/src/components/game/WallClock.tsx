"use client";

import { Graphics } from "pixi.js";
import { useState, useCallback, useEffect, type ReactNode } from "react";
import { usePreferencesStore } from "@/stores/preferencesStore";
import { DigitalClock } from "./DigitalClock";
import { scenePalette } from "@/systems/scenePalette";
import { useTheme } from "@/systems/themeStore";

/**
 * WallClock - Animated clock for the office wall
 *
 * Displays current time in analog or digital format based on user preferences
 * (a graphite rim, a paper face, the accent second hand).
 * Click to cycle through: analog → digital 12h → digital 24h → analog
 */
export function WallClock(): ReactNode {
  const [time, setTime] = useState(new Date());
  const clockType = usePreferencesStore((s) => s.clockType);
  const clockFormat = usePreferencesStore((s) => s.clockFormat);
  const cycleClockMode = usePreferencesStore((s) => s.cycleClockMode);
  const palette = scenePalette(useTheme());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleClick = useCallback(() => {
    cycleClockMode();
  }, [cycleClockMode]);

  const drawAnalogClock = useCallback(
    (g: Graphics) => {
      g.clear();
      const m = palette.materials;
      // Shadow on the wall, then a graphite rim round a paper face
      g.circle(3, 4, 44);
      g.fill(palette.shadow);
      g.circle(0, 0, 44);
      g.fill(m.outline);
      g.circle(0, 0, 43);
      g.fill(palette.frame);
      g.circle(-1, -1, 41);
      g.fill(palette.frameLight);
      g.circle(0, 0, 38);
      g.fill(m.paper);
      // The face is set back: a shade along its upper edge
      g.arc(0, 0, 37, Math.PI * 1.05, Math.PI * 1.95);
      g.stroke({ width: 2, color: 0x000000, alpha: 0.12 });

      // Hour marks: long at 12, 3, 6 and 9
      for (let i = 0; i < 12; i++) {
        const angle = i * 30 * (Math.PI / 180);
        const long = i % 3 === 0;
        const r0 = long ? 27 : 30;
        g.moveTo(Math.sin(angle) * r0, -Math.cos(angle) * r0);
        g.lineTo(Math.sin(angle) * 34, -Math.cos(angle) * 34);
        g.stroke({ width: long ? 3 : 2, color: m.outline });
      }

      // Hands
      const hours = time.getHours() % 12;
      const mins = time.getMinutes();
      const secs = time.getSeconds();

      // Hour hand
      const hAngle = (hours * 30 + mins * 0.5) * (Math.PI / 180);
      g.moveTo(0, 0);
      g.lineTo(Math.sin(hAngle) * 19, -Math.cos(hAngle) * 19);
      g.stroke({ width: 4, color: m.outline });

      // Minute hand
      const mAngle = mins * 6 * (Math.PI / 180);
      g.moveTo(0, 0);
      g.lineTo(Math.sin(mAngle) * 29, -Math.cos(mAngle) * 29);
      g.stroke({ width: 3, color: m.outline });

      // Second hand in the accent, with a little tail
      const sAngle = secs * 6 * (Math.PI / 180);
      g.moveTo(-Math.sin(sAngle) * 7, Math.cos(sAngle) * 7);
      g.lineTo(Math.sin(sAngle) * 33, -Math.cos(sAngle) * 33);
      g.stroke({ width: 1.5, color: palette.accentInk });
      g.circle(0, 0, 3);
      g.fill(palette.accentInk);
    },
    [time, palette],
  );

  // Draw a clickable hit area (sized for the larger of analog/digital)
  const drawHitArea = useCallback(
    (g: Graphics) => {
      g.clear();
      if (clockType === "analog") {
        g.circle(0, 0, 44);
      } else {
        // Rectangular hit area for digital clock
        g.roundRect(-54, -28, 108, 56, 6);
      }
      g.fill({ color: 0x000000, alpha: 0 }); // Invisible but clickable
    },
    [clockType],
  );

  return (
    <pixiContainer
      eventMode="static"
      cursor="pointer"
      onPointerDown={handleClick}
    >
      {clockType === "analog" ? (
        <pixiGraphics draw={drawAnalogClock} />
      ) : (
        <DigitalClock format={clockFormat} />
      )}
      {/* Invisible hit area to ensure clicks register */}
      <pixiGraphics draw={drawHitArea} />
    </pixiContainer>
  );
}
