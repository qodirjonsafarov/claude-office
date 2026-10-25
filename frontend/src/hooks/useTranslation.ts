"use client";

import { t, type TranslationKey } from "@/i18n";

export function useTranslation() {
  return { t };
}

export type { TranslationKey };
