/**
 * Small motions of the office scene ("juice"), as pure functions of time.
 *
 * Durations follow docs/plans/next-wave.md: bubble pop 220 ms with back-out
 * easing, arrival squash 160 ms, error shake 150 ms by +/-1 px, the
 * needs-you pulse slower than 1 Hz, and a done celebration of at most 20
 * particles that is over in under 900 ms. Under reduced motion the scene
 * skips these and uses short fades (fadeIn) instead.
 */

export const BUBBLE_POP_MS = 220;
export const SQUASH_MS = 160;
export const SHAKE_MS = 150;
/** One pulse per 1.2 s: below 1 Hz, well under 3 flashes per second. */
export const PULSE_PERIOD_MS = 1200;
export const CELEBRATION_MS = 800;
export const MAX_PARTICLES = 16;
/** Opacity fades used instead of motion when reduced motion is on. */
export const FADE_MS = 120;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** easeOutBack: overshoots a little past 1, then settles. */
function backOut(u: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (u - 1) ** 3 + c1 * (u - 1) ** 2;
}

/** Bubble scale `ms` after it appeared: 0.6 -> ~1.04 -> 1.0. */
export function bubblePopScale(ms: number): number {
  if (ms >= BUBBLE_POP_MS) return 1;
  return 0.6 + 0.4 * backOut(clamp01(ms / BUBBLE_POP_MS));
}

/** Arrival squash: wider and shorter for a moment, then back to normal. */
export function squashScale(ms: number): { x: number; y: number } {
  if (ms <= 0 || ms >= SQUASH_MS) return { x: 1, y: 1 };
  const s = Math.sin(Math.PI * (ms / SQUASH_MS));
  return { x: 1 + 0.1 * s, y: 1 - 0.1 * s };
}

/** Error shake: whole-pixel offsets (+1 / -1) for 150 ms, then 0. */
export function shakeOffset(ms: number): number {
  if (ms < 0 || ms >= SHAKE_MS) return 0;
  return Math.floor(ms / 25) % 2 === 0 ? 1 : -1;
}

/** Smooth 0..1 pulse with a period of PULSE_PERIOD_MS. */
export function pulse(ms: number): number {
  return (1 - Math.cos((2 * Math.PI * ms) / PULSE_PERIOD_MS)) / 2;
}

/** Opacity of a fade-in `ms` after it started. */
export function fadeIn(ms: number, duration = FADE_MS): number {
  return clamp01(ms / duration);
}

// ============================================================================
// DONE CELEBRATION
// ============================================================================

export interface ParticleState {
  x: number;
  y: number;
  alpha: number;
  scale: number;
}

export interface Particle {
  /** Colour index into the burst palette. */
  color: number;
  at(ms: number): ParticleState;
}

/** Deterministic pseudo-random numbers in [0, 1) for a seed. */
function random(seed: number) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10_000) / 10_000;
  };
}

/** A small confetti burst over a character (offsets from its head). */
export function celebration(seed: number): Particle[] {
  const rnd = random(seed);
  const particles: Particle[] = [];
  for (let i = 0; i < MAX_PARTICLES; i++) {
    const angle = -Math.PI / 2 + (rnd() - 0.5) * Math.PI * 1.1;
    const speed = 26 + rnd() * 26; // px over the whole burst
    const color = i % 4;
    particles.push({
      color,
      at(ms: number): ParticleState {
        const u = clamp01(ms / CELEBRATION_MS);
        if (u >= 1) return { x: 0, y: 0, alpha: 0, scale: 0 };
        const travel = speed * (1 - (1 - u) ** 2); // ease out
        return {
          x: Math.round(Math.cos(angle) * travel),
          y: Math.round(Math.sin(angle) * travel + 30 * u * u), // falls back
          alpha: 1 - u,
          scale: 1,
        };
      },
    });
  }
  return particles;
}
