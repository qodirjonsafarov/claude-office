/**
 * ConversationHistory - Chat-style view of user prompts, Claude responses,
 * thinking blocks, and tool calls.
 */

"use client";

import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useGameStore, selectConversation } from "@/stores/gameStore";
import { format } from "date-fns";
import {
  BookOpen,
  Bot,
  Brain,
  ChevronDown,
  ChevronRight,
  Globe,
  ListChecks,
  Maximize2,
  MessageSquare,
  NotebookPen,
  PenLine,
  Search,
  SquareTerminal,
  UserRound,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import type { ConversationEntry } from "@/types";
import { useTranslation } from "@/hooks/useTranslation";
import { PromptComposer } from "@/components/layout/PromptComposer";
import { EmptyState } from "@/components/ui/EmptyState";

// Tool icon mapping: lucide signs, quiet beside the tool's name
const TOOL_ICONS: Record<string, LucideIcon> = {
  Read: BookOpen,
  Write: PenLine,
  Edit: PenLine,
  Bash: SquareTerminal,
  Glob: Search,
  Grep: Search,
  Task: UserRound,
  WebFetch: Globe,
  WebSearch: Globe,
  TodoWrite: ListChecks,
  TodoRead: ListChecks,
  NotebookEdit: NotebookPen,
  Agent: Bot,
};

function ThinkingEntry({ entry }: { entry: ConversationEntry }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const isLong = entry.text.length > 200;
  const preview = isLong ? entry.text.slice(0, 200) + "…" : entry.text;

  return (
    <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl2 border border-dashed border-line-strong">
      <Brain
        size={14}
        className="text-ink-faint flex-shrink-0 mt-0.5"
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <div className="qo-label mb-1">{t("conversation.thinking")}</div>
        <p className="m-0 text-ink-soft text-[12.5px] leading-relaxed whitespace-pre-wrap break-words">
          {expanded ? entry.text : preview}
        </p>
        {isLong && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 mt-1.5 text-[12px] font-extrabold text-ink-faint hover:text-ink transition-colors"
          >
            {expanded ? (
              <>
                <ChevronDown size={13} /> {t("conversation.collapse")}
              </>
            ) : (
              <>
                <ChevronRight size={13} /> {t("conversation.showMore")}
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function ToolEntry({ entry }: { entry: ConversationEntry }) {
  const Icon = (entry.toolName && TOOL_ICONS[entry.toolName]) || Wrench;
  return (
    <div className="flex items-center gap-2 h-8 px-2.5 rounded-[10px] bg-panel-2 min-w-0">
      <Icon
        size={13}
        className="text-ink-faint flex-shrink-0"
        aria-hidden="true"
      />
      <span className="text-[12px] font-extrabold text-ink-soft flex-shrink-0">
        {entry.toolName}
      </span>
      <span className="text-ink-faint text-[12px] font-mono truncate">
        {entry.text}
      </span>
    </div>
  );
}

function UserEntry({ entry }: { entry: ConversationEntry }) {
  return (
    <div className="flex flex-col items-end">
      <div className="max-w-[85%]">
        <div className="bg-accent-dim rounded-xl2 rounded-tr-[6px] px-3.5 py-2.5">
          <p className="m-0 text-ink text-[13px] font-semibold whitespace-pre-wrap break-words leading-relaxed">
            {entry.text}
          </p>
        </div>
        <div className="text-ink-faint text-[11px] font-semibold mt-1 text-right tabular-nums">
          {format(new Date(entry.timestamp), "HH:mm:ss")}
        </div>
      </div>
    </div>
  );
}

function MarkdownContent({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => (
          <p className="m-0 text-ink text-[13px] leading-relaxed mb-2 last:mb-0 break-words">
            {children}
          </p>
        ),
        h1: ({ children }) => (
          <h1 className="text-ink text-[15px] font-extrabold mt-3 mb-1.5">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-ink text-[14px] font-extrabold mt-3 mb-1">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-ink text-[13px] font-extrabold mt-2 mb-1">
            {children}
          </h3>
        ),
        strong: ({ children }) => (
          <strong className="text-ink font-extrabold">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="text-ink-soft italic">{children}</em>
        ),
        code: ({ children, className }) => {
          const isBlock = className?.startsWith("language-");
          return isBlock ? (
            <code className="block bg-panel rounded-[10px] px-3 py-2 text-[12px] font-mono text-ink overflow-x-auto whitespace-pre my-1.5">
              {children}
            </code>
          ) : (
            <code className="bg-panel-3 rounded-[6px] px-1 py-0.5 text-[12px] font-mono text-ink">
              {children}
            </code>
          );
        },
        pre: ({ children }) => (
          <pre className="my-1 overflow-x-auto">{children}</pre>
        ),
        ul: ({ children }) => (
          <ul className="list-disc pl-5 text-[13px] text-ink space-y-0.5 my-1.5">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal pl-5 text-[13px] text-ink space-y-0.5 my-1.5">
            {children}
          </ol>
        ),
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-line-strong pl-3 my-1.5 text-ink-soft">
            {children}
          </blockquote>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent font-bold underline underline-offset-2"
          >
            {children}
          </a>
        ),
        hr: () => <hr className="border-line my-3" />,
      }}
    >
      {text}
    </ReactMarkdown>
  );
}

function AssistantEntry({ entry }: { entry: ConversationEntry }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const isLong = entry.text.length > 600;
  const preview = isLong ? entry.text.slice(0, 600) + "…" : entry.text;

  return (
    <div className="flex flex-col items-start max-w-[92%] w-full">
      <div className="flex items-center gap-2 mb-1 min-w-0">
        <span className="qo-label">{t("conversation.claude")}</span>
        {entry.agentId && entry.agentId !== "main" && (
          <span className="qo-badge qo-badge-info !h-5 !px-2 !text-[11px] font-mono truncate">
            @{entry.agentId.slice(0, 12)}
          </span>
        )}
      </div>
      <div className="bg-panel-2 rounded-xl2 rounded-tl-[6px] px-3.5 py-2.5 w-full">
        <MarkdownContent text={expanded ? entry.text : preview} />
        {isLong && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 mt-2 text-[12px] font-extrabold text-ink-faint hover:text-ink transition-colors"
          >
            {expanded ? (
              <>
                <ChevronDown size={13} /> {t("conversation.collapse")}
              </>
            ) : (
              <>
                <ChevronRight size={13} /> {t("conversation.showFullResponse")}
              </>
            )}
          </button>
        )}
      </div>
      <div className="text-ink-faint text-[11px] font-semibold mt-1 tabular-nums">
        {format(new Date(entry.timestamp), "HH:mm:ss")}
      </div>
    </div>
  );
}

function ConversationEntries({
  visible,
  bottomRef,
}: {
  visible: ConversationEntry[];
  bottomRef?: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <>
      {visible.map((entry) => {
        switch (entry.role) {
          case "user":
            return <UserEntry key={entry.id} entry={entry} />;
          case "assistant":
            return <AssistantEntry key={entry.id} entry={entry} />;
          case "thinking":
            return <ThinkingEntry key={entry.id} entry={entry} />;
          case "tool":
            return <ToolEntry key={entry.id} entry={entry} />;
          default:
            return null;
        }
      })}
      {bottomRef && <div ref={bottomRef} />}
    </>
  );
}

export function ConversationHistory() {
  const { t } = useTranslation();
  const conversation = useGameStore(selectConversation);
  const bottomRef = useRef<HTMLDivElement>(null);
  const modalBottomRef = useRef<HTMLDivElement>(null);
  const [showTools, setShowTools] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const toolCount = conversation.filter((e) => e.role === "tool").length;
  const messageCount = conversation.filter(
    (e) => e.role === "user" || e.role === "assistant",
  ).length;
  const visible = showTools
    ? conversation
    : conversation.filter((e) => e.role !== "tool");

  // Auto-scroll to bottom on new entries
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visible.length]);

  useEffect(() => {
    if (expanded) {
      modalBottomRef.current?.scrollIntoView({ behavior: "instant" });
    }
  }, [expanded, visible.length]);

  // Close on Escape
  useEffect(() => {
    if (!expanded) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [expanded]);

  // The panel's tools: the count, the tool calls on/off, a larger view.
  const tools = (onExpand?: () => void) => (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => setShowTools(!showTools)}
        className="qo-chip"
        aria-pressed={showTools}
        title={
          showTools
            ? t("conversation.hideToolCalls")
            : t("conversation.showToolCalls")
        }
      >
        <Wrench size={13} aria-hidden="true" />
        {toolCount}
      </button>
      {onExpand ? (
        <button
          onClick={onExpand}
          className="qo-icon-btn-sm"
          title={t("conversation.expandConversation")}
          aria-label={t("conversation.expandConversation")}
        >
          <Maximize2 size={16} />
        </button>
      ) : (
        <button
          onClick={() => setExpanded(false)}
          className="qo-icon-btn"
          title={t("conversation.close")}
          aria-label={t("conversation.close")}
        >
          <X size={20} />
        </button>
      )}
    </div>
  );

  const count = (
    <span className="qo-label">
      <MessageSquare size={13} strokeWidth={2.4} aria-hidden="true" />
      <span className="tabular-nums">
        {t("conversation.msgs", { count: messageCount })}
      </span>
    </span>
  );

  const empty = (
    <EmptyState
      icon={MessageSquare}
      title={t("conversation.noConversation")}
      className="my-auto"
    />
  );

  return (
    <>
      {/* Inline panel */}
      <div className="flex flex-col h-full min-h-0 overflow-hidden">
        <div className="flex items-center justify-between gap-2 pl-4 pr-2 pt-1 pb-1 flex-shrink-0">
          {count}
          {tools(() => setExpanded(true))}
        </div>
        <div className="flex-grow min-h-0 overflow-y-auto overscroll-contain px-3 pt-1 pb-3 flex flex-col gap-2.5">
          {conversation.length === 0 ? (
            empty
          ) : (
            <ConversationEntries visible={visible} bottomRef={bottomRef} />
          )}
        </div>
        <PromptComposer />
      </div>

      {/* Expanded modal */}
      {expanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-scrim qo-fade-in"
          onClick={() => setExpanded(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("conversation.title")}
            className="qo-pop flex flex-col bg-panel border border-line rounded-xl3 shadow-[var(--qo-shadow-pop)] overflow-hidden"
            style={{ width: "min(900px, 90vw)", height: "85vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 pl-6 pr-3 pt-3 pb-2 flex-shrink-0">
              <div className="flex items-baseline gap-3 min-w-0">
                <h2 className="m-0 text-[18px] font-extrabold text-ink tracking-tight">
                  {t("conversation.title")}
                </h2>
                <span className="text-[13px] font-bold text-ink-faint tabular-nums">
                  {t("conversation.msgs", { count: messageCount })}
                </span>
              </div>
              {tools()}
            </div>
            <div className="flex-grow min-h-0 overflow-y-auto overscroll-contain px-6 pt-2 pb-4 flex flex-col gap-3">
              {conversation.length === 0 ? (
                empty
              ) : (
                <ConversationEntries
                  visible={visible}
                  bottomRef={modalBottomRef}
                />
              )}
            </div>
            <PromptComposer />
          </div>
        </div>
      )}
    </>
  );
}
