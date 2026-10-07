"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AnimatedAlert } from "@/components/brand/animated-icons";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function RootError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="honeycomb flex min-h-svh flex-col px-4 py-8 sm:px-8">
      <Link href="/" aria-label="Loopify home" className="w-fit">
        <Logo />
      </Link>
      <main className="flex flex-1 flex-col items-center justify-center gap-5 py-16 text-center">
        <div className="flex size-28 items-center justify-center rounded-full bg-brand-soft text-brand ring-8 ring-background">
          <AnimatedAlert trigger="mount" className="size-14" />
        </div>
        <h1 className="max-w-xl font-heading text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">
          Something went wrong
        </h1>
        <p className="max-w-md text-pretty text-muted-foreground">
          An unexpected error interrupted the loop. Try again, and if it keeps happening, let us know.
        </p>
        {error.digest && (
          <p className="rounded-full border bg-background px-3 py-1 font-mono text-xs text-muted-foreground">
            Error ID: {error.digest}
          </p>
        )}
        <div className="flex w-full flex-col gap-3 min-[420px]:w-auto min-[420px]:flex-row">
          <Button size="lg" className="h-11 px-6" onClick={() => retry()}>
            Try again
          </Button>
          <Button asChild size="lg" variant="outline" className="h-11 bg-background px-6">
            <Link href="/">Go home</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
