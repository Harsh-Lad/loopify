import type { Metadata } from "next";
import Link from "next/link";
import { AnimatedBee } from "@/components/brand/animated-icons";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="honeycomb relative flex min-h-svh flex-col overflow-x-clip px-4 py-8 sm:px-8">
      <Link href="/" aria-label="Loopify home" className="w-fit">
        <Logo />
      </Link>
      <main className="flex flex-1 flex-col items-center justify-center gap-6 py-16 text-center">
        <div className="relative flex size-36 items-center justify-center rounded-full bg-brand-soft ring-8 ring-background sm:size-44">
          <AnimatedBee trigger="loop" className="size-20 text-foreground sm:size-24" strokeWidth={1.6} />
        </div>
        <p className="font-heading text-sm font-bold tracking-[0.3em] text-brand uppercase">Error 404</p>
        <h1 className="max-w-xl font-heading text-4xl font-extrabold tracking-tight text-balance sm:text-5xl">
          This page flew off.
        </h1>
        <p className="max-w-md text-base text-pretty text-muted-foreground sm:text-lg">
          We looked in every cell of the hive and couldn&apos;t find it. The link may be broken, or the page may have
          moved.
        </p>
        <div className="flex w-full flex-col gap-3 min-[420px]:w-auto min-[420px]:flex-row">
          <Button asChild size="lg" className="h-11 px-6">
            <Link href="/">Go home</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-11 bg-background px-6">
            <Link href="/today">Open Today</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
