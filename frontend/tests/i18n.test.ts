import { describe, expect, it } from "vitest";
import { t, type TranslationKey } from "../src/i18n";
import en from "../src/i18n/en";

describe("t", () => {
  it("returns values from the English dictionary", () => {
    expect(t("app.title")).toBe(en["app.title"]);
  });

  it("replaces named parameters", () => {
    const result = t("agentStatus.inQueue", {
      queueType: "render",
      position: 3,
    });
    expect(result).toContain("render");
    expect(result).toContain("3");
    expect(result).not.toContain("{queueType}");
    expect(result).not.toContain("{position}");
  });

  it("handles numeric zero as parameter", () => {
    expect(
      t("agentStatus.inQueue", { queueType: "task", position: 0 }),
    ).toContain("0");
  });

  it("leaves unreplaced placeholders intact when param is missing", () => {
    const result = t("agentStatus.inQueue", { queueType: "render" });
    expect(result).toContain("{position}");
  });

  it("ignores extra params with no matching placeholder", () => {
    expect(t("app.title", { unused: "value", another: 42 })).toBe(
      en["app.title"],
    );
  });

  it("escapes regex metacharacters in param keys", () => {
    expect(() =>
      t("app.title", { "key.with+special$chars": "val" }),
    ).not.toThrow();
  });

  it("does not expand $-sequences in replacement values", () => {
    const result = t("agentStatus.inQueue", {
      queueType: "$&exploit",
      position: 1,
    });
    expect(result).toContain("$&exploit");
  });

  it("returns the raw key when it is missing from the dictionary", () => {
    expect((t as (key: string) => string)("nonexistent.key.xyz")).toBe(
      "nonexistent.key.xyz",
    );
  });

  it("has no empty values and resolves every key", () => {
    for (const key of Object.keys(en)) {
      expect(en[key as TranslationKey], `en["${key}"] is empty`).not.toBe("");
      expect(t(key as TranslationKey).length).toBeGreaterThan(0);
    }
  });
});
