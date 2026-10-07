import { IconAlertTriangle } from "@tabler/icons-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "./site-footer";

/** Minimal marketing chrome for static legal pages: logo header, prose body, shared footer. */
export function LegalShell({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col overflow-x-clip">
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" aria-label="Loopify home">
            <Logo />
          </Link>
          <Button asChild variant="ghost" size="sm">
            <Link href="/sign-in">Sign in</Link>
          </Button>
        </div>
      </header>
      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
          <h1 className="font-heading text-4xl font-extrabold tracking-tight sm:text-5xl">{title}</h1>
          <p className="mt-3 text-sm text-muted-foreground">Last updated: {updated}</p>
          <div className="mt-8 flex gap-3 rounded-2xl border border-primary/50 bg-brand-soft p-4 text-sm">
            <IconAlertTriangle className="mt-0.5 size-4 shrink-0 text-brand" />
            <p>
              <strong>Draft placeholder.</strong> This document is a template and has not been reviewed by legal
              counsel. It must be reviewed and approved before Loopify is offered publicly.
            </p>
          </div>
          <div className="mt-10 flex flex-col gap-8 text-[15px] leading-relaxed text-foreground/85 [&_h2]:font-heading [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_p+p]:mt-3 [&_section]:flex [&_section]:flex-col [&_section]:gap-3 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5">
            {children}
          </div>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
