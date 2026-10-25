"use client";

import { History, MoreHorizontal, Terminal } from "lucide-react";
import { OfficeDesk } from "@/components/ui/icons";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import type { TranslationKey } from "@/i18n";

export type MobileTab = "office" | "events" | "sessions" | "more";

const TABS: { id: MobileTab; label: TranslationKey; icon: LucideIcon }[] = [
  { id: "office", label: "mobile.office", icon: OfficeDesk },
  { id: "events", label: "mobile.events", icon: Terminal },
  { id: "sessions", label: "mobile.sessions", icon: History },
  { id: "more", label: "mobile.more", icon: MoreHorizontal },
];

interface MobileTabBarProps {
  active: MobileTab;
  onSelect: (tab: MobileTab) => void;
  /** "bar": pinned to the bottom (portrait); "rail": a strip at the side (landscape). */
  variant: "bar" | "rail";
  /** A small count on a tab (new events). */
  badges?: Partial<Record<MobileTab, number>>;
}

/**
 * The phone's navigation, as in Olymp: the places under the thumb, the lit one
 * in lime. The office is the home tab; the others open their sheet over it.
 */
export function MobileTabBar({
  active,
  onSelect,
  variant,
  badges = {},
}: MobileTabBarProps): React.ReactNode {
  const { t } = useTranslation();
  const rail = variant === "rail";

  return (
    <nav
      aria-label={t("mobile.menu")}
      className={
        rail
          ? "flex flex-col items-center justify-center w-[var(--qo-rail-w)] py-2"
          : "flex-shrink-0 qo-glass-panel border-t border-line qo-safe-bottom qo-safe-x"
      }
    >
      <div className={rail ? "flex flex-col gap-1" : "grid grid-cols-4"}>
        {TABS.map(({ id, label, icon: Icon }) => {
          const lit = id === active;
          const badge = badges[id] ?? 0;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              aria-current={lit ? "page" : undefined}
              aria-label={rail ? t(label) : undefined}
              title={rail ? t(label) : undefined}
              className={`relative flex flex-col items-center justify-center gap-1 font-bold transition-colors ${
                rail
                  ? `w-12 h-12 rounded-xl2 ${lit ? "bg-accent-dim text-accent" : "text-ink-faint hover:text-ink"}`
                  : `min-h-[var(--qo-bar-h)] pt-2 pb-1.5 text-[11px] ${lit ? "text-accent" : "text-ink-faint"}`
              }`}
            >
              <span className="relative">
                <Icon
                  size={rail ? 22 : 23}
                  strokeWidth={2.4}
                  aria-hidden="true"
                />
                {badge > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[17px] h-[17px] px-1 rounded-full bg-accent text-on-accent text-[10px] font-extrabold leading-[17px] text-center">
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </span>
              {!rail && <span className="max-w-full truncate">{t(label)}</span>}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
