/** Darken (k < 1) a 0xRRGGBB colour channel by channel. */
export function shade(color: number, k: number): number {
  const ch = (shift: number) =>
    Math.min(255, Math.max(0, Math.round(((color >> shift) & 0xff) * k)));
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}
