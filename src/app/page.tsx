import type { Metadata } from "next";
import { CtaBand } from "@/components/landing/cta-band";
import { Faq } from "@/components/landing/faq";
import { Features } from "@/components/landing/features";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { ManagerInsights } from "@/components/landing/manager-insights";
import { Pricing } from "@/components/landing/pricing";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import { SocialProof } from "@/components/landing/social-proof";

export const metadata: Metadata = {
  title: { absolute: "Loopify: plan, capture, finish, roll over" },
  description:
    "Loopify is the daily loop for teams: plan your day, turn conversations into task cards with AI, keep boards moving, and roll unfinished work into tomorrow.",
  openGraph: {
    title: "Loopify: the daily loop for teams",
    description: "Plan your day, capture conversations into task cards, and roll unfinished work into tomorrow.",
    type: "website",
  },
};

export default function Home() {
  return (
    <div className="flex min-h-svh flex-col overflow-x-clip">
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <SocialProof />
        <Features />
        <HowItWorks />
        <ManagerInsights />
        <Pricing />
        <Faq />
        <CtaBand />
      </main>
      <SiteFooter />
    </div>
  );
}
