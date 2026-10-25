/**
 * Session tokens and cost for the HUD and the session rows, from the
 * backend's optional `tokenUsage` (office state and session list).
 */
import { describe, expect, it } from "vitest";
import {
  apiCost,
  costRows,
  usageTooltip,
  formatCost,
  formatTokens,
  usageLabel,
  parseTokenUsage,
} from "../src/utils/tokenUsage";

describe("parseTokenUsage", () => {
  it("adds up all token kinds and keeps the cost", () => {
    expect(
      parseTokenUsage({
        inputTokens: 1000,
        outputTokens: 2000,
        cacheReadTokens: 30000,
        cacheWriteTokens: 4000,
        model: "claude-opus-4-5",
        costUsd: 1.234,
      }),
    ).toEqual({
      total: 37000,
      input: 1000,
      output: 2000,
      cacheRead: 30000,
      cacheWrite: 4000,
      costUsd: 1.234,
      costParts: null,
    });
  });

  it("keeps the cost split by kind when the backend sends it", () => {
    expect(
      parseTokenUsage({
        inputTokens: 1,
        costUsd: 10,
        costInputUsd: 1,
        costOutputUsd: 2,
        costCacheReadUsd: 3,
        costCacheWriteUsd: 4,
      })?.costParts,
    ).toEqual({ input: 1, output: 2, cacheRead: 3, cacheWrite: 4 });
  });

  it("keeps a null cost (model without a known price)", () => {
    expect(
      parseTokenUsage({ inputTokens: 5, outputTokens: 5, costUsd: null })
        ?.costUsd,
    ).toBeNull();
  });

  it("returns null when absent, malformed or empty", () => {
    expect(parseTokenUsage(undefined)).toBeNull();
    expect(parseTokenUsage(null)).toBeNull();
    expect(parseTokenUsage("x")).toBeNull();
    expect(parseTokenUsage({ inputTokens: 0, outputTokens: 0 })).toBeNull();
  });
});

describe("formatTokens", () => {
  it("shortens big numbers", () => {
    expect(formatTokens(950)).toBe("950");
    expect(formatTokens(45_200)).toBe("45k");
    expect(formatTokens(1_250_000)).toBe("1.3M");
    expect(formatTokens(12_400_000)).toBe("12M");
  });
});

describe("formatCost", () => {
  it("shows an approximate dollar amount", () => {
    expect(formatCost(1.234)).toBe("≈$1.23");
    expect(formatCost(123.4)).toBe("≈$123");
  });

  it("shows tiny amounts as under a cent", () => {
    expect(formatCost(0.004)).toBe("<$0.01");
  });

  it("shows nothing without a price", () => {
    expect(formatCost(null)).toBeNull();
  });

  it("never shows $0", () => {
    expect(formatCost(0)).toBeNull();
  });
});

describe("usageLabel", () => {
  it("joins tokens and cost for a session row", () => {
    expect(
      usageLabel({
        inputTokens: 1_000_000,
        outputTokens: 250_000,
        costUsd: 3.4,
      }),
    ).toBe("1.3M tok · ≈ API $3.40");
  });

  it("leaves the cost out without a price", () => {
    expect(usageLabel({ inputTokens: 45_000 })).toBe("45k tok");
  });

  it("is null without usage", () => {
    expect(usageLabel(undefined)).toBeNull();
  });
});

describe("apiCost", () => {
  it("says the dollars are an API-equivalent estimate", () => {
    expect(apiCost(151.2)).toBe("≈ API $151");
    expect(apiCost(null)).toBeNull();
  });
});

const usage = parseTokenUsage({
  inputTokens: 1_200_000,
  outputTokens: 2_400_000,
  cacheReadTokens: 420_000_000,
  cacheWriteTokens: 18_000_000,
  costUsd: 151.2,
  costInputUsd: 4.8,
  costOutputUsd: 48,
  costCacheReadUsd: 84,
  costCacheWriteUsd: 14.4,
})!;

describe("costRows", () => {
  it("lists each token kind with its tokens and dollars", () => {
    expect(costRows(usage)).toEqual([
      { label: "Input", tokens: "1.2M", usd: "$4.80" },
      { label: "Output", tokens: "2.4M", usd: "$48.00" },
      { label: "Cache read", tokens: "420M", usd: "$84.00" },
      { label: "Cache write", tokens: "18M", usd: "$14.40" },
    ]);
  });

  it("leaves dollars out when there is no split", () => {
    const plain = parseTokenUsage({ inputTokens: 5 })!;
    expect(costRows(plain)[0]).toEqual({
      label: "Input",
      tokens: "5",
      usd: null,
    });
  });
});

describe("usageTooltip", () => {
  it("explains the estimate and lists the kinds", () => {
    const text = usageTooltip(usage);
    expect(text.split("\n")[0]).toMatch(/API-equivalent/);
    expect(text).toContain("not your subscription bill");
    expect(text).toContain("Cache read 420M · $84.00");
  });
});
