"use client";

import { AnimatedChartBars } from "@/components/brand/animated-icons";
import { IconArrowLeft, IconBrandGoogle, IconMessagePlus, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageBody } from "@/components/common/page-header";
import { ChatPane } from "@/components/sheets/chat-pane";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useTRPC } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

const STARTERS = [
  "Show me my most recently edited sheets",
  "Create a sheet called Q4 Outreach with Name, Company, Email, Status",
  "Find duplicate emails across my leads sheets",
];

export function SheetsChat() {
  const trpc = useTRPC();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session");

  const status = useQuery(trpc.sheets.status.queryOptions());
  const sessions = useQuery(trpc.sheets.sessions.queryOptions());

  const create = useMutation(
    trpc.sheets.createSession.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: trpc.sheets.sessions.queryKey() }),
    }),
  );
  const remove = useMutation(
    trpc.sheets.deleteSession.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: trpc.sheets.sessions.queryKey() });
        router.replace(pathname);
      },
    }),
  );

  const startChat = (prompt?: string) =>
    create.mutate(undefined, {
      onSuccess: (s) =>
        router.replace(`${pathname}?session=${s.id}${prompt ? `&q=${encodeURIComponent(prompt)}` : ""}`),
    });

  if (!status.data)
    return (
      <PageBody>
        <Skeleton className="h-96 rounded-2xl" />
      </PageBody>
    );

  if (!status.data.connected) {
    return (
      <PageBody>
        <Empty className="rounded-2xl border border-dashed py-20">
          <EmptyHeader>
            <EmptyMedia variant="icon" className="size-14 rounded-2xl bg-brand-soft text-brand">
              <AnimatedChartBars className="size-8" trigger="loop" />
            </EmptyMedia>
            <EmptyTitle>Talk to your Google Sheets</EmptyTitle>
            <EmptyDescription>
              Ask for rows, add entries, or build a new sheet in plain English. Every change waits for your approval,
              and can be undone.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            {status.data.googleConfigured ? (
              <Button asChild>
                <a href="/api/integrations/google/connect?returnTo=/sheets">
                  <IconBrandGoogle />
                  Connect Google
                </a>
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">
                An admin needs to add the Google client ID and secret to the server first.
              </p>
            )}
          </EmptyContent>
        </Empty>
      </PageBody>
    );
  }

  return (
    <div className="grid h-[calc(100svh-3.5rem)] min-h-0 overflow-hidden md:h-[calc(100svh-4.5rem)] md:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="hidden flex-col border-r md:flex">
        <div className="space-y-1 p-3">
          <Button asChild className="w-full justify-start" variant="ghost" size="sm">
            <Link href="/sheets">
              <IconArrowLeft />
              All sheets
            </Link>
          </Button>
          <Button className="w-full" variant="outline" onClick={() => startChat()} disabled={create.isPending}>
            <IconMessagePlus />
            New chat
          </Button>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          <ul className="space-y-0.5 px-2 pb-3">
            {sessions.data?.map((s) => (
              <li key={s.id} className="group flex items-center">
                <button
                  type="button"
                  onClick={() => router.replace(`${pathname}?session=${s.id}`)}
                  className={cn(
                    "flex-1 truncate rounded-lg px-3 py-2 text-left text-sm hover:bg-muted",
                    s.id === sessionId && "bg-muted font-medium",
                  )}
                >
                  {s.title}
                </button>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  className="opacity-0 group-hover:opacity-100"
                  aria-label="Delete chat"
                  onClick={() => remove.mutate({ sessionId: s.id })}
                >
                  <IconTrash />
                </Button>
              </li>
            ))}
          </ul>
        </ScrollArea>
        {status.data.accountEmail && (
          <p className="border-t px-4 py-3 text-xs text-muted-foreground">Connected as {status.data.accountEmail}</p>
        )}
      </aside>
      {sessionId ? (
        <ChatPane
          key={sessionId}
          sessionId={sessionId}
          aiConfigured={status.data.aiConfigured}
          initialDraft={searchParams.get("q") ?? ""}
          suggestions={STARTERS}
        />
      ) : (
        <div className="grid place-items-center p-8">
          <div className="max-w-md text-center">
            <h1 className="text-2xl font-bold">What should we do in your sheets?</h1>
            <div className="mt-6 grid gap-2">
              {STARTERS.map((s) => (
                <Button
                  key={s}
                  variant="outline"
                  className="h-auto justify-start py-3 text-left whitespace-normal"
                  onClick={() => startChat(s)}
                >
                  {s}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
