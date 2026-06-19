"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Chrome, Github, Loader2, LogIn, UserPlus } from "lucide-react";
import type { ApiResponse } from "@ai-arcade/shared";

type Mode = "login" | "register";

export function AuthForm({ mode, oauthError = "" }: { mode: Mode; oauthError?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const body =
      mode === "register"
        ? {
            email: String(form.get("email") || ""),
            username: String(form.get("username") || ""),
            password: String(form.get("password") || "")
          }
        : {
            email: String(form.get("email") || ""),
            password: String(form.get("password") || "")
          };

    const response = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    const payload = (await response.json()) as ApiResponse<{ user: unknown }>;
    setLoading(false);
    if (!payload.ok) {
      setError(payload.error.message);
      return;
    }
    window.location.assign("/create");
  }

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-md space-y-5 rounded-lg border border-slate-200 bg-white p-6 shadow-soft">
      <div>
        <h1 className="text-2xl font-black text-slate-950">{mode === "login" ? "Login" : "Create account"}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {mode === "login" ? "Use your creator account to build and publish games." : "Register with OAuth or email and password."}
        </p>
      </div>

      <div className="grid gap-2">
        <a
          href="/api/auth/oauth/github/start"
          className="flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-3 font-bold text-slate-800 hover:bg-slate-50"
        >
          <Github size={18} aria-hidden="true" />
          Continue with GitHub
        </a>
        <a
          href="/api/auth/oauth/google/start"
          className="flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-3 font-bold text-slate-800 hover:bg-slate-50"
        >
          <Chrome size={18} aria-hidden="true" />
          Continue with Google
        </a>
      </div>

      <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-wide text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />
        Email
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      {mode === "register" ? (
        <label className="block space-y-2">
          <span className="text-sm font-bold text-slate-700">Username</span>
          <input
            required
            name="username"
            minLength={2}
            className="focus-ring w-full rounded-lg border border-slate-300 px-3 py-2"
            placeholder="Creator Demo"
          />
        </label>
      ) : null}

      <label className="block space-y-2">
        <span className="text-sm font-bold text-slate-700">Email</span>
        <input
          required
          name="email"
          type="email"
          className="focus-ring w-full rounded-lg border border-slate-300 px-3 py-2"
          placeholder="creator@example.com"
        />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-bold text-slate-700">Password</span>
        <input
          required
          name="password"
          type="password"
          minLength={mode === "register" ? 8 : 1}
          className="focus-ring w-full rounded-lg border border-slate-300 px-3 py-2"
          placeholder="password123"
        />
      </label>

      {oauthError || error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{oauthError || error}</p>
      ) : null}

      <button
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-3 font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
        type="submit"
      >
        {loading ? <Loader2 className="animate-spin" size={18} aria-hidden="true" /> : mode === "login" ? <LogIn size={18} /> : <UserPlus size={18} />}
        {mode === "login" ? "Login" : "Register"}
      </button>

      <p className="text-center text-sm text-slate-600">
        {mode === "login" ? "Need an account? " : "Already registered? "}
        <Link className="font-bold text-teal-700 hover:text-teal-800" href={mode === "login" ? "/register" : "/login"}>
          {mode === "login" ? "Register" : "Login"}
        </Link>
      </p>
    </form>
  );
}
