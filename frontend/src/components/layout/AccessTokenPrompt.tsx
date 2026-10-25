"use client";

import { useState, useSyncExternalStore } from "react";
import { KeyRound, X } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import {
  extractToken,
  isAuthRequired,
  saveApiKey,
  subscribeAuthRequired,
} from "@/utils/api";

interface AccessTokenPromptProps {
  /** Called after a key was saved, to retry what failed. */
  onSaved: () => void;
}

/**
 * A small card that appears when the backend answers 401: the browser has no
 * (or a stale) access token. The user pastes the key or the whole ?token=
 * launch URL from the server console; it is saved for later tabs.
 */
export function AccessTokenPrompt({
  onSaved,
}: AccessTokenPromptProps): React.ReactNode {
  const { t } = useTranslation();
  const required = useSyncExternalStore(
    subscribeAuthRequired,
    isAuthRequired,
    () => false,
  );
  const [value, setValue] = useState("");
  const [hidden, setHidden] = useState(false);

  if (!required || hidden) return null;

  const token = extractToken(value);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    saveApiKey(token);
    setValue("");
    onSaved();
  };

  return (
    <form
      onSubmit={submit}
      role="alertdialog"
      aria-labelledby="qo-token-title"
      className="qo-card qo-pop fixed left-1/2 -translate-x-1/2 top-[max(16px,env(safe-area-inset-top))] z-[60] w-[min(420px,calc(100vw-24px))] p-4 flex flex-col gap-3 shadow-[0_8px_24px_var(--qo-float-shade)]"
    >
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 rounded-xl2 bg-warn-dim text-warn flex items-center justify-center flex-shrink-0">
          <KeyRound size={18} strokeWidth={2.2} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p
            id="qo-token-title"
            className="m-0 text-[14.5px] font-extrabold text-ink"
          >
            {t("auth.title")}
          </p>
          <p className="m-0 mt-0.5 text-[12.5px] font-semibold text-ink-soft">
            {t("auth.hint")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setHidden(true)}
          className="qo-icon-btn !w-9 !h-9 -mt-1 -mr-1"
          aria-label={t("modal.close")}
        >
          <X size={16} strokeWidth={2.2} />
        </button>
      </div>
      <div className="flex gap-2">
        <input
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t("auth.placeholder")}
          aria-label={t("auth.placeholder")}
          className="qo-input flex-1 min-w-0"
        />
        <button
          type="submit"
          disabled={!token}
          className="qo-btn qo-btn-lg qo-btn-primary disabled:opacity-50"
        >
          {t("auth.connect")}
        </button>
      </div>
    </form>
  );
}
