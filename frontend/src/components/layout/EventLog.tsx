/**
 * EventLog - Event log panel
 *
 * Displays event history from the unified Zustand store, with a quick
 * filter: text search, one person (All / Boss / an agent) and kinds
 * (tools / errors / permissions). Agent ids are shown as names.
 * Entries are clickable to open a detail modal.
 */

"use client";

import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  useGameStore,
  selectEventLog,
  type EventLogEntry,
} from "@/stores/gameStore";
import { format } from "date-fns";
import { ChevronRight, Search, Terminal, X } from "lucide-react";
import { EventDetailModal } from "@/components/game/EventDetailModal";
import { useTranslation } from "@/hooks/useTranslation";
import { getEventTypeTextColor } from "@/utils/event-type-styles";
import { personKey } from "@/utils/agentActivity";
import {
  FILTER_KINDS,
  agentNames,
  filterEvents,
  logPeople,
  personLabel,
} from "@/utils/eventFilter";
import type { TranslationKey } from "@/i18n";

const KIND_LABELS: Record<(typeof FILTER_KINDS)[number], TranslationKey> = {
  tools: "eventLog.kindTools",
  errors: "eventLog.kindErrors",
  permissions: "eventLog.kindPermissions",
};

function hasNonEmptyDetail(event: EventLogEntry): boolean {
  return !!event.detail && Object.keys(event.detail).length > 0;
}

/** Agent id -> name and colour, for present and departed agents. */
function useAgentDirectory(): {
  names: Map<string, string>;
  colors: Map<string, string>;
} {
  // Primitives only, so per-frame position updates don't re-render the log.
  const flat = useGameStore(
    useShallow((s) => {
      const out: (string | number | null)[] = [];
      for (const a of s.agents.values())
        out.push(a.id, a.name, a.number, a.color);
      return out;
    }),
  );
  const lifespans = useGameStore((s) => s.whiteboardData.agentLifespans);
  return useMemo(() => {
    const agents: { id: string; name: string | null; number: number }[] = [];
    const colors = new Map<string, string>();
    for (const span of lifespans ?? []) colors.set(span.agentId, span.color);
    for (let i = 0; i + 4 <= flat.length; i += 4) {
      const id = flat[i] as string;
      agents.push({
        id,
        name: flat[i + 1] as string | null,
        number: flat[i + 2] as number,
      });
      colors.set(id, flat[i + 3] as string);
    }
    return { names: agentNames(agents, lifespans ?? []), colors };
  }, [flat, lifespans]);
}

/** The log's text search (also placed in a phone sheet's header). */
export function EventSearch({
  value,
  onChange,
  className = "",
}: {
  value: string;
  onChange: (query: string) => void;
  className?: string;
}): React.ReactNode {
  const { t } = useTranslation();
  return (
    <label className={`relative block ${className}`}>
      <Search
        size={15}
        strokeWidth={2.2}
        aria-hidden="true"
        className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("eventLog.search")}
        aria-label={t("eventLog.search")}
        className="qo-input qo-input-sm w-full !pl-9"
      />
    </label>
  );
}

interface EventLogProps {
  /** Controlled search text (the search box lives outside, see `compact`). */
  query?: string;
  onQueryChange?: (query: string) => void;
  /** Phone landscape: no title row, no search box (the sheet header has it). */
  compact?: boolean;
  /** Chips in one row that scrolls sideways (phones) instead of wrapping. */
  scrollChips?: boolean;
}

export function EventLog({
  query: controlledQuery,
  onQueryChange,
  compact = false,
  scrollChips = false,
}: EventLogProps = {}) {
  const { t } = useTranslation();
  const eventLog = useGameStore(selectEventLog);
  const { names, colors } = useAgentDirectory();
  const [selectedEvent, setSelectedEvent] = useState<EventLogEntry | null>(
    null,
  );
  const [ownQuery, setOwnQuery] = useState("");
  const query = controlledQuery ?? ownQuery;
  const setQuery = onQueryChange ?? setOwnQuery;
  const [person, setPerson] = useState("all");
  const [kinds, setKinds] = useState<ReadonlySet<string>>(new Set());

  const people = useMemo(() => logPeople(eventLog), [eventLog]);
  const shown = useMemo(
    () => filterEvents(eventLog, { query, person, kinds }, names),
    [eventLog, query, person, kinds, names],
  );
  const filtering = query.trim() !== "" || person !== "all" || kinds.size > 0;

  const toggleKind = (kind: string) =>
    setKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });

  const clearFilters = () => {
    setQuery("");
    setPerson("all");
    setKinds(new Set());
  };

  return (
    <>
      <div className="qo-card flex flex-col h-full overflow-hidden text-xs">
        <div
          className={`px-4 pt-3 pb-2 items-center justify-between flex-shrink-0 ${
            compact ? "hidden" : "flex"
          }`}
        >
          <div className="qo-eyebrow flex items-center gap-2">
            <Terminal size={14} strokeWidth={2.2} aria-hidden="true" />
            {t("eventLog.title")}
          </div>
          <div className="text-[12px] font-bold text-ink-faint tabular-nums">
            {filtering
              ? `${shown.length}/${eventLog.length}`
              : t("eventLog.events", { count: eventLog.length })}
          </div>
        </div>

        {/* Quick filter: search, person chips, kind chips */}
        <div
          className={`px-2 pb-2 flex flex-col gap-2 flex-shrink-0 ${compact ? "pt-2" : ""}`}
        >
          {!compact && <EventSearch value={query} onChange={setQuery} />}
          <div
            role="toolbar"
            aria-label={t("eventLog.filters")}
            className={
              scrollChips
                ? "qo-fade-end flex gap-1.5 pr-6 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                : "flex flex-wrap gap-1.5"
            }
          >
            <button
              type="button"
              className="qo-chip"
              aria-pressed={person === "all"}
              onClick={() => setPerson("all")}
            >
              {t("eventLog.all")}
            </button>
            <button
              type="button"
              className="qo-chip"
              aria-pressed={person === "boss"}
              onClick={() => setPerson(person === "boss" ? "all" : "boss")}
            >
              <span
                aria-hidden="true"
                className="w-2 h-2 rounded-full bg-max"
              />
              {t("mobile.boss")}
            </button>
            {people.map((id) => {
              const color = colors.get(id);
              return (
                <button
                  key={id}
                  type="button"
                  className="qo-chip"
                  aria-pressed={person === id}
                  onClick={() => setPerson(person === id ? "all" : id)}
                >
                  <span
                    aria-hidden="true"
                    className="w-2 h-2 rounded-full bg-ink-faint"
                    style={color ? { background: color } : undefined}
                  />
                  {personLabel(id, names)}
                </button>
              );
            })}
            <span
              aria-hidden="true"
              className="w-px my-1 bg-line-strong flex-shrink-0"
            />
            {FILTER_KINDS.map((kind) => (
              <button
                key={kind}
                type="button"
                className="qo-chip"
                aria-pressed={kinds.has(kind)}
                onClick={() => toggleKind(kind)}
              >
                {t(KIND_LABELS[kind])}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-grow overflow-y-auto px-2 pb-2 flex flex-col gap-0.5 min-h-0">
          {eventLog.length === 0 ? (
            <div className="text-ink-faint font-bold p-4 text-center text-[12.5px]">
              {t("eventLog.waiting")}
            </div>
          ) : shown.length === 0 ? (
            <div className="p-4 flex flex-col items-center gap-2 text-center">
              <span className="text-ink-faint font-bold text-[12.5px]">
                {t("eventLog.noMatches")}
              </span>
              <button
                type="button"
                onClick={clearFilters}
                className="qo-btn qo-btn-ghost"
              >
                <X size={14} strokeWidth={2.2} />
                {t("eventLog.clearFilters")}
              </button>
            </div>
          ) : (
            shown.map((event, index) => (
              <div
                key={`${event.id}-${index}`}
                role="button"
                tabIndex={0}
                className="hover:bg-panel-2 px-2.5 py-1.5 rounded-xl transition-colors group cursor-pointer"
                onClick={() => setSelectedEvent(event)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedEvent(event);
                  }
                }}
              >
                {/* Line 1: Time, Event Type, Person, Detail indicator */}
                <div className="flex gap-2 items-center min-w-0">
                  <span className="text-ink-faint flex-shrink-0 font-mono tabular-nums text-[11px]">
                    {format(event.timestamp, "HH:mm:ss")}
                  </span>
                  <span
                    className={`flex-shrink-0 font-extrabold text-[10px] uppercase tracking-wide ${getEventTypeTextColor(event.type)}`}
                  >
                    {event.type.replace(/_/g, " ")}
                  </span>
                  {personKey(event.agentId) !== "boss" && (
                    <span
                      className="min-w-0 truncate text-[11px] font-extrabold text-ink-soft"
                      title={event.agentId ?? undefined}
                    >
                      @{personLabel(event.agentId, names)}
                    </span>
                  )}
                  {hasNonEmptyDetail(event) && (
                    <ChevronRight
                      size={13}
                      strokeWidth={2.2}
                      aria-hidden="true"
                      className="ml-auto flex-shrink-0 text-ink-faint group-hover:text-ink-soft transition-colors"
                    />
                  )}
                </div>
                {/* Line 2: Details/Summary */}
                <div
                  className="text-ink truncate text-[12px] font-semibold"
                  title={event.summary}
                >
                  {event.summary}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </>
  );
}
