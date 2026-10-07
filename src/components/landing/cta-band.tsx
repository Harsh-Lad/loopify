import { IconArrowRight } from "@tabler/icons-react";
import Link from "next/link";
import { AnimatedBee } from "@/components/brand/animated-icons";
import { Button } from "@/components/ui/button";
import { Reveal } from "./motion";

export function CtaBand() {
  return (
    <section className="px-4 pb-20 sm:px-6 sm:pb-28">
      <Reveal className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-primary px-6 py-14 text-primary-foreground sm:px-12 sm:py-20">
        <svg
          viewBox="0 0 600 300"
          className="pointer-events-none absolute -right-24 -bottom-24 h-[140%] opacity-20"
          aria-hidden
        >
          <path
            d="M80 220c0-90 70-160 160-160 80 0 140 60 140 130 0 64-48 112-108 112-54 0-94-40-94-90 0-40 32-72 72-72"
            fill="none"
            stroke="currentColor"
            strokeWidth={40}
            strokeLinecap="round"
          />
        </svg>
        <div className="relative flex flex-col items-center gap-6 text-center">
          <AnimatedBee trigger="loop" className="size-14" />
          <h2 className="max-w-2xl font-heading text-3xl font-extrabold tracking-tight text-balance sm:text-5xl">
            Tomorrow starts where today leaves off.
          </h2>
          <p className="max-w-xl text-base text-pretty opacity-80 sm:text-lg">
            Set up your team in minutes. Plan your first day, capture a meeting, and watch the loop close.
          </p>
          <div className="flex w-full flex-col gap-3 min-[420px]:w-auto min-[420px]:flex-row">
            <Button
              asChild
              size="lg"
              className="h-12 bg-primary-foreground px-6 text-base text-white hover:bg-primary-foreground/85"
            >
              <Link href="/sign-up">
                Get started free
                <IconArrowRight data-icon="inline-end" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 border-primary-foreground/30 bg-transparent px-6 text-base text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              <Link href="/sign-in">Sign in</Link>
            </Button>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
