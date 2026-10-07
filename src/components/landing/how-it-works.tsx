import type { ComponentType } from "react";
import {
  AnimatedCheckCircle,
  AnimatedRocket,
  AnimatedSparkles,
  AnimatedTarget,
  type IconTrigger,
} from "@/components/brand/animated-icons";
import { HoverCard, Reveal } from "./motion";
import { SectionHeading } from "./section-heading";

const steps: {
  icon: ComponentType<{ className?: string; trigger?: IconTrigger }>;
  title: string;
  description: string;
}[] = [
  {
    icon: AnimatedTarget,
    title: "Plan",
    description: "Pick today's priorities from your boards and yesterday's carry-overs. Three minutes, tops.",
  },
  {
    icon: AnimatedSparkles,
    title: "Capture",
    description: "Meetings and messages become task cards as they happen. AI does the note-taking for you.",
  },
  {
    icon: AnimatedCheckCircle,
    title: "Finish",
    description: "Work the list, move cards across the board, and wrap up with a quick end-of-day diary.",
  },
  {
    icon: AnimatedRocket,
    title: "Roll over",
    description: "Whatever's left lands on tomorrow's plan automatically. The loop starts again, nothing lost.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <SectionHeading
          eyebrow="How the loop works"
          title="Four steps. Every day. On repeat."
          description="Loopify is built around a simple daily rhythm, so good habits stick without extra process."
        />
        <div className="relative mt-14">
          <div
            aria-hidden
            className="pointer-events-none absolute top-13 right-[12%] left-[12%] hidden border-t-2 border-dashed border-primary/60 lg:block"
          />
          <ol className="relative grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, index) => (
              <li key={step.title} className="relative">
                <Reveal delay={index * 0.1} className="h-full">
                  <HoverCard className="flex h-full flex-col items-center rounded-3xl border bg-card p-6 text-center">
                    <div className="relative">
                      <div className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground ring-8 ring-background">
                        <step.icon trigger="inherit" className="size-7" />
                      </div>
                      <span className="absolute -top-1 -right-2 flex size-6 items-center justify-center rounded-full border bg-card text-xs font-bold">
                        {index + 1}
                      </span>
                    </div>
                    <h3 className="mt-5 font-heading text-xl font-bold">{step.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.description}</p>
                  </HoverCard>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
