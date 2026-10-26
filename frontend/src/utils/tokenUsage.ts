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
  /** The same estimate per token kind (null when the backend did not split it). */
  costParts: CostParts | null;
}

export interface CostParts {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

function usd(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseCostParts(r: Record<string, unknown>): CostParts | null {
  const input = usd(r.costInputUsd);
  const output = usd(r.costOutputUsd);
  const cacheRead = usd(r.costCacheReadUsd);
  const cacheWrite = usd(r.costCacheWriteUsd);
  if (input === null || output === null || cacheRead === null) return null;
  if (cacheWrite === null) return null;
  return { input, output, cacheRead, cacheWrite };
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
  return {
    total,
    input,
    output,
    cacheRead,
    cacheWrite,
    costUsd,
    costParts: parseCostParts(r),
  };
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
    a.costUsd === b.costUsd &&
    JSON.stringify(a.costParts) === JSON.stringify(b.costParts)
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

/** "≈ API $151": the dollars are what the tokens would cost on the API. */
export function apiCost(usd: number | null): string | null {
  const cost = formatCost(usd);
  return cost
    ? cost.replace(/^(≈|<)/, (m) => `${m === "≈" ? "≈ " : "< "}API `)
    : null;
}

export interface CostRow {
  label: string;
  tokens: string;
  /** "$4.80"; null when the backend did not split the cost. */
  usd: string | null;
}

/** One row per token kind: tokens and their share of the estimate. */
export function costRows(t: TokenTotals): CostRow[] {
  const money = (v: number | undefined) =>
    v === undefined ? null : `$${v.toFixed(2)}`;
  const p = t.costParts ?? undefined;
  return [
    { label: "Input", tokens: formatTokens(t.input), usd: money(p?.input) },
    { label: "Output", tokens: formatTokens(t.output), usd: money(p?.output) },
    {
      label: "Cache read",
      tokens: formatTokens(t.cacheRead),
      usd: money(p?.cacheRead),
    },
    {
      label: "Cache write",
      tokens: formatTokens(t.cacheWrite),
      usd: money(p?.cacheWrite),
    },
  ];
}

/** What the estimate means, then the split. */
export const COST_NOTE =
  "API-equivalent estimate: what these tokens would cost at API list prices, not your subscription bill.";

/** Tooltip text: the note and one line per kind. */
export function usageTooltip(t: TokenTotals): string {
  const lines = costRows(t).map((row) =>
    [`${row.label} ${row.tokens}`, row.usd].filter(Boolean).join(" · "),
  );
  return [COST_NOTE, ...lines].join("\n");
}

/** "1.3M tok · ≈$3.40" for a session row; null without usage. */
export function usageLabel(raw: unknown): string | null {
  const totals = parseTokenUsage(raw);
  if (!totals) return null;
  const cost = apiCost(totals.costUsd);
  return [`${formatTokens(totals.total)} tok`, cost]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Per-person usage from a state update: "boss" from `boss.tokenUsage`, each
 * agent from its own `tokenUsage`. People without usage yet are left out.
 */
export function agentUsageMap(state: {
  boss: { tokenUsage?: unknown };
  agents: readonly { id: string; tokenUsage?: unknown }[];
}): Map<string, TokenTotals> {
  const map = new Map<string, TokenTotals>();
  const boss = parseTokenUsage(state.boss.tokenUsage);
  if (boss) map.set("boss", boss);
  for (const agent of state.agents) {
    const totals = parseTokenUsage(agent.tokenUsage);
    if (totals) map.set(agent.id, totals);
  }
  return map;
}

/** The agent card's two numbers: a dash while the usage is unknown. */
export function cardUsage(t: TokenTotals | null): {
  tokens: string;
  cost: string;
  title: string | null;
} {
  if (!t) return { tokens: "—", cost: "—", title: null };
  return {
    tokens: formatTokens(t.total),
    cost: apiCost(t.costUsd) ?? "—",
    title: usageTooltip(t),
  };
}
