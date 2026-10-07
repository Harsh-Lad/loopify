import type { Metadata } from "next";
import Link from "next/link";
import { AnimatedShield } from "@/components/brand/animated-icons";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { SignOutButton } from "./sign-out-button";

export const metadata: Metadata = { title: "Workspace suspended" };

export default function SuspendedPage() {
  return (
    <div className="honeycomb flex min-h-svh flex-col px-4 py-8 sm:px-8">
      <Logo />
      <main className="flex flex-1 items-center justify-center py-12">
        <div className="flex w-full max-w-lg flex-col items-center gap-5 rounded-3xl border bg-card p-6 text-center shadow-[0_24px_60px_-30px_rgb(0_0_0/0.35)] sm:p-10">
          <div className="flex size-20 items-center justify-center rounded-full bg-brand-soft text-brand">
            <AnimatedShield trigger="loop" className="size-11" />
          </div>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight text-balance sm:text-3xl">
            This workspace has been suspended
          </h1>
          <p className="text-pretty text-muted-foreground">
            Access to your organization has been paused by the Loopify team, so its boards, plans and reports are
            unavailable for now. Your data has not been deleted.
          </p>
          <p className="text-sm text-pretty text-muted-foreground">
            If you think this is a mistake, ask your workspace owner to contact Loopify support. You can still switch to
            another organization or create a new one.
          </p>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button asChild size="lg" className="h-11 px-6">
              <Link href="/onboarding?new=1">Switch organization</Link>
            </Button>
            <SignOutButton />
          </div>
        </div>
      </main>
    </div>
  );
}
