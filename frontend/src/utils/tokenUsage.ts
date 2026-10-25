/**
 * Session token totals and estimated cost, from the backend's optional
 * `tokenUsage` (on the office state and on each session in the list).
 */

export interface TokenTotals {
  total: number;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  /** Estimate in USD; null when a model in the session has no known price. */
  costUsd: number | null;
}

function count(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : 0;
}

/** Read `tokenUsage`; null when absent, malformed or still empty. */
export function parseTokenUsage(raw: unknown): TokenTotals | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const input = count(r.inputTokens);
  const output = count(r.outputTokens);
  const cacheRead = count(r.cacheReadTokens);
  const cacheWrite = count(r.cacheWriteTokens);
  const total = input + output + cacheRead + cacheWrite;
  if (total === 0) return null;
  const costUsd =
    typeof r.costUsd === "number" && Number.isFinite(r.costUsd)
      ? r.costUsd
      : null;
  return { total, input, output, cacheRead, cacheWrite, costUsd };
}

/** True when two totals would display the same. */
export function sameTokenTotals(
  a: TokenTotals | null,
  b: TokenTotals | null,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.input === b.input &&
    a.output === b.output &&
    a.cacheRead === b.cacheRead &&
    a.cacheWrite === b.cacheWrite &&
    a.costUsd === b.costUsd
  );
}

/** "950", "45k", "1.3M", "12M". */
export function formatTokens(n: number): string {
  if (n < 1000) return String(Math.round(n));
  if (n < 1_000_000) return `${Math.round(n / 1000)}k`;
  const millions = n / 1_000_000;
  return `${millions < 10 ? millions.toFixed(1) : Math.round(millions)}M`;
}

/** "≈$1.23", "≈$123", "<$0.01"; null without a price or at zero. */
export function formatCost(usd: number | null): string | null {
  // No price known, or a zero estimate: show tokens only, never "$0".
  if (usd === null || usd <= 0) return null;
  if (usd < 0.01) return "<$0.01";
  if (usd < 100) return `≈$${usd.toFixed(2)}`;
  return `≈$${Math.round(usd)}`;
}

/** Tooltip text with the breakdown. */
export function tokenBreakdown(t: TokenTotals): string {
  return [
    `in ${formatTokens(t.input)}`,
    `out ${formatTokens(t.output)}`,
    `cache read ${formatTokens(t.cacheRead)}`,
    `cache write ${formatTokens(t.cacheWrite)}`,
  ].join(" · ");
}

/** "1.3M tok · ≈$3.40" for a session row; null without usage. */
export function usageLabel(raw: unknown): string | null {
  const totals = parseTokenUsage(raw);
  if (!totals) return null;
  const cost = formatCost(totals.costUsd);
  return [`${formatTokens(totals.total)} tok`, cost]
    .filter(Boolean)
    .join(" · ");
}
