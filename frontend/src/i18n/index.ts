import en, { type TranslationKey } from "./en";

/** English-only translation. Supports `{name}` params and `count` plurals (_one/_other). */
export function t(
  key: TranslationKey,
  params?: Record<string, string | number>,
): string {
  // Pluralization support: if params contains "count", try _one/_other suffixes
  let text: string | undefined;
  if (params && typeof params.count === "number") {
    const pluralSuffix = params.count === 1 ? "_one" : "_other";
    text = en[`${key}${pluralSuffix}` as TranslationKey];
  }

  // Fall back to base key
  if (text === undefined) {
    text = en[key] ?? key;
  }

  if (params) {
    let result = text;
    for (const [k, v] of Object.entries(params)) {
      const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      result = result.replace(new RegExp(`\\{${escaped}\\}`, "g"), () =>
        String(v),
      );
    }
    return result;
  }
  return text;
}

export type { TranslationKey };
