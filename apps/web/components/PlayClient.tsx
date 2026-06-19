"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Home, Loader2, RefreshCw } from "lucide-react";
import type { ApiResponse, GameManifest } from "@ai-arcade/shared";
import { gameMessageSchema } from "@ai-arcade/shared/schemas";

type GameMeta = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  status: string;
  author: { username: string };
  currentVersion: {
    manifestUrl: string;
    artifactBaseUrl: string;
  } | null;
};

type ManifestPayload = {
  gameId: string;
  manifestUrl: string;
  artifactBaseUrl: string;
  manifestJson: unknown;
};

async function readApi<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as ApiResponse<T>;
  if (!payload.ok) throw new Error(payload.error.message);
  return payload.data;
}

async function sendTelemetry(gameId: string, eventType: string, payload: Record<string, unknown> = {}) {
  await fetch("/api/telemetry/play", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ gameId, eventType, payload })
  }).catch(() => undefined);
}

export function PlayClient({ gameId }: { gameId: string }) {
  const [game, setGame] = useState<GameMeta | null>(null);
  const [manifestUrl, setManifestUrl] = useState("");
  const [artifactBaseUrl, setArtifactBaseUrl] = useState("");
  const [entryUrl, setEntryUrl] = useState("");
  const [status, setStatus] = useState<"loading" | "success" | "failed">("loading");
  const [error, setError] = useState("");
  const [iframeKey, setIframeKey] = useState(0);

  const iframeSrc = useMemo(() => {
    if (!entryUrl) return "";
    return `${entryUrl}${entryUrl.includes("?") ? "&" : "?"}run=${iframeKey}`;
  }, [entryUrl, iframeKey]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setStatus("loading");
      setError("");
      await sendTelemetry(gameId, "game_load_start");
      try {
        const [gameData, manifestData] = await Promise.all([
          readApi<{ game: GameMeta }>(await fetch(`/api/games/${gameId}`)),
          readApi<ManifestPayload>(await fetch(`/api/games/${gameId}/manifest`))
        ]);
        if (cancelled) return;
        setGame(gameData.game);
        setManifestUrl(manifestData.manifestUrl);
        setArtifactBaseUrl(manifestData.artifactBaseUrl);

        const remoteManifest = (await fetch(manifestData.manifestUrl).then((response) => {
          if (!response.ok) throw new Error(`Manifest fetch failed with ${response.status}`);
          return response.json();
        })) as GameManifest;

        const entry = remoteManifest.files.find((file) => file.path === remoteManifest.entry);
        if (!entry) throw new Error("Manifest does not contain an index.html entry file.");
        setEntryUrl(entry.url);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to load game.";
        setStatus("failed");
        setError(message);
        await sendTelemetry(gameId, "game_load_failed", { message });
      }
    }
    load();
    return () => {
      cancelled = true;
      sendTelemetry(gameId, "play_exit").catch(() => undefined);
    };
  }, [gameId, iframeKey]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const data = event.data;
      if (!data || typeof data !== "object" || data.source !== "ai-arcade-game") return;
      const parsed = gameMessageSchema.safeParse(data);
      if (!parsed.success) return;
      sendTelemetry(gameId, parsed.data.type, parsed.data.payload ?? {});
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [gameId]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-600">
            <Link className="flex items-center gap-1 hover:text-slate-950" href="/">
              <ArrowLeft size={16} /> Home
            </Link>
            <span>/</span>
            <span>{game?.author.username ?? "Loading author"}</span>
          </div>
          <h1 className="mt-2 text-3xl font-black text-slate-950">{game?.title ?? "正在加载游戏文件或初始化运行环境"}</h1>
          <p className="mt-2 max-w-3xl text-slate-600">{game?.description ?? "Fetching game meta, manifest, and remote entry file."}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {game?.tags.map((tag) => (
              <span key={tag} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-700">
                {tag}
              </span>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <Link className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold" href="/">
            <Home size={16} /> Home
          </Link>
          <button
            className="flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-sm font-bold text-white"
            type="button"
            onClick={() => setIframeKey((value) => value + 1)}
          >
            <RefreshCw size={16} /> Restart
          </button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="min-h-[520px] overflow-hidden rounded-lg border border-slate-200 bg-slate-950 shadow-soft">
          {status === "failed" ? (
            <div className="grid min-h-[520px] place-items-center p-6 text-center text-white">
              <div>
                <p className="text-lg font-black">Game load failed</p>
                <p className="mt-2 text-sm text-slate-300">{error}</p>
              </div>
            </div>
          ) : entryUrl ? (
            <iframe
              key={iframeKey}
              src={iframeSrc}
              title={game?.title ?? "AI Arcade game"}
              sandbox="allow-scripts"
              className="h-[520px] w-full border-0"
              onLoad={() => {
                setStatus("success");
                sendTelemetry(gameId, "game_load_success", { entryUrl });
              }}
            />
          ) : (
            <div className="grid min-h-[520px] place-items-center p-6 text-center text-white">
              <div>
                <Loader2 className="mx-auto animate-spin" size={28} />
                <p className="mt-3 font-bold">正在加载游戏文件或初始化运行环境</p>
              </div>
            </div>
          )}
        </section>

        <aside className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-teal-700">Runtime proof</p>
            <p className="mt-1 text-sm text-slate-600">The iframe loads the remote entry from the object-storage manifest.</p>
          </div>
          <div className="space-y-3 text-xs">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="font-black text-slate-600">status</p>
              <p className="mt-1 font-mono text-slate-950">{status}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="font-black text-slate-600">manifestUrl</p>
              <p className="mt-1 break-all font-mono text-slate-950">{manifestUrl || "Loading"}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="font-black text-slate-600">entryUrl</p>
              <p className="mt-1 break-all font-mono text-slate-950">{entryUrl || "Loading"}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="font-black text-slate-600">artifactBaseUrl</p>
              <p className="mt-1 break-all font-mono text-slate-950">{artifactBaseUrl || "Loading"}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="font-black text-slate-600">iframe sandbox</p>
              <p className="mt-1 font-mono text-slate-950">allow-scripts</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
