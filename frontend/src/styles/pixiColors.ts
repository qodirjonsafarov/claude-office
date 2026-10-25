/**
 * Olymp colours for the Pixi canvas, which cannot read CSS variables.
 *
 * MIRROR of styles/tokens.css: every value here is a copy of a `--qo-*`
 * token. When a token changes there, change it here too (and `themeColor`
 * in app/layout.tsx, which mirrors --qo-bg).
 */
export const PIXI_COLORS = {
  /** --qo-panel */
  panel: 0x0f1715,
  /** --qo-panel-3 */
  panel3: 0x1d2b26,
  /** --qo-ink */
  ink: 0xf2f6f2,
  /** --qo-ink-soft */
  inkSoft: 0xa9b8b0,
  /** --qo-accent */
  accent: 0xa7f36a,
} as const;
