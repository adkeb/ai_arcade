import Link from "next/link";
import { Info, Play } from "lucide-react";
import { formatDate } from "@/lib/format";
import { GameSocialActions } from "./GameSocialActions";

type GameCardProps = {
  game: {
    id: string;
    title: string;
    description: string;
    coverUrl: string;
    tags: string[];
    publishedAt: Date | string | null;
    playCount: number;
    likeCount: number;
    favoriteCount: number;
    likedByCurrentUser?: boolean;
    favoritedByCurrentUser?: boolean;
    author: {
      username: string;
    };
  };
};

export function GameCard({ game }: GameCardProps) {
  return (
    <article className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft">
      <Link href={`/play/${game.id}`} className="block">
        <div className="aspect-[16/9] bg-slate-900">
          <img className="h-full w-full object-cover" src={game.coverUrl} alt={`${game.title} cover`} />
        </div>
      </Link>
      <div className="space-y-4 p-4">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <h2 className="line-clamp-1 text-lg font-black text-slate-950">{game.title}</h2>
            <span className="whitespace-nowrap rounded-md bg-teal-50 px-2 py-1 text-xs font-bold text-teal-700">
              {game.playCount} plays
            </span>
          </div>
          <p className="line-clamp-2 min-h-10 text-sm leading-5 text-slate-600">{game.description}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {game.tags.slice(0, 4).map((tag) => (
            <Link
              key={tag}
              href={`/?tag=${encodeURIComponent(tag)}`}
              className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-teal-50 hover:text-teal-800"
            >
              {tag}
            </Link>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
          <span className="truncate">
            By <strong className="text-slate-700">{game.author.username}</strong>
          </span>
          <span>{formatDate(game.publishedAt)}</span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <GameSocialActions
            gameId={game.id}
            initialLikeCount={game.likeCount}
            initialFavoriteCount={game.favoriteCount}
            initialLiked={game.likedByCurrentUser}
            initialFavorited={game.favoritedByCurrentUser}
          />
          <div className="flex gap-2">
            <Link
              href={`/games/${game.id}`}
              className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800 hover:bg-slate-50"
            >
              <Info size={16} aria-hidden="true" />
              Details
            </Link>
            <Link
              href={`/play/${game.id}`}
              className="flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-sm font-bold text-white hover:bg-slate-800"
            >
              <Play size={16} aria-hidden="true" />
              Play
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
