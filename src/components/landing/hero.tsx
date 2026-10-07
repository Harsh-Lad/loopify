import { IconArrowRight } from "@tabler/icons-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HeroMock } from "./hero-mock";
import { Reveal } from "./motion";

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden">
      <div className="honeycomb absolute inset-0 -z-10 mask-[radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" />
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 pt-14 pb-20 sm:px-6 sm:pt-20 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:pt-24 lg:pb-28">
        <Reveal className="flex flex-col items-start gap-6">
          <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-xs">
            <span className="size-2 rounded-full bg-primary" />
            The daily loop for teams
          </span>
          <h1 className="font-heading text-4xl leading-[1.05] font-extrabold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            Plan your day.{" "}
            <span className="relative z-0 whitespace-nowrap">
              <span className="absolute inset-x-0 bottom-1 -z-10 h-3 rounded-sm bg-primary/70 sm:h-4" />
              Close the loop.
            </span>{" "}
            Every day.
          </h1>
          <p className="max-w-xl text-lg text-pretty text-muted-foreground">
            Loopify turns conversations into task cards, keeps your team&apos;s boards moving, and rolls unfinished work
            into tomorrow, so nothing slips and every day picks up exactly where yesterday left off.
          </p>
          <div className="flex w-full flex-col gap-3 min-[420px]:w-auto min-[420px]:flex-row">
            <Button asChild size="lg" className="h-12 px-6 text-base">
              <Link href="/sign-up">
                Get started free
                <IconArrowRight data-icon="inline-end" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 px-6 text-base">
              <Link href="#how-it-works">See how it works</Link>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">Free for small teams. No credit card required.</p>
        </Reveal>
        <HeroMock />
      </div>
    </section>
  );
}
