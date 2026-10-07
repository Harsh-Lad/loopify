import { IconCheck } from "@tabler/icons-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Reveal } from "./motion";
import { SectionHeading } from "./section-heading";

const tiers = [
  {
    name: "Free",
    price: "$0",
    cadence: "forever",
    description: "For individuals and small teams getting into the loop.",
    cta: "Get started free",
    featured: false,
    features: [
      "Up to 3 team members",
      "Today plan & roll-over",
      "2 shared boards",
      "Limited AI captures",
      "Personal heatmap",
    ],
  },
  {
    name: "Team",
    price: "$8",
    cadence: "per user / month",
    description: "For growing teams that want the full daily loop.",
    cta: "Start with Team",
    featured: true,
    features: [
      "Unlimited members & boards",
      "More AI captures & summaries",
      "End-of-day diary with AI recap",
      "Google Sheets AI chat",
      "Team heatmap & calendar view",
    ],
  },
  {
    name: "Business",
    price: "$16",
    cadence: "per user / month",
    description: "For organizations that need reporting and control.",
    cta: "Choose Business",
    featured: false,
    features: [
      "Everything in Team",
      "Manager reports & insights",
      "Multiple workspaces",
      "Advanced roles & permissions",
      "Priority support",
    ],
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="scroll-mt-20 bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <SectionHeading
          eyebrow="Pricing"
          title="Simple pricing that grows with you"
          description="Start free and upgrade when your team is ready. Cancel anytime."
        />
        <div className="mt-14 grid gap-4 lg:grid-cols-3">
          {tiers.map((tier, index) => (
            <Reveal key={tier.name} delay={index * 0.08} className="h-full">
              <div
                className={cn(
                  "relative flex h-full flex-col rounded-3xl border bg-card p-6 sm:p-8",
                  tier.featured && "border-primary shadow-[0_28px_70px_-32px_rgb(0_0_0/0.4)] ring-2 ring-primary",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-heading text-xl font-bold">{tier.name}</h3>
                  {tier.featured && <Badge>Most popular</Badge>}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{tier.description}</p>
                <p className="mt-6 flex items-baseline gap-2">
                  <span className="font-heading text-5xl font-extrabold tracking-tight">{tier.price}</span>
                  <span className="text-sm text-muted-foreground">{tier.cadence}</span>
                </p>
                <Button
                  asChild
                  size="lg"
                  variant={tier.featured ? "default" : "outline"}
                  className="mt-6 h-11 w-full text-base"
                >
                  <Link href="/sign-up">{tier.cta}</Link>
                </Button>
                <ul className="mt-8 flex flex-col gap-3 text-sm">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <IconCheck className="size-3" stroke={3} />
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
        <p className="mt-8 text-center text-xs text-muted-foreground">
          Prices shown are placeholders in USD and may change before launch. Taxes may apply.
        </p>
      </div>
    </section>
  );
}
