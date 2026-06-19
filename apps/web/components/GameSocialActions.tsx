"use client";

import { useState } from "react";
import { Heart, Loader2, Star } from "lucide-react";
import type { ApiResponse } from "@ai-arcade/shared";

type GameSocialActionsProps = {
  gameId: string;
  initialLikeCount: number;
  initialFavoriteCount: number;
  initialLiked?: boolean;
  initialFavorited?: boolean;
};

async function postJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { method: "POST" });
  const payload = (await response.json()) as ApiResponse<T>;
  if (!payload.ok) throw new Error(payload.error.message);
  return payload.data;
}

export function GameSocialActions({
  gameId,
  initialLikeCount,
  initialFavoriteCount,
  initialLiked = false,
  initialFavorited = false
}: GameSocialActionsProps) {
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [favoriteCount, setFavoriteCount] = useState(initialFavoriteCount);
  const [liked, setLiked] = useState(initialLiked);
  const [favorited, setFavorited] = useState(initialFavorited);
  const [pending, setPending] = useState<"like" | "favorite" | null>(null);
  const [message, setMessage] = useState("");

  async function toggleLike() {
    setPending("like");
    setMessage("");
    try {
      const result = await postJson<{ liked: boolean; likeCount: number }>(`/api/games/${gameId}/like`);
      setLiked(result.liked);
      setLikeCount(result.likeCount);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Like failed.");
    } finally {
      setPending(null);
    }
  }

  async function toggleFavorite() {
    setPending("favorite");
    setMessage("");
    try {
      const result = await postJson<{ favorited: boolean; favoriteCount: number }>(`/api/games/${gameId}/favorite`);
      setFavorited(result.favorited);
      setFavoriteCount(result.favoriteCount);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Favorite failed.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex gap-2 text-xs text-slate-500">
        <button
          type="button"
          onClick={toggleLike}
          disabled={pending !== null}
          className={`flex items-center gap-1 rounded-md px-1.5 py-1 font-semibold hover:bg-rose-50 ${
            liked ? "text-rose-700" : "text-slate-500"
          }`}
          title="Like"
        >
          {pending === "like" ? <Loader2 className="animate-spin" size={14} /> : <Heart size={14} fill={liked ? "currentColor" : "none"} />}
          {likeCount}
        </button>
        <button
          type="button"
          onClick={toggleFavorite}
          disabled={pending !== null}
          className={`flex items-center gap-1 rounded-md px-1.5 py-1 font-semibold hover:bg-amber-50 ${
            favorited ? "text-amber-700" : "text-slate-500"
          }`}
          title="Favorite"
        >
          {pending === "favorite" ? (
            <Loader2 className="animate-spin" size={14} />
          ) : (
            <Star size={14} fill={favorited ? "currentColor" : "none"} />
          )}
          {favoriteCount}
        </button>
      </div>
      {message ? <p className="max-w-44 text-xs font-semibold text-red-600">{message}</p> : null}
    </div>
  );
}
