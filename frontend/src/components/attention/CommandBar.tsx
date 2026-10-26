"use client";

import {
  useEffect,
  useRef,
  useMemo,
  useCallback,
  useState,
  type ReactNode,
} from "react";
import {
  BellOff,
  Bug,
  Construction,
  Crown,
  Hash,
  Route,
  Search,
  Tag,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useAttentionStore } from "@/stores/attentionStore";
import { useGameStore } from "@/stores/gameStore";
import { useTranslation } from "@/hooks/useTranslation";

/** Simple character-by-character fuzzy match. */
function fuzzyMatch(query: string, text: string): boolean {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

interface CommandEntry {
  id: string;
  label: string;
  icon: LucideIcon;
  action: () => void;
}

export default function CommandBar(): ReactNode {
  const isOpen = useAttentionStore((s) => s.isCommandBarOpen);
  const filter = useAttentionStore((s) => s.commandFilter);
  const closeCommandBar = useAttentionStore((s) => s.closeCommandBar);
  const setCommandFilter = useAttentionStore((s) => s.setCommandFilter);
  const clearAllToasts = useAttentionStore((s) => s.clearAllToasts);
  const openFocusPopup = useAttentionStore((s) => s.openFocusPopup);

  const agents = useGameStore((s) => s.agents);
  const setDebugMode = useGameStore((s) => s.setDebugMode);
  const toggleDebugOverlay = useGameStore((s) => s.toggleDebugOverlay);

  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Build command list
  const commands: CommandEntry[] = useMemo(() => {
    const cmds: CommandEntry[] = [];

    // Per-agent focus commands
    agents.forEach((agent) => {
      if (!agent.name) return;
      cmds.push({
        id: `focus-${agent.id}`,
        label: t("attention.commandBar.focusAgent").replace(
          "{name}",
          agent.name,
        ),
        icon: Zap,
        action: () => {
          openFocusPopup(agent.id, window.innerWidth / 2, 200);
          closeCommandBar();
        },
      });
    });

    // Focus boss terminal
    cmds.push({
      id: "focus-boss",
      label: t("attention.commandBar.focusBoss"),
      icon: Crown,
      action: () => {
        openFocusPopup("boss", window.innerWidth / 2, 200);
        closeCommandBar();
      },
    });

    // Utility commands
    cmds.push({
      id: "dismiss-all",
      label: t("attention.commandBar.dismissAll"),
      icon: BellOff,
      action: () => {
        clearAllToasts();
        closeCommandBar();
      },
    });

    cmds.push({
      id: "toggle-debug",
      label: t("attention.commandBar.toggleDebug"),
      icon: Bug,
      action: () => {
        setDebugMode(!useGameStore.getState().debugMode);
        closeCommandBar();
      },
    });

    cmds.push({
      id: "toggle-paths",
      label: t("attention.commandBar.togglePaths"),
      icon: Route,
      action: () => {
        toggleDebugOverlay("paths");
        closeCommandBar();
      },
    });

    cmds.push({
      id: "toggle-queue-slots",
      label: t("attention.commandBar.toggleQueueSlots"),
      icon: Hash,
      action: () => {
        toggleDebugOverlay("queueSlots");
        closeCommandBar();
      },
    });

    cmds.push({
      id: "toggle-phase-labels",
      label: t("attention.commandBar.togglePhaseLabels"),
      icon: Tag,
      action: () => {
        toggleDebugOverlay("phaseLabels");
        closeCommandBar();
      },
    });

    cmds.push({
      id: "toggle-obstacles",
      label: t("attention.commandBar.toggleObstacles"),
      icon: Construction,
      action: () => {
        toggleDebugOverlay("obstacles");
        closeCommandBar();
      },
    });

    return cmds;
  }, [
    agents,
    t,
    closeCommandBar,
    clearAllToasts,
    openFocusPopup,
    setDebugMode,
    toggleDebugOverlay,
  ]);

  // Filter commands
  const filtered = useMemo(() => {
    if (!filter) return commands;
    return commands.filter((c) => fuzzyMatch(filter, c.label));
  }, [commands, filter]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        closeCommandBar();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter" && filtered[selectedIndex]) {
        e.preventDefault();
        filtered[selectedIndex].action();
      }
    },
    [closeCommandBar, filtered, selectedIndex],
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh]"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeCommandBar();
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-scrim qo-fade-in pointer-events-none" />

      {/* Command palette */}
      <div className="qo-pop relative w-[min(560px,calc(100vw-24px))] bg-panel border border-line-strong rounded-xl3 shadow-[var(--qo-shadow-pop)] overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 pl-5 pr-3 h-14 border-b border-line">
          <Search size={18} className="text-ink-faint flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={filter}
            onChange={(e) => {
              setCommandFilter(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder={t("attention.commandBar.placeholder")}
            className="qo-bare-field flex-1 min-w-0 bg-transparent text-ink placeholder:text-ink-faint outline-none text-[15px] font-semibold"
          />
          <kbd className="qo-kbd !h-6 !text-[11px]">ESC</kbd>
        </div>

        {/* Command list */}
        <div className="max-h-72 overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-ink-faint text-[13.5px] font-bold">
              {t("attention.commandBar.noResults")}
            </div>
          ) : (
            filtered.map((cmd, i) => {
              const Icon = cmd.icon;
              return (
                <button
                  key={cmd.id}
                  onClick={cmd.action}
                  className={`w-full flex items-center gap-3 h-11 px-3 rounded-[12px] text-left text-[14px] font-bold transition-colors ${
                    i === selectedIndex
                      ? "bg-accent-dim text-accent"
                      : "text-ink hover:bg-panel-2"
                  }`}
                >
                  <Icon
                    size={17}
                    className={
                      i === selectedIndex ? "text-accent" : "text-ink-faint"
                    }
                    aria-hidden="true"
                  />
                  <span className="truncate">{cmd.label}</span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
