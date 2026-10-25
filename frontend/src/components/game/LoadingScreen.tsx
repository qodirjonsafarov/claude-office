/**
 * LoadingScreen Component
 *
 * Displays a loading screen while office textures are being loaded.
 * Shows animated dots and a "Loading office..." message.
 */

"use client";

import { type ReactNode } from "react";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "@/constants/canvas";
import { useTranslation } from "@/hooks/useTranslation";

export function LoadingScreen(): ReactNode {
  const { t } = useTranslation();
  return (
    <pixiContainer>
      {/* The Olymp panel colour, so the scene loads in the app's look */}
      <pixiGraphics
        draw={(g) => {
          g.clear();
          g.fill({ color: 0x0f1715 });
          g.rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        }}
      />
      {/* Loading text rendered at 2x for sharpness */}
      <pixiContainer x={CANVAS_WIDTH / 2} y={CANVAS_HEIGHT / 2} scale={0.5}>
        <pixiText
          text={t("loading.office")}
          anchor={0.5}
          style={{
            fontFamily: "Manrope, system-ui, sans-serif",
            fontSize: 48,
            fontWeight: "800",
            fill: 0xa9b8b0,
            letterSpacing: 1,
          }}
        />
      </pixiContainer>
      {/* Animated dots */}
      <pixiContainer x={CANVAS_WIDTH / 2} y={CANVAS_HEIGHT / 2 + 40}>
        {[0, 1, 2].map((i) => (
          <pixiGraphics
            key={i}
            x={(i - 1) * 20}
            draw={(g) => {
              g.clear();
              g.fill({ color: 0xa7f36a, alpha: 0.8 });
              g.circle(0, 0, 4);
            }}
          />
        ))}
      </pixiContainer>
    </pixiContainer>
  );
}
