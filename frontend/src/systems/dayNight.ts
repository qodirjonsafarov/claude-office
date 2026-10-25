/**
 * Day/night grading of the office: one multiply tint over the scene whose
 * strength follows the local time (clear by day, at most 0.35 at night,
 * smooth dusk and dawn), and soft lamp pools that glow at night. A debug
 * override ("?time=22:30") fixes the time for screenshots. Pure TS.
 */

/** Strongest night tint (multiply alpha), reached late at night. */
export const NIGHT_ALPHA = 0.35;
/** Tint right after dusk: the evening is visibly lighter than late night. */
const EVENING_ALPHA = 0.16;
/** Late night: from 22:00 to 04:00 the office is darkest. */
const DEEP_START = 22;
const DEEP_END = 4;
/** Deep blue night tint, multiplied over the scene. */
export const NIGHT_TINT = 0x1f2a55;

/** [dawnStart, dawnEnd, duskStart, duskEnd] hours, like city/timeUtils.ts */
export type DayTimes = readonly [number, number, number, number];
const DEFAULT_TIMES: DayTimes = [5, 8, 17, 20];

function smooth(u: number): number {
  const x = Math.min(1, Math.max(0, u));
  return x * x * (3 - 2 * x);
}

function lerp(from: number, to: number, u: number): number {
  return from + (to - from) * smooth(u);
}

/**
 * Night tint strength at `hours` (0..24, fractional): clear by day, dusk
 * fades in to an evening tint, the evening deepens to the full night by
 * 22:00, and before dawn it lifts again.
 */
export function nightAlpha(
  hours: number,
  times: DayTimes = DEFAULT_TIMES,
): number {
  const [dawnStart, dawnEnd, duskStart, duskEnd] = times;
  const h = ((hours % 24) + 24) % 24;
  if (h >= dawnEnd && h <= duskStart) return 0;
  if (h > duskStart && h < duskEnd) {
    return lerp(0, EVENING_ALPHA, (h - duskStart) / (duskEnd - duskStart));
  }
  if (h >= duskEnd && h < DEEP_START) {
    return lerp(
      EVENING_ALPHA,
      NIGHT_ALPHA,
      (h - duskEnd) / (DEEP_START - duskEnd),
    );
  }
  if (h > dawnStart && h < dawnEnd) {
    return lerp(EVENING_ALPHA, 0, (h - dawnStart) / (dawnEnd - dawnStart));
  }
  if (h > DEEP_END && h <= dawnStart) {
    return lerp(
      NIGHT_ALPHA,
      EVENING_ALPHA,
      (h - DEEP_END) / (dawnStart - DEEP_END),
    );
  }
  return NIGHT_ALPHA;
}

/** Lamp pool brightness 0..1 (follows the night tint). */
export function lampGlow(hours: number, times?: DayTimes): number {
  return nightAlpha(hours, times) / NIGHT_ALPHA;
}

/** "HH:MM" → fractional hours, null when empty or invalid. */
export function parseTimeOverride(
  value: string | null | undefined,
): number | null {
  if (!value) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h + min / 60;
}

/** Hours to draw the office at: the override, else the local clock. */
export function sceneHours(now: Date, override: number | null): number {
  if (override !== null) return override;
  return now.getHours() + now.getMinutes() / 60;
}
