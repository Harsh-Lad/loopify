import type { ComponentType } from "react";
import {
  AnimatedBolt,
  AnimatedCalendar,
  AnimatedCheckCircle,
  AnimatedClock,
  AnimatedFlame,
  AnimatedListCheck,
  AnimatedSparkles,
  AnimatedTarget,
  type IconTrigger,
} from "@/components/brand/animated-icons";
import { HoverCard, Reveal } from "./motion";
import { SectionHeading } from "./section-heading";

type Feature = {
  icon: ComponentType<{ className?: string; trigger?: IconTrigger }>;
  title: string;
  description: string;
};

const features: Feature[] = [
  {
    icon: AnimatedTarget,
    title: "Plan your day",
    description:
      "Start every morning with a focused Today list built from your boards, calendar and yesterday's leftovers.",
  },
  {
    icon: AnimatedSparkles,
    title: "AI capture",
    description:
      "Paste a call recap, chat thread or voice note. Loopify pulls out the action items as ready-to-go task cards.",
  },
  {
    icon: AnimatedListCheck,
    title: "Kanban boards",
    description: "Shared team boards with custom columns, owners and due dates. Drag work forward as it moves.",
  },
  {
    icon: AnimatedClock,
    title: "Roll over, automatically",
    description: "Anything unfinished rolls into tomorrow with its history intact, so nothing quietly disappears.",
  },
  {
    icon: AnimatedCheckCircle,
    title: "End-of-day diary",
    description: "A two-minute wrap-up with an AI summary of what shipped, what's blocked and what's next.",
  },
  {
    icon: AnimatedBolt,
    title: "Chat with your Sheets",
    description: "Connect a Google Sheet and ask questions in plain language. Get answers, not formulas.",
  },
  {
    icon: AnimatedFlame,
    title: "Consistency heatmap",
    description: "A contribution-style heatmap that makes steady progress visible for you and your team.",
  },
  {
    icon: AnimatedCalendar,
    title: "Calendar view",
    description: "See plans, due dates and finished work across the month, and spot crunch weeks before they land.",
  },
];

export function Features() {
  return (
    <section id="features" className="scroll-mt-20">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <SectionHeading
          eyebrow="Features"
          title="Everything your day needs, in one loop"
          description="From the first coffee to the last commit: plan, capture, finish and hand off to tomorrow without switching tools."
        />
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, index) => (
            <Reveal key={feature.title} delay={(index % 4) * 0.06} className="h-full">
              <HoverCard className="group h-full rounded-3xl border bg-card p-6 transition-shadow hover:shadow-[0_20px_50px_-30px_rgb(0_0_0/0.35)]">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-brand-soft text-brand transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <feature.icon trigger="inherit" className="size-7" />
                </div>
                <h3 className="mt-5 font-heading text-lg font-bold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
              </HoverCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
