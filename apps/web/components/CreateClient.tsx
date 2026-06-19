"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Coins, ExternalLink, FileUp, History, Loader2, Play, RefreshCw, Repeat2, Rocket, Send, UploadCloud } from "lucide-react";
import type { ApiResponse } from "@ai-arcade/shared";
import { truncateMiddle } from "@/lib/format";

type UploadedAsset = {
  assetId: string;
  objectKey: string;
  url: string;
  originalName: string;
  mimeType: string;
  size: number;
};

type JobState = {
  jobId: string;
  status: "pending" | "running" | "succeeded" | "failed";
  progress: number;
  currentStep: string | null;
  errorMessage: string | null;
  gameId: string | null;
  manifestUrl: string | null;
  artifactBaseUrl: string | null;
  costEstimated: number | null;
  createdAt?: string;
  updatedAt?: string;
  finishedAt?: string | null;
};

type AgentLog = {
  id: string;
  agentName: string;
  step: string;
  status: "running" | "succeeded" | "failed";
  inputSummary: string;
  outputSummary: string | null;
  errorMessage: string | null;
  createdAt: string;
};

type JobHistoryAsset = {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  publicUrl: string;
};

type JobHistoryItem = {
  id: string;
  prompt: string;
  status: JobState["status"];
  progress: number;
  currentStep: string | null;
  errorMessage: string | null;
  gameId: string | null;
  costEstimated: number | null;
  createdAt: string;
  finishedAt: string | null;
  assets: JobHistoryAsset[];
};

type CreateClientProps = {
  initialJobs?: JobHistoryItem[];
};

const starterPrompt =
  "做一个赛博朋克风格的躲避小游戏，玩家控制一艘飞船躲避陨石，收集能量，30 秒内得分越高越好。";

async function readApi<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as ApiResponse<T>;
  if (!payload.ok) throw new Error(payload.error.message);
  return payload.data;
}

function formatCost(value: number | null | undefined) {
  if (typeof value !== "number") return "Pending";
  return `$${value.toFixed(4)}`;
}

export function CreateClient({ initialJobs = [] }: CreateClientProps) {
  const [prompt, setPrompt] = useState(starterPrompt);
  const [files, setFiles] = useState<File[]>([]);
  const [assets, setAssets] = useState<UploadedAsset[]>([]);
  const [job, setJob] = useState<JobState | null>(null);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [history, setHistory] = useState<JobHistoryItem[]>(initialJobs);
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const canPoll = job?.jobId && (job.status === "pending" || job.status === "running");
  const progressLabel = useMemo(() => `${job?.progress ?? 0}%`, [job?.progress]);

  async function uploadSelectedFiles(): Promise<UploadedAsset[]> {
    if (files.length === 0 && assets.length === 0) {
      throw new Error("Please upload at least one image, video, PDF, JSON, or text asset before generating.");
    }
    if (files.length === 0) return assets;

    const uploaded: UploadedAsset[] = [];
    for (const file of files) {
      const formData = new FormData();
      formData.append("file", file);
      const result = await readApi<UploadedAsset>(
        await fetch("/api/assets/upload", {
          method: "POST",
          body: formData
        })
      );
      uploaded.push(result);
    }
    const merged = [...assets, ...uploaded];
    setAssets(merged);
    setFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    return merged;
  }

  async function createJob(assetList: UploadedAsset[]) {
    const result = await readApi<{ jobId: string; status: JobState["status"]; currentStep: string | null }>(
      await fetch("/api/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt,
          assetIds: assetList.map((asset) => asset.assetId)
        })
      })
    );
    setPublished(false);
    setLogs([]);
    setHistory((items) =>
      [
        {
          id: result.jobId,
          prompt,
          status: result.status,
          progress: 0,
          currentStep: result.currentStep,
          errorMessage: null,
          gameId: null,
          costEstimated: null,
          createdAt: new Date().toISOString(),
          finishedAt: null,
          assets: assetList.map((asset) => ({
            id: asset.assetId,
            originalName: asset.originalName,
            mimeType: asset.mimeType,
            size: asset.size,
            publicUrl: asset.url
          }))
        },
        ...items.filter((item) => item.id !== result.jobId)
      ].slice(0, 8)
    );
    setJob({
      jobId: result.jobId,
      status: result.status,
      currentStep: result.currentStep,
      progress: 0,
      errorMessage: null,
      gameId: null,
      manifestUrl: null,
      artifactBaseUrl: null,
      costEstimated: null
    });
  }

  async function handleGenerate() {
    setLoading(true);
    setError("");
    try {
      const assetList = await uploadSelectedFiles();
      await createJob(assetList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation request failed.");
    } finally {
      setLoading(false);
    }
  }

  async function retry() {
    setError("");
    setLoading(true);
    try {
      await createJob(assets);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retry failed.");
    } finally {
      setLoading(false);
    }
  }

  async function publish() {
    if (!job?.gameId) return;
    setPublishing(true);
    setError("");
    try {
      await readApi<{ game: unknown }>(
        await fetch(`/api/games/${job.gameId}/publish`, {
          method: "POST"
        })
      );
      setPublished(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed.");
    } finally {
      setPublishing(false);
    }
  }

  function remix(item: JobHistoryItem) {
    setPrompt(item.prompt);
    setFiles([]);
    setAssets(
      item.assets.map((asset) => ({
        assetId: asset.id,
        objectKey: "",
        url: asset.publicUrl,
        originalName: asset.originalName,
        mimeType: asset.mimeType,
        size: asset.size
      }))
    );
    setJob(null);
    setLogs([]);
    setPublished(false);
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  useEffect(() => {
    if (!job) return;
    setHistory((items) =>
      items.map((item) =>
        item.id === job.jobId
          ? {
              ...item,
              status: job.status,
              progress: job.progress,
              currentStep: job.currentStep,
              errorMessage: job.errorMessage,
              gameId: job.gameId,
              costEstimated: job.costEstimated,
              finishedAt: job.finishedAt ?? item.finishedAt
            }
          : item
      )
    );
  }, [job]);

  useEffect(() => {
    if (!canPoll || !job?.jobId) return undefined;
    const timer = window.setInterval(async () => {
      try {
        const [jobData, logData] = await Promise.all([
          readApi<JobState>(await fetch(`/api/jobs/${job.jobId}`)),
          readApi<{ logs: AgentLog[] }>(await fetch(`/api/jobs/${job.jobId}/logs`))
        ]);
        setJob(jobData);
        setLogs(logData.logs);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Polling failed.");
      }
    }, 1400);
    return () => window.clearInterval(timer);
  }, [canPoll, job?.jobId]);

  useEffect(() => {
    const activeJobId = job?.jobId;
    if (!activeJobId) return;
    async function refreshOnce() {
      const [jobData, logData] = await Promise.all([
        readApi<JobState>(await fetch(`/api/jobs/${activeJobId}`)),
        readApi<{ logs: AgentLog[] }>(await fetch(`/api/jobs/${activeJobId}/logs`))
      ]);
      setJob(jobData);
      setLogs(logData.logs);
    }
    refreshOnce().catch(() => undefined);
  }, [job?.jobId]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)]">
      <div className="space-y-5">
        <section className="space-y-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-teal-700">Create</p>
            <h1 className="mt-1 text-3xl font-black text-slate-950">Generate a playable HTML5 game</h1>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-bold text-slate-700">Creative prompt</span>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              className="focus-ring min-h-44 w-full resize-y rounded-lg border border-slate-300 px-3 py-3 leading-6"
            />
          </label>

        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 font-bold text-slate-900">
                <UploadCloud size={18} aria-hidden="true" />
                Multimodal asset
              </p>
              <p className="mt-1 text-sm text-slate-600">Images, videos, PDFs, JSON, and text files up to the configured limit.</p>
            </div>
            <button
              type="button"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800 hover:bg-slate-100"
              onClick={() => fileInputRef.current?.click()}
            >
              Select files
            </button>
          </div>
          <input
            ref={fileInputRef}
            hidden
            multiple
            type="file"
            accept="image/*,video/*,.txt,.md,.json,.pdf"
            onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
          />
          <div className="mt-3 space-y-2">
            {files.map((file) => (
              <div key={`${file.name}-${file.size}`} className="flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm text-slate-700">
                <FileUp size={15} aria-hidden="true" />
                <span className="truncate">{file.name}</span>
                <span className="ml-auto text-xs text-slate-500">{Math.ceil(file.size / 1024)} KB</span>
              </div>
            ))}
            {assets.map((asset) => (
              <a
                key={asset.assetId}
                className="flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
                href={asset.url}
                target="_blank"
                rel="noreferrer"
              >
                <FileUp size={15} aria-hidden="true" />
                <span className="truncate">{asset.originalName}</span>
                <ExternalLink className="ml-auto" size={14} aria-hidden="true" />
              </a>
            ))}
          </div>
        </div>

        {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p> : null}

        <div className="flex flex-wrap gap-3">
          <button
            disabled={loading}
            type="button"
            onClick={handleGenerate}
            className="flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-3 font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
            Generate
          </button>
          {job?.status === "failed" ? (
            <button
              disabled={loading}
              type="button"
              onClick={retry}
              className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-3 font-bold text-slate-800 hover:bg-slate-50"
            >
              <RefreshCw size={18} />
              Retry
            </button>
          ) : null}
        </div>
      </section>

        <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-slate-700">
                <History size={16} aria-hidden="true" />
                Job history
              </p>
              <h2 className="mt-1 text-xl font-black text-slate-950">Recent generations</h2>
            </div>
            <span className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-black text-slate-700">{history.length}</span>
          </div>

          {history.length === 0 ? (
            <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">Generated jobs, retries, costs, and Remix shortcuts will appear here.</p>
          ) : (
            <div className="space-y-3">
              {history.map((item) => (
                <article key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-semibold leading-5 text-slate-800">{item.prompt}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold text-slate-600">
                        <span className="rounded-md bg-white px-2 py-1">{item.status}</span>
                        <span className="rounded-md bg-white px-2 py-1">{item.progress}%</span>
                        <span className="flex items-center gap-1 rounded-md bg-white px-2 py-1">
                          <Coins size={13} aria-hidden="true" />
                          {formatCost(item.costEstimated)}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => remix(item)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800 hover:bg-slate-100"
                    >
                      <Repeat2 size={15} aria-hidden="true" />
                      Remix
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>{item.createdAt.slice(0, 19).replace("T", " ")}</span>
                    {item.currentStep ? <span>{item.currentStep}</span> : null}
                    {item.assets.length > 0 ? <span>{item.assets.length} assets</span> : null}
                    {item.gameId ? (
                      <Link href={`/games/${item.gameId}`} className="font-bold text-teal-700 hover:text-teal-900">
                        Details
                      </Link>
                    ) : null}
                  </div>
                  {item.errorMessage ? <p className="mt-2 text-xs font-bold text-red-700">{item.errorMessage}</p> : null}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="space-y-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-amber-700">Generation job</p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">{job?.currentStep ?? "No job queued"}</h2>
          </div>
          {job ? (
            <span className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-black text-slate-700">{job.status}</span>
          ) : null}
        </div>

        <div className="h-3 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full bg-teal-600 transition-all" style={{ width: progressLabel }} />
        </div>

        {job ? (
          <div className="grid gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="font-bold text-slate-500">jobId</p>
              <p className="mt-1 break-all font-mono text-xs text-slate-800">{job.jobId}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="font-bold text-slate-500">gameId</p>
              <p className="mt-1 break-all font-mono text-xs text-slate-800">{job.gameId ?? "Pending"}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="font-bold text-slate-500">cost</p>
              <p className="mt-1 font-mono text-xs text-slate-800">{formatCost(job.costEstimated)}</p>
            </div>
          </div>
        ) : (
          <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">Create a task to see pending, running, succeeded, or failed state here.</p>
        )}

        {job?.manifestUrl ? (
          <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <p className="font-black text-emerald-900">Generated artifact</p>
            <p className="break-all font-mono text-xs text-emerald-900">manifestUrl: {job.manifestUrl}</p>
            <p className="break-all font-mono text-xs text-emerald-900">artifactBaseUrl: {job.artifactBaseUrl}</p>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/play/${job.gameId}?preview=1`}
                className="flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-sm font-bold text-white"
              >
                <Play size={16} />
                Preview
              </Link>
              <button
                disabled={publishing || published}
                type="button"
                onClick={publish}
                className="flex items-center gap-2 rounded-lg bg-teal-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-70"
              >
                {publishing ? <Loader2 className="animate-spin" size={16} /> : <Rocket size={16} />}
                {published ? "Published" : "Publish"}
              </button>
              {published ? (
                <>
                  <Link className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm font-bold text-emerald-800" href="/">
                    View Home
                  </Link>
                  <Link className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm font-bold text-emerald-800" href={`/play/${job.gameId}`}>
                    Play now
                  </Link>
                </>
              ) : null}
            </div>
          </div>
        ) : null}

        {job?.errorMessage ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{job.errorMessage}</p>
        ) : null}

        <div className="space-y-3">
          <h3 className="text-lg font-black text-slate-950">Agent logs</h3>
          {logs.length === 0 ? (
            <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">Logs will appear as each agent writes to the database.</p>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <article key={log.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-black text-slate-900">{log.agentName}</p>
                    <span className="rounded-md bg-white px-2 py-1 text-xs font-bold text-slate-600">{log.status}</span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-slate-700">{log.step}</p>
                  <p className="mt-2 text-xs leading-5 text-slate-600">{truncateMiddle(log.outputSummary || log.inputSummary, 280)}</p>
                  {log.errorMessage ? <p className="mt-2 text-xs font-bold text-red-700">{log.errorMessage}</p> : null}
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
