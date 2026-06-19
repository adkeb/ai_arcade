import Link from "next/link";
import { PlusCircle, Search, Tags, X } from "lucide-react";
import { db } from "@ai-arcade/db";
import { GameCard } from "@/components/GameCard";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

type HomePageProps = {
  searchParams?: Promise<{
    search?: string;
    tag?: string;
  }>;
};

type GameWithViewerState = Awaited<ReturnType<typeof loadGames>>[number] & {
  likedByCurrentUser?: boolean;
  favoritedByCurrentUser?: boolean;
};

async function loadGames(params: { search: string; tag: string; userId?: string }) {
  return db.game.findMany({
    where: {
      status: "published",
      ...(params.search
        ? {
            OR: [
              { title: { contains: params.search, mode: "insensitive" as const } },
              { description: { contains: params.search, mode: "insensitive" as const } }
            ]
          }
        : {}),
      ...(params.tag ? { tags: { has: params.tag } } : {})
    },
    include: {
      author: { select: { username: true } },
      currentVersion: true,
      ...(params.userId
        ? {
            likes: { where: { userId: params.userId }, select: { id: true } },
            favorites: { where: { userId: params.userId }, select: { id: true } }
          }
        : {})
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }]
  });
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = (await searchParams) ?? {};
  const search = typeof params.search === "string" ? params.search.trim() : "";
  const tag = typeof params.tag === "string" ? params.tag.trim() : "";
  const user = await getCurrentUser();

  const [games, tagRows] = await Promise.all([
    loadGames({ search, tag, userId: user?.id }),
    db.game.findMany({
      where: { status: "published" },
      select: { tags: true }
    })
  ]);

  const tags = Array.from(new Set(tagRows.flatMap((row) => row.tags))).sort((a, b) => a.localeCompare(b));

  const cards: GameWithViewerState[] = games.map((game) => ({
    ...game,
    likedByCurrentUser: "likes" in game ? game.likes.length > 0 : false,
    favoritedByCurrentUser: "favorites" in game ? game.favorites.length > 0 : false
  }));
  const hasFilters = Boolean(search || tag);

  return (
    <div className="space-y-7">
      <section className="flex flex-wrap items-end justify-between gap-5 border-b border-slate-200 pb-6">
        <div className="max-w-3xl">
          <p className="text-sm font-black uppercase tracking-wide text-teal-700">Published games</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950">AI Arcade</h1>
          <p className="mt-3 text-base leading-7 text-slate-600">
            Browse HTML5 games generated through the Create pipeline, saved to MinIO, and loaded by remote manifest at play time.
          </p>
        </div>
        <Link className="flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-3 font-bold text-white hover:bg-slate-800" href="/create">
          <PlusCircle size={18} aria-hidden="true" />
          Create game
        </Link>
      </section>

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <form action="/" className="flex flex-col gap-3 md:flex-row">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} aria-hidden="true" />
            <span className="sr-only">Search games</span>
            <input
              name="search"
              defaultValue={search}
              placeholder="Search by title or description"
              className="focus-ring h-11 w-full rounded-lg border border-slate-300 pl-10 pr-3 text-sm"
            />
          </label>
          {tag ? <input type="hidden" name="tag" value={tag} /> : null}
          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-bold text-white hover:bg-slate-800"
          >
            <Search size={16} aria-hidden="true" />
            Search
          </button>
          {hasFilters ? (
            <Link
              href="/"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-800 hover:bg-slate-50"
            >
              <X size={16} aria-hidden="true" />
              Clear
            </Link>
          ) : null}
        </form>

        {tags.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
            <span className="inline-flex items-center gap-1 text-sm font-black text-slate-700">
              <Tags size={16} aria-hidden="true" />
              Tags
            </span>
            {tags.map((item) => {
              const href = `/?${new URLSearchParams({
                ...(search ? { search } : {}),
                tag: item
              }).toString()}`;
              return (
                <Link
                  key={item}
                  href={href}
                  className={`rounded-md border px-2.5 py-1.5 text-xs font-bold ${
                    item === tag
                      ? "border-teal-700 bg-teal-700 text-white"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-teal-50 hover:text-teal-800"
                  }`}
                >
                  {item}
                </Link>
              );
            })}
          </div>
        ) : null}
      </section>

      {cards.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
          <h2 className="text-xl font-black text-slate-950">{hasFilters ? "No games match these filters" : "No published games yet"}</h2>
          <p className="mt-2 text-slate-600">
            {hasFilters ? "Try a different keyword or tag." : "Run the seed command or publish a generated game from Create."}
          </p>
        </div>
      ) : (
        <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </section>
      )}
    </div>
  );
}
