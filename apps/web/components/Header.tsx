"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn, LogOut, PlusCircle, Gamepad2 } from "lucide-react";
import type { SessionUser } from "@/lib/auth";

export function Header({ user }: { user: SessionUser | null }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.refresh();
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-black tracking-tight text-slate-950">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-slate-950 text-white">
            <Gamepad2 size={19} aria-hidden="true" />
          </span>
          <span>AI Arcade</span>
        </Link>

        <nav className="flex items-center gap-2 text-sm font-semibold">
          <Link className="rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100" href="/">
            Home
          </Link>
          <Link className="flex items-center gap-2 rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100" href="/create">
            <PlusCircle size={16} aria-hidden="true" />
            Create
          </Link>
          {user ? (
            <>
              <span className="hidden max-w-44 truncate rounded-lg bg-slate-100 px-3 py-2 text-slate-700 sm:inline">
                {user.username}
              </span>
              <button
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800 hover:bg-slate-50"
                type="button"
                onClick={logout}
                title="Logout"
              >
                <LogOut size={16} aria-hidden="true" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </>
          ) : (
            <Link
              className="flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-white hover:bg-slate-800"
              href="/login"
            >
              <LogIn size={16} aria-hidden="true" />
              Login
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
