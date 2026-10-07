"use client";

import { useEffect } from "react";
import { LogoMark } from "@/components/brand/logo";
import "./globals.css";

/**
 * Replaces the root layout when it fails, so it renders its own document and
 * applies the saved theme itself (next-themes is not mounted here).
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
    let theme: string | null = null;
    try {
      theme = window.localStorage.getItem("theme");
    } catch {
      // Storage can be blocked; fall back to the OS preference.
    }
    const dark =
      theme === "dark" || ((!theme || theme === "system") && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
  }, [error]);

  return (
    <html lang="en" className="h-full antialiased">
      <body
        className="honeycomb flex min-h-full flex-col items-center justify-center gap-5 px-4 py-16 text-center"
        style={{ fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" }}
      >
        <title>Something went wrong · Loopify</title>
        <LogoMark className="size-14" />
        <h1
          className="max-w-xl text-3xl font-extrabold tracking-tight text-balance sm:text-4xl"
          style={{ fontFamily: "inherit" }}
        >
          Loopify hit a snag
        </h1>
        <p className="max-w-md text-pretty text-muted-foreground">
          Something went wrong while loading the app. Try again, and if it keeps happening, let us know.
        </p>
        {error.digest && (
          <p className="rounded-full border bg-background px-3 py-1 font-mono text-xs text-muted-foreground">
            Error ID: {error.digest}
          </p>
        )}
        <div className="flex w-full flex-col gap-3 min-[420px]:w-auto min-[420px]:flex-row">
          <button
            type="button"
            onClick={() => retry()}
            className="h-11 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
          >
            Try again
          </button>
          {/* A full page load is intentional: the app shell itself failed. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-full border bg-background px-6 text-sm font-medium transition-colors hover:bg-muted"
          >
            Go home
          </a>
        </div>
      </body>
    </html>
  );
}
