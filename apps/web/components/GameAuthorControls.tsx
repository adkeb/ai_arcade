"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, RotateCcw, Save } from "lucide-react";
import type { ApiResponse } from "@ai-arcade/shared";

type VersionSummary = {
  id: string;
  versionNumber: number;
  buildStatus: string;
  createdAt: string;
  storagePrefix: string;
};

type GameAuthorControlsProps = {
  gameId: string;
  title: string;
  description: string;
  tags: string[];
  currentVersionId: string | null;
  versions: VersionSummary[];
};

async function readApi<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as ApiResponse<T>;
  if (!payload.ok) throw new Error(payload.error.message);
  return payload.data;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

export function GameAuthorControls({
  gameId,
  title,
  description,
  tags,
  currentVersionId,
  versions,
}: GameAuthorControlsProps) {
  const router = useRouter();
  const [titleValue, setTitleValue] = useState(title);
  const [descriptionValue, setDescriptionValue] = useState(description);
  const [tagsValue, setTagsValue] = useState(tags.join(", "));
  const [pendingAction, setPendingAction] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function saveMeta() {
    setPendingAction("save");
    setError("");
    setMessage("");
    try {
      const nextTags = tagsValue
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
      await readApi(
        await fetch(`/api/games/${gameId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title: titleValue,
            description: descriptionValue,
            tags: nextTags,
          }),
        }),
      );
      setMessage("Game details saved.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Game update failed.");
    } finally {
      setPendingAction("");
    }
  }

  async function restoreVersion(versionId: string) {
    setPendingAction(versionId);
    setError("");
    setMessage("");
    try {
      await readApi(
        await fetch(`/api/games/${gameId}/versions/${versionId}/rollback`, {
          method: "POST",
        }),
      );
      setMessage("Version restored.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Version restore failed.");
    } finally {
      setPendingAction("");
    }
  }

  return (
    <section className="space-y-4 border-t border-slate-100 pt-4">
      <h2 className="text-lg font-black text-slate-950">Author controls</h2>
      <div className="space-y-3">
        <label className="block space-y-1">
          <span className="text-xs font-black uppercase text-slate-500">
            Title
          </span>
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-950 outline-none focus:border-teal-500"
            value={titleValue}
            onChange={(event) => setTitleValue(event.target.value)}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-black uppercase text-slate-500">
            Description
          </span>
          <textarea
            className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-950 outline-none focus:border-teal-500"
            value={descriptionValue}
            onChange={(event) => setDescriptionValue(event.target.value)}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-black uppercase text-slate-500">
            Tags
          </span>
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-950 outline-none focus:border-teal-500"
            value={tagsValue}
            onChange={(event) => setTagsValue(event.target.value)}
          />
        </label>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-3 py-2 text-sm font-black text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          disabled={Boolean(pendingAction)}
          onClick={saveMeta}
        >
          {pendingAction === "save" ? (
            <Loader2 className="animate-spin" size={16} aria-hidden="true" />
          ) : (
            <Save size={16} aria-hidden="true" />
          )}
          Save
        </button>
      </div>

      <div className="space-y-2 border-t border-slate-100 pt-4">
        <h3 className="text-sm font-black uppercase text-slate-500">
          Version rollback
        </h3>
        {versions.map((version) => {
          const isCurrent = version.id === currentVersionId;
          const isPending = pendingAction === version.id;
          return (
            <article
              key={version.id}
              className="rounded-lg border border-slate-200 bg-slate-50 p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-black text-slate-900">
                    v{version.versionNumber}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatDate(version.createdAt)}
                  </p>
                </div>
                <span className="rounded-md bg-white px-2 py-1 text-xs font-bold text-slate-600">
                  {isCurrent ? "current" : version.buildStatus}
                </span>
              </div>
              <p className="mt-2 break-all font-mono text-[11px] leading-4 text-slate-600">
                {version.storagePrefix}
              </p>
              <button
                type="button"
                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-800 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400"
                disabled={
                  Boolean(pendingAction) ||
                  isCurrent ||
                  version.buildStatus !== "succeeded"
                }
                onClick={() => restoreVersion(version.id)}
              >
                {isPending ? (
                  <Loader2
                    className="animate-spin"
                    size={14}
                    aria-hidden="true"
                  />
                ) : (
                  <RotateCcw size={14} aria-hidden="true" />
                )}
                Restore
              </button>
            </article>
          );
        })}
      </div>
      {message ? (
        <p className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-bold text-teal-800">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
          {error}
        </p>
      ) : null}
    </section>
  );
}
