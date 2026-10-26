/**
 * PromptComposer - type a message for the running Claude Code session.
 *
 * The backend pastes it into the session's tmux pane; the reply arrives in
 * the conversation through the normal hook events. Shown only when the
 * backend says the session can take a message (`state.chat`); otherwise a
 * muted hint says why. The first send in a session asks for confirmation.
 */

"use client";

import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  Loader2,
  SendHorizontal,
  TerminalSquare,
} from "lucide-react";
import { useChatStore } from "@/stores/chatStore";
import { useGameStore, selectSessionId } from "@/stores/gameStore";
import { sendPrompt } from "@/utils/api";

const MAX_CHARS = 8000;
const SENT_FEEDBACK_MS = 3000;
const PREVIEW_CHARS = 280;

/** Why the session cannot take a message (backend ChatStatus.reason). */
const HINTS: Record<string, string> = {
  disabled: "Chat is off — enable it in the office settings (backend .env)",
  no_key: "Chat needs an explicit CLAUDE_OFFICE_API_KEY on the backend",
  no_tmux:
    "Not in tmux — start Claude inside tmux (Termius does this) to chat from here",
  inactive: "This session has ended",
  pane_gone: "The tmux pane of this session is gone",
  not_claude: "The tmux pane is not running Claude",
  pane_reused: "Another Claude session now runs in this tmux pane",
  checking: "Checking the terminal…",
  terminal_busy: "Claude is busy with a dialog — answer it in the terminal",
};

/** Exact settings behind a hint, shown as a tooltip (the docs have the rest). */
const HINT_DETAILS: Record<string, string> = {
  disabled:
    "Set ENABLE_WEB_PROMPT=true in backend/.env and restart the backend (docs/guides/deployment.md, Web chat)",
  no_key: "Set CLAUDE_OFFICE_API_KEY in backend/.env",
};

function Hint({ text, detail }: { text: string; detail?: string }) {
  return (
    <div
      title={detail}
      className="flex-shrink-0 mx-3 mb-3 px-3 py-2.5 rounded-xl2 bg-panel-2 flex items-start gap-2 text-ink-faint text-[12px] font-semibold leading-snug"
    >
      <TerminalSquare size={14} className="flex-shrink-0 mt-px" aria-hidden />
      <span>{text}</span>
    </div>
  );
}

type Feedback = { kind: "ok" | "error"; message: string } | null;

export function PromptComposer() {
  const sessionId = useGameStore(selectSessionId);
  // Keyed by session: a new session starts clean (no pending confirm, no
  // old feedback or draft).
  return <Composer key={sessionId} sessionId={sessionId} />;
}

function Composer({ sessionId }: { sessionId: string }) {
  const stored = useChatStore((s) => s.status);
  const statusSession = useChatStore((s) => s.sessionId);
  const confirmed = useChatStore((s) => s.confirmed);
  const confirmSession = useChatStore((s) => s.confirmSession);
  // A status left over from the previous session never applies here.
  const status = statusSession === sessionId ? stored : null;

  const [text, setText] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    if (feedback?.kind !== "ok") return;
    const id = setTimeout(() => setFeedback(null), SENT_FEEDBACK_MS);
    return () => clearTimeout(id);
  }, [feedback]);

  if (!status) return null;
  const waitingPermission = status.reason === "permission_pending";
  if (!status.canSend && !waitingPermission) {
    return (
      <Hint
        text={
          HINTS[status.reason ?? ""] ?? "Chat is unavailable for this session"
        }
        detail={HINT_DETAILS[status.reason ?? ""]}
      />
    );
  }

  const message = text.trim();
  const tooLong = text.length > MAX_CHARS;
  const canSubmit = !!status.canSend && !sending && !!message && !tooLong;

  const deliver = async () => {
    setConfirming(false);
    setSending(true);
    setFeedback(null);
    const result = await sendPrompt(sessionId, message);
    setSending(false);
    if (result.ok) {
      setText("");
      setFeedback({ kind: "ok", message: "Sent — Claude will reply here" });
    } else {
      setFeedback({ kind: "error", message: result.message });
    }
  };

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!canSubmit) return;
    if (!confirmed.includes(sessionId)) {
      setConfirming(true);
      return;
    }
    void deliver();
  };

  const confirmAndSend = () => {
    confirmSession(sessionId);
    void deliver();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Desktop: Enter sends, Shift+Enter is a new line. Phones keep Enter
    // for new lines and send with the button.
    const phone = document.documentElement.dataset.layout !== "desktop";
    if (
      e.key === "Enter" &&
      !e.shiftKey &&
      !e.nativeEvent.isComposing &&
      !phone
    ) {
      e.preventDefault();
      submit();
    }
  };

  const preview =
    message.length > PREVIEW_CHARS
      ? `${message.slice(0, PREVIEW_CHARS)}…`
      : message;

  return (
    <div className="flex-shrink-0 border-t border-line p-3 flex flex-col gap-2">
      {confirming && (
        <div
          role="alertdialog"
          aria-labelledby="qo-chat-confirm-title"
          className="qo-pop rounded-xl2 bg-panel-2 p-3.5 flex flex-col gap-2"
        >
          <p
            id="qo-chat-confirm-title"
            className="m-0 text-[13px] font-extrabold text-ink"
          >
            Send this to the terminal?
          </p>
          <p className="m-0 text-[11.5px] text-ink-soft">
            {status.label ?? "Session"} · {sessionId.slice(0, 8)}
          </p>
          <p className="m-0 max-h-24 overflow-y-auto rounded-[12px] bg-panel px-3 py-2 text-[12.5px] text-ink whitespace-pre-wrap break-words">
            {preview}
          </p>
          <p className="m-0 text-[11px] text-ink-faint">
            It is typed into Claude&apos;s tmux pane as if you typed it there.
            With bypassPermissions or auto mode on, a message can run commands
            on this machine.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="qo-btn qo-btn-lg qo-btn-ghost"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmAndSend}
              className="qo-btn qo-btn-lg qo-btn-primary"
            >
              Send to terminal
            </button>
          </div>
        </div>
      )}

      <form onSubmit={submit} className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (feedback?.kind === "error") setFeedback(null);
          }}
          onKeyDown={onKeyDown}
          disabled={waitingPermission || sending}
          rows={2}
          placeholder={
            waitingPermission ? "Waiting for permission…" : "Message Claude…"
          }
          aria-label="Message Claude"
          className="qo-input flex-1 min-w-0 !h-auto min-h-[44px] max-h-40 py-2.5 resize-none leading-snug text-[13.5px] disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!canSubmit}
          aria-label="Send"
          className="qo-btn qo-btn-lg qo-btn-primary !w-11 !px-0 flex-shrink-0 disabled:opacity-40"
        >
          {sending ? (
            <Loader2 size={18} className="animate-spin" aria-hidden />
          ) : (
            <SendHorizontal size={18} aria-hidden />
          )}
        </button>
      </form>

      {waitingPermission && (
        <p className="m-0 px-1 text-[11.5px] text-max">
          Answer the permission request in the terminal first.
        </p>
      )}
      {tooLong && (
        <p className="m-0 px-1 text-[11.5px] text-danger">
          {text.length}/{MAX_CHARS} characters — too long to send.
        </p>
      )}
      {feedback?.kind === "ok" && (
        <p
          role="status"
          className="m-0 px-1 flex items-center gap-1.5 text-[11.5px] text-accent"
        >
          <Check size={13} aria-hidden /> {feedback.message}
        </p>
      )}
      {feedback?.kind === "error" && (
        <p
          role="alert"
          className="m-0 px-1 flex items-center gap-1.5 text-[11.5px] text-danger"
        >
          <AlertCircle size={13} aria-hidden /> {feedback.message}
        </p>
      )}
    </div>
  );
}
