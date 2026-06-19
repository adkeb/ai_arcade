import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CalendarDays,
  GitBranch,
  Package,
  Play,
  UserRound,
} from "lucide-react";
import { db } from "@ai-arcade/db";
import { GameAuthorControls } from "@/components/GameAuthorControls";
import { GameSocialActions } from "@/components/GameSocialActions";
import { formatDate } from "@/lib/format";
import { getCurrentUser } from "@/lib/auth";

type PageProps = {
  params: Promise<{ gameId: string }>;
};

export default async function GameDetailPage({ params }: PageProps) {
  const { gameId } = await params;
  const user = await getCurrentUser();
  const game = await db.game.findUnique({
    where: { id: gameId },
    include: {
      author: { select: { username: true } },
      currentVersion: true,
      versions: { orderBy: { versionNumber: "desc" } },
      ...(user
        ? {
            likes: { where: { userId: user.id }, select: { id: true } },
            favorites: { where: { userId: user.id }, select: { id: true } },
          }
        : {}),
    },
  });

  const isAuthor = Boolean(user && game?.authorId === user.id);
  if (!game || (game.status !== "published" && !isAuthor)) notFound();
  const likedByCurrentUser = "likes" in game ? game.likes.length > 0 : false;
  const favoritedByCurrentUser =
    "favorites" in game ? game.favorites.length > 0 : false;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <img
          className="aspect-[16/9] w-full object-cover"
          src={game.coverUrl}
          alt={`${game.title} cover`}
        />
        <div className="space-y-4 p-5">
          <div>
            <h1 className="text-3xl font-black text-slate-950">{game.title}</h1>
            <p className="mt-2 text-slate-600">{game.description}</p>
            {game.status !== "published" ? (
              <p className="mt-3 inline-flex rounded-md bg-amber-50 px-2 py-1 text-xs font-black uppercase text-amber-700">
                Draft
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {game.tags.map((tag) => (
              <Link
                key={tag}
                href={`/?tag=${encodeURIComponent(tag)}`}
                className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700 hover:bg-teal-50 hover:text-teal-800"
              >
                {tag}
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {game.currentVersion ? (
              <Link
                className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-3 font-bold text-white"
                href={`/play/${game.id}`}
              >
                <Play size={18} aria-hidden="true" />
                Play
              </Link>
            ) : null}
            {game.status === "published" ? (
              <GameSocialActions
                gameId={game.id}
                initialLikeCount={game.likeCount}
                initialFavoriteCount={game.favoriteCount}
                initialLiked={likedByCurrentUser}
                initialFavorited={favoritedByCurrentUser}
              />
            ) : null}
          </div>
        </div>
      </section>
      <aside className="space-y-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <section className="space-y-3">
          <h2 className="text-lg font-black text-slate-950">Game meta</h2>
          <p className="flex items-center gap-2 text-sm text-slate-600">
            <UserRound size={16} aria-hidden="true" />
            Author: {game.author.username}
          </p>
          <p className="flex items-center gap-2 text-sm text-slate-600">
            <CalendarDays size={16} aria-hidden="true" />
            Published: {formatDate(game.publishedAt)}
          </p>
          <p className="text-sm text-slate-600">Status: {game.status}</p>
          <p className="text-sm text-slate-600">Plays: {game.playCount}</p>
          <p className="text-sm text-slate-600">Likes: {game.likeCount}</p>
          <p className="text-sm text-slate-600">
            Favorites: {game.favoriteCount}
          </p>
        </section>

        {isAuthor ? (
          <GameAuthorControls
            gameId={game.id}
            title={game.title}
            description={game.description}
            tags={game.tags}
            currentVersionId={game.currentVersionId}
            versions={game.versions.map((version) => ({
              id: version.id,
              versionNumber: version.versionNumber,
              buildStatus: version.buildStatus,
              createdAt: version.createdAt.toISOString(),
              storagePrefix: version.storagePrefix,
            }))}
          />
        ) : null}

        <section className="space-y-3 border-t border-slate-100 pt-4">
          <h2 className="flex items-center gap-2 text-lg font-black text-slate-950">
            <Package size={18} aria-hidden="true" />
            Current artifact
          </h2>
          <p className="break-all font-mono text-xs text-slate-600">
            manifestUrl: {game.currentVersion?.manifestUrl}
          </p>
          <p className="break-all font-mono text-xs text-slate-600">
            artifactBaseUrl: {game.currentVersion?.artifactBaseUrl}
          </p>
          <p className="break-all font-mono text-xs text-slate-600">
            entryFile: {game.currentVersion?.entryFile}
          </p>
        </section>

        {!isAuthor ? (
          <section className="space-y-3 border-t border-slate-100 pt-4">
            <h2 className="flex items-center gap-2 text-lg font-black text-slate-950">
              <GitBranch size={18} aria-hidden="true" />
              Versions
            </h2>
            <div className="space-y-2">
              {game.versions.map((version) => (
                <article
                  key={version.id}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-black text-slate-900">
                      v{version.versionNumber}
                    </p>
                    <span className="rounded-md bg-white px-2 py-1 text-xs font-bold text-slate-600">
                      {version.buildStatus}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {formatDate(version.createdAt)}
                  </p>
                  <p className="mt-2 break-all font-mono text-[11px] leading-4 text-slate-600">
                    {version.storagePrefix}
                  </p>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </aside>
    </div>
  );
}
