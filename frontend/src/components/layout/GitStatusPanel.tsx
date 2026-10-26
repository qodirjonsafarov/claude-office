/**
 * GitStatusPanel - Git status panel
 *
 * Displays git branch and file status from the unified Zustand store.
 */

"use client";

import { useGameStore, selectGitStatus } from "@/stores/gameStore";
import { useTranslation } from "@/hooks/useTranslation";
import {
  GitBranch,
  GitCommit,
  FileEdit,
  ArrowUp,
  ArrowDown,
  FilePlus,
  FileX,
  FilePen,
  FileQuestion,
} from "lucide-react";
import { FileStatus } from "@/types";
import { EmptyState } from "@/components/ui/EmptyState";
import { useCallback } from "react";

// Check if sessionId represents a real session (not the placeholder)
const isRealSession = (sessionId: string) => sessionId !== "None";

const getStatusIcon = (status: FileStatus) => {
  switch (status) {
    case "M":
      return <FilePen size={14} />;
    case "A":
      return <FilePlus size={14} />;
    case "D":
      return <FileX size={14} />;
    case "?":
      return <FileQuestion size={14} />;
    default:
      return <FileEdit size={14} />;
  }
};

export function GitStatusPanel() {
  const { t } = useTranslation();

  const getStatusLabel = useCallback(
    (status: FileStatus) => {
      switch (status) {
        case "M":
          return t("git.modified");
        case "A":
          return t("git.added");
        case "D":
          return t("git.deleted");
        case "R":
          return t("git.renamed");
        case "C":
          return t("git.copied");
        case "?":
          return t("git.untracked");
        case "!":
          return t("git.ignored");
        default:
          return status;
      }
    },
    [t],
  );
  const gitStatus = useGameStore(selectGitStatus);
  const sessionId = useGameStore((state) => state.sessionId);
  const isConnected = useGameStore((state) => state.isConnected);
  const hasSession = isRealSession(sessionId);

  if (!gitStatus) {
    const message = !hasSession
      ? t("git.noSession")
      : isConnected
        ? t("git.noRepo")
        : t("git.waitingForStatus");
    return (
      <div className="flex flex-col h-full min-h-0">
        <div className="qo-panel-head">
          <h2 className="qo-title">{t("git.title")}</h2>
        </div>
        <div className="flex-grow flex items-center justify-center px-3 pb-2">
          <EmptyState icon={GitBranch} title={message} className="!py-4" />
        </div>
      </div>
    );
  }

  const changedFiles = gitStatus.changed_files ?? [];
  const commits = gitStatus.commits ?? [];
  const stagedCount = changedFiles.filter((f) => f.staged).length;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header: the title, the branch, how far it is from its remote */}
      <div className="qo-panel-head !pr-4">
        <h2 className="qo-title flex-shrink-0">{t("git.title")}</h2>
        <span
          className="qo-badge qo-badge-accent min-w-0 !flex-shrink !gap-1.5"
          title={gitStatus.branch}
        >
          <GitBranch size={13} strokeWidth={2.4} className="flex-shrink-0" />
          <span className="truncate">{gitStatus.branch}</span>
        </span>
        <div className="ml-auto flex items-center gap-2 text-[12px] font-extrabold tabular-nums">
          {(gitStatus.ahead ?? 0) > 0 && (
            <span className="flex items-center gap-0.5 text-accent">
              <ArrowUp size={13} strokeWidth={2.4} />
              {gitStatus.ahead}
            </span>
          )}
          {(gitStatus.behind ?? 0) > 0 && (
            <span className="flex items-center gap-0.5 text-warn">
              <ArrowDown size={13} strokeWidth={2.4} />
              {gitStatus.behind}
            </span>
          )}
        </div>
      </div>

      <div className="flex-grow min-h-0 overflow-y-auto overscroll-contain px-2 pb-2">
        {/* Changed files: one line each, staged in lime, the rest in gold */}
        {changedFiles.length > 0 && (
          <div className="mb-3">
            <div className="qo-label px-2 pt-1 pb-1.5">
              {t("git.changedFiles")}
              <span className="text-ink-faint tracking-normal">
                {changedFiles.length}
              </span>
              {stagedCount > 0 && (
                <span className="ml-auto normal-case tracking-normal text-accent">
                  {stagedCount} {t("git.staged")}
                </span>
              )}
            </div>
            <ul className="m-0 p-0 list-none max-h-40 overflow-y-auto">
              {changedFiles.map((file) => {
                const normalizedPath = file.path.replace(/[\\/]+$/, "");
                const parts = normalizedPath.split(/[\\/]/);
                const filename = parts.pop() || normalizedPath || file.path;
                const folder = parts.join("/");
                return (
                  <li
                    key={file.path}
                    className="flex items-center gap-2 h-8 px-2 rounded-[10px] hover:bg-panel-2 transition-colors min-w-0"
                    title={`${getStatusLabel(file.status)}: ${file.path}${file.staged ? ` (${t("git.staged")})` : ""}`}
                  >
                    <span
                      className={`flex-shrink-0 ${file.staged ? "text-accent" : "text-warn"}`}
                    >
                      {getStatusIcon(file.status)}
                    </span>
                    <span className="text-[12.5px] font-bold text-ink truncate flex-shrink min-w-0">
                      {filename}
                    </span>
                    {folder && (
                      <span className="text-[11.5px] font-semibold text-ink-faint truncate min-w-0 flex-1">
                        {folder}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Recent commits */}
        <div className="qo-label px-2 pt-1 pb-1.5">
          {t("git.recentCommits")}
          <span className="text-ink-faint tracking-normal">
            {commits.length}
          </span>
        </div>
        {commits.length === 0 ? (
          <EmptyState icon={GitCommit} title={t("git.noCommits")} />
        ) : (
          <ul className="m-0 p-0 list-none flex flex-col">
            {commits.map((commit) => (
              <li
                key={commit.hash}
                className="px-2 py-2 rounded-[12px] hover:bg-panel-2 transition-colors"
              >
                <div className="text-[13px] font-bold text-ink leading-snug line-clamp-2">
                  {commit.message}
                </div>
                <div className="mt-1 flex items-center gap-1.5 min-w-0 text-[11.5px] font-semibold text-ink-faint">
                  <span className="font-mono text-ink-soft flex-shrink-0">
                    {commit.hash}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="truncate min-w-0">{commit.author}</span>
                  <span className="ml-auto flex-shrink-0">
                    {commit.relative_time}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
