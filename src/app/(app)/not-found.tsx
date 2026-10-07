import Link from "next/link";
import { AnimatedCompass } from "@/components/brand/animated-icons";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

export default function AppNotFound() {
  return (
    <div className="flex flex-1 items-center justify-center p-4 sm:p-8">
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia className="flex size-20 items-center justify-center rounded-full bg-brand-soft text-brand">
            <AnimatedCompass trigger="loop" className="size-11" />
          </EmptyMedia>
          <EmptyTitle className="text-xl font-bold">We couldn&apos;t find that</EmptyTitle>
          <EmptyDescription>
            This page flew off, or you don&apos;t have access to it in this workspace. Check the link or head back to
            your day.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex flex-col gap-2 min-[420px]:flex-row">
            <Button asChild>
              <Link href="/today">Open Today</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard">Go to dashboard</Link>
            </Button>
          </div>
        </EmptyContent>
      </Empty>
    </div>
  );
}
