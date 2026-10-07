import type { ComponentType } from "react";
import {
  AnimatedCalendar,
  AnimatedChartBars,
  AnimatedTrendUp,
  AnimatedUsers,
  type IconTrigger,
} from "@/components/brand/animated-icons";
import { InsightsMock } from "./insights-mock";
import { HoverCard, Reveal } from "./motion";
import { SectionHeading } from "./section-heading";

const points: { icon: ComponentType<{ className?: string; trigger?: IconTrigger }>; title: string; text: string }[] = [
  {
    icon: AnimatedUsers,
    title: "Employee reports",
    text: "Per-person summaries of planned vs. finished work, carry-overs and diary highlights. No status meetings needed.",
  },
  {
    icon: AnimatedChartBars,
    title: "Team heatmap",
    text: "A consistency heatmap for the whole team shows momentum at a glance and flags who might need a hand.",
  },
  {
    icon: AnimatedCalendar,
    title: "Calendar view",
    text: "Plans, deadlines and completed work across the month, so you can balance load before weeks get crowded.",
  },
  {
    icon: AnimatedTrendUp,
    title: "Trends & insights",
    text: "Throughput, roll-over rates and completion trends turn daily habits into signals you can act on.",
  },
];

export function ManagerInsights() {
  return (
    <section id="managers" className="scroll-mt-20">
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[1fr_1.1fr]">
        <div className="flex flex-col gap-8">
          <SectionHeading
            align="left"
            eyebrow="For managers"
            title="See how the team is really doing, without asking"
            description="Every plan, capture and end-of-day diary rolls up into reports and insights, so you can support people instead of chasing updates."
          />
          <ul className="grid gap-3 sm:grid-cols-2">
            {points.map((point, index) => (
              <li key={point.title}>
                <Reveal delay={index * 0.06} className="h-full">
                  <HoverCard className="flex h-full gap-3 rounded-2xl border bg-card p-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
                      <point.icon trigger="inherit" className="size-6" />
                    </span>
                    <div>
                      <h3 className="font-sans text-sm font-semibold tracking-normal">{point.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{point.text}</p>
                    </div>
                  </HoverCard>
                </Reveal>
              </li>
            ))}
          </ul>
        </div>
        <InsightsMock />
      </div>
    </section>
  );
}
