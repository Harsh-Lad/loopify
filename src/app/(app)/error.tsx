"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AnimatedAlert } from "@/components/brand/animated-icons";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center p-4 sm:p-8">
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia className="flex size-20 items-center justify-center rounded-full bg-brand-soft text-brand">
            <AnimatedAlert trigger="mount" className="size-10" />
          </EmptyMedia>
          <EmptyTitle className="text-xl font-bold">Something went wrong</EmptyTitle>
          <EmptyDescription>
            This part of Loopify hit an unexpected error. Your work is saved; try again or head back home.
          </EmptyDescription>
          {error.digest && (
            <p className="mt-1 rounded-full border px-3 py-1 font-mono text-xs text-muted-foreground">
              Error ID: {error.digest}
            </p>
          )}
        </EmptyHeader>
        <EmptyContent>
          <div className="flex flex-col gap-2 min-[420px]:flex-row">
            <Button onClick={() => retry()}>Try again</Button>
            <Button asChild variant="outline">
              <Link href="/dashboard">Go home</Link>
            </Button>
          </div>
        </EmptyContent>
      </Empty>
    </div>
  );
}
