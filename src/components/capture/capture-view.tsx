"use client";

import { AnimatedSparkles } from "@/components/brand/animated-icons";
import {
  IconAlertTriangle,
  IconBrandGoogleDrive,
  IconLayoutKanban,
  IconMicrophone,
  IconPencil,
  IconUpload,
  IconNotes,
  IconRefresh,
  IconSparkles,
  IconUsers,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";
import { useShell } from "@/components/app/shell-context";
import { MeetingBotPanel } from "@/components/capture/meeting-bot-panel";
import { SuggestionCard } from "@/components/capture/suggestion-card";
import { PageBody, PageHeader } from "@/components/common/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Item, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { errorMessage, useTRPC } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

const SOURCE_ICON = {
  TEXT: IconNotes,
  VOICE: IconMicrophone,
  MOBILE: IconMicrophone,
  MEETING: IconUsers,
  EMAIL: IconNotes,
} as const;

export function CaptureView() {
  const trpc = useTRPC();
  const router = useRouter();
  const pathname = usePathname();
  const selected = useSearchParams().get("id");
  const { openCapture } = useShell();
  const list = useQuery(trpc.capture.list.queryOptions({ limit: 30 }));
  const status = useQuery(trpc.capture.status.queryOptions());
  const activeId = selected ?? list.data?.[0]?.id ?? null;

  return (
    <PageBody className="max-w-7xl">
      <PageHeader
        title="Capture"
        description="Everything you talked about, turned into cards you can accept with one tap."
        actions={
          <Button onClick={() => openCapture()}>
            <IconSparkles />
            New capture
          </Button>
        }
      />

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(
          [
            { tab: "record", icon: IconMicrophone, title: "Record a meeting", text: "Live transcript in your browser" },
            {
              tab: "drive",
              icon: IconBrandGoogleDrive,
              title: "Import from Drive",
              text: "Meet transcripts, Docs, Sheets",
            },
            { tab: "upload", icon: IconUpload, title: "Upload a transcript", text: "Zoom, Teams, .vtt, .srt, .txt" },
            { tab: "write", icon: IconPencil, title: "Write or paste", text: "Notes, recaps, emails" },
          ] as const
        ).map((s) => (
          <button
            key={s.tab}
            type="button"
            onClick={() => openCapture(s.tab)}
            className="group flex items-start gap-3 rounded-2xl border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-md"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <s.icon className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{s.title}</span>
              <span className="block text-xs text-muted-foreground">{s.text}</span>
            </span>
          </button>
        ))}
      </div>

      <MeetingBotPanel />

      {status.data && !status.data.aiConfigured && (
        <Alert className="mt-6">
          <IconAlertTriangle />
          <AlertTitle>Running without AI</AlertTitle>
          <AlertDescription>
            Add AI_API_KEY to your .env to use Grok. Until then, Loopify picks out action-sounding lines on its own.
          </AlertDescription>
        </Alert>
      )}

      {list.isLoading ? (
        <div className="mt-8 grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <Skeleton className="h-96 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      ) : !list.data?.length ? (
        <Empty className="mt-8 rounded-2xl border border-dashed py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon" className="size-14 rounded-2xl bg-brand-soft text-brand">
              <AnimatedSparkles className="size-8" trigger="loop" />
            </EmptyMedia>
            <EmptyTitle>Nothing captured yet</EmptyTitle>
            <EmptyDescription>
              Had a call, a hallway chat or a standup? Paste what was said and get the action items out of it.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => openCapture()}>Capture a conversation</Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <nav aria-label="Captures" className="space-y-1.5">
            {list.data.map((capture) => {
              const Icon = SOURCE_ICON[capture.source];
              return (
                <Item
                  key={capture.id}
                  asChild
                  variant={capture.id === activeId ? "muted" : "default"}
                  size="sm"
                  className={cn("cursor-pointer rounded-xl", capture.id === activeId && "ring-2 ring-primary/30")}
                >
                  <button
                    type="button"
                    onClick={() => router.replace(`${pathname}?id=${capture.id}`, { scroll: false })}
                    className="w-full text-left"
                  >
                    <Icon className="size-4 shrink-0 text-muted-foreground" />
                    <ItemContent className="min-w-0">
                      <ItemTitle className="w-full truncate">{capture.title ?? capture.rawText.slice(0, 60)}</ItemTitle>
                      <ItemDescription>
                        {formatDistanceToNowStrict(capture.createdAt, { addSuffix: true })}
                      </ItemDescription>
                    </ItemContent>
                    {capture.status === "PROCESSING" || capture.status === "PENDING" ? (
                      <Spinner />
                    ) : capture._count.suggestions > 0 ? (
                      <Badge variant="highlight">{capture._count.suggestions}</Badge>
                    ) : null}
                  </button>
                </Item>
              );
            })}
          </nav>
          {activeId && <CaptureDetail captureId={activeId} />}
        </div>
      )}
    </PageBody>
  );
}

function CaptureDetail({ captureId }: { captureId: string }) {
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const capture = useQuery({
    ...trpc.capture.get.queryOptions({ captureId }),
    refetchInterval: (q) => (q.state.data && ["PENDING", "PROCESSING"].includes(q.state.data.status) ? 1500 : false),
  });
  const boards = useQuery(trpc.board.list.queryOptions());
  const members = useQuery(trpc.org.members.queryOptions());
  const retry = useMutation(
    trpc.capture.retry.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: trpc.capture.get.queryKey({ captureId }) }),
      onError: (e) => toast.error(errorMessage(e)),
    }),
  );

  const addAll = useMutation(
    trpc.capture.addAllToMyBoard.mutationOptions({
      onSuccess: ({ added, boardId }) => {
        void queryClient.invalidateQueries({ queryKey: trpc.capture.get.queryKey({ captureId }) });
        void queryClient.invalidateQueries({ queryKey: trpc.board.get.queryKey() });
        toast.success(`${added} ${added === 1 ? "to-do" : "to-dos"} added to My board`, {
          action: boardId ? { label: "Open", onClick: () => router.push(`/boards/${boardId}`) } : undefined,
        });
      },
      onError: (e) => toast.error(errorMessage(e)),
    }),
  );

  // Keep the sidebar count in step as suggestions are handled.
  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: trpc.capture.list.queryKey() });
  }, [capture.data?.status, queryClient, trpc]);

  if (!capture.data) return <Skeleton className="h-96 rounded-2xl" />;
  const data = capture.data;
  const pending = data.suggestions.filter((s) => s.status === "PENDING");
  const handled = data.suggestions.filter((s) => s.status !== "PENDING");

  return (
    <section className="min-w-0 space-y-6">
      <div>
        <h2 className="text-xl font-bold">{data.title ?? "Capture"}</h2>
        {data.toMyBoard && (
          <Badge variant="secondary" className="mt-1">
            <IconLayoutKanban /> Action items go straight to My board
          </Badge>
        )}
        <details className="mt-2 rounded-xl bg-muted/50 p-3 text-sm">
          <summary className="cursor-pointer text-muted-foreground">What was said</summary>
          <p className="mt-2 whitespace-pre-wrap">{data.rawText}</p>
        </details>
      </div>

      {data.status === "PENDING" || data.status === "PROCESSING" ? (
        <div className="flex items-center gap-3 rounded-2xl border border-dashed p-8 text-muted-foreground">
          <Spinner /> Reading through it and pulling out action items...
        </div>
      ) : data.status === "FAILED" ? (
        <Alert variant="destructive">
          <IconAlertTriangle />
          <AlertTitle>Couldn&apos;t read this capture</AlertTitle>
          <AlertDescription>
            {data.error}
            <Button size="sm" variant="outline" className="mt-2" onClick={() => retry.mutate({ captureId })}>
              <IconRefresh /> Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : pending.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
          {data.suggestions.length ? "All handled. Nice and tidy." : "No action items found in this one."}
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-heading font-semibold">
              {pending.length} suggested {pending.length === 1 ? "card" : "cards"}
            </h3>
            <Button size="sm" onClick={() => addAll.mutate({ captureId })} disabled={addAll.isPending}>
              {addAll.isPending ? <Spinner /> : <IconLayoutKanban />}
              Add all to My board
            </Button>
          </div>
          {pending.map((s) => (
            <SuggestionCard
              key={s.id}
              suggestion={s}
              captureId={captureId}
              boards={boards.data ?? []}
              members={members.data?.map((m) => m.user) ?? []}
            />
          ))}
        </div>
      )}

      {handled.length > 0 && (
        <div className="space-y-1.5">
          <h3 className="text-sm font-semibold text-muted-foreground">Handled</h3>
          {handled.map((s) => (
            <p
              key={s.id}
              className={cn("text-sm", s.status === "DISMISSED" ? "text-muted-foreground line-through" : "")}
            >
              {s.status === "ACCEPTED" ? "✓ " : ""}
              {s.title}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
