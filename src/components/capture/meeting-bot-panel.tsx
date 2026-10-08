"use client";

import { IconCalendarDue, IconDoorExit, IconRobot, IconUser } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNowStrict } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { errorMessage, useTRPC } from "@/lib/trpc/client";

type Status =
  | "QUEUED"
  | "CLAIMED"
  | "JOINING"
  | "WAITING_ADMIT"
  | "RECORDING"
  | "TRANSCRIBING"
  | "EXTRACTING"
  | "DONE"
  | "FAILED";

const STATUS: Record<Status, { label: string; variant: "secondary" | "outline" | "highlight" | "success" | "destructive" }> =
  {
    QUEUED: { label: "Joining", variant: "secondary" },
    CLAIMED: { label: "Joining", variant: "secondary" },
    JOINING: { label: "Joining", variant: "secondary" },
    WAITING_ADMIT: { label: "Waiting to be let in", variant: "outline" },
    RECORDING: { label: "Recording", variant: "highlight" },
    TRANSCRIBING: { label: "Transcribing", variant: "secondary" },
    EXTRACTING: { label: "Finding action items", variant: "secondary" },
    DONE: { label: "Done", variant: "success" },
    FAILED: { label: "Failed", variant: "destructive" },
  };

const isActive = (status: Status) => status !== "DONE" && status !== "FAILED";

const minutes = (sec: number | null) => (sec ? `${Math.max(1, Math.round(sec / 60))} min` : null);

/** Send the Loop bot into a Google Meet and follow it until the notes are ready. */
export function MeetingBotPanel() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [meetUrl, setMeetUrl] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const jobs = useQuery({
    ...trpc.meetingBot.listJobs.queryOptions(),
    refetchInterval: (q) => (q.state.data?.some((j) => isActive(j.status)) ? 5000 : false),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: trpc.meetingBot.listJobs.queryKey() });

  const send = useMutation(
    trpc.meetingBot.sendBot.mutationOptions({
      onSuccess: () => {
        setMeetUrl("");
        toast.success("Loop bot is on its way. Let it in when it asks to join.");
        void refresh();
      },
      onError: (e) => toast.error(errorMessage(e)),
    }),
  );
  const cancel = useMutation(
    trpc.meetingBot.cancelBot.mutationOptions({
      onSuccess: () => {
        toast.success("The bot will leave within 30 seconds.");
        void refresh();
      },
      onError: (e) => toast.error(errorMessage(e)),
    }),
  );

  return (
    <Card className="mt-6 rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconRobot className="size-5 text-brand" /> Loop bot
        </CardTitle>
        <CardDescription>
          Sends a notetaker into your Google Meet. When the call ends, its action items land in To do.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (meetUrl.trim()) send.mutate({ meetUrl: meetUrl.trim() });
          }}
        >
          <Input
            value={meetUrl}
            onChange={(e) => setMeetUrl(e.target.value)}
            placeholder="https://meet.google.com/abc-defg-hij"
            aria-label="Google Meet link"
            inputMode="url"
          />
          <Button type="submit" disabled={send.isPending || !meetUrl.trim()}>
            {send.isPending ? <Spinner /> : <IconRobot />}
            Send Loop bot
          </Button>
        </form>

        {jobs.isLoading ? (
          <Skeleton className="h-16 rounded-xl" />
        ) : jobs.data?.length ? (
          <div className="space-y-1.5">
            {jobs.data.map((job) => {
              const status = STATUS[job.status];
              const done = job.status === "DONE";
              const details = [
                formatDistanceToNowStrict(job.createdAt, { addSuffix: true }),
                minutes(job.durationSec),
                done ? `${job.actionItemCount} action ${job.actionItemCount === 1 ? "item" : "items"}` : null,
              ].filter(Boolean);
              const content = (
                <>
                  <ItemContent className="min-w-0">
                    <ItemTitle className="w-full truncate">{job.title ?? job.meetUrl.replace("https://", "")}</ItemTitle>
                    <ItemDescription>
                      {job.status === "FAILED" && job.error ? job.error : details.join(" · ")}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    {job.status === "RECORDING" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={job.cancelRequested || cancel.isPending}
                        onClick={() => cancel.mutate({ id: job.id })}
                      >
                        <IconDoorExit />
                        {job.cancelRequested ? "Leaving..." : "Make it leave"}
                      </Button>
                    )}
                    <Badge variant={status.variant}>
                      {isActive(job.status) && <Spinner className="size-3" />}
                      {status.label}
                    </Badge>
                  </ItemActions>
                </>
              );
              return done ? (
                <Item key={job.id} asChild variant="outline" size="sm" className="cursor-pointer rounded-xl">
                  <button type="button" className="w-full text-left" onClick={() => setOpenId(job.id)}>
                    {content}
                  </button>
                </Item>
              ) : (
                <Item key={job.id} variant="outline" size="sm" className="rounded-xl">
                  {content}
                </Item>
              );
            })}
          </div>
        ) : null}
      </CardContent>

      <Sheet open={openId !== null} onOpenChange={(open) => !open && setOpenId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {openId && <MeetingNotes id={openId} />}
        </SheetContent>
      </Sheet>
    </Card>
  );
}

function MeetingNotes({ id }: { id: string }) {
  const trpc = useTRPC();
  const job = useQuery(trpc.meetingBot.getJob.queryOptions({ id }));

  if (!job.data) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-40" />
      </div>
    );
  }
  const { result, transcript } = job.data;
  const translations = new Map(result?.translations.map((t) => [t.i, t.en]) ?? []);

  return (
    <>
      <SheetHeader>
        <SheetTitle>{result?.title || job.data.title || "Meeting"}</SheetTitle>
        <SheetDescription>
          {format(job.data.createdAt, "d MMM yyyy, h:mm a")}
          {job.data.durationSec ? ` · ${minutes(job.data.durationSec)}` : ""}
        </SheetDescription>
      </SheetHeader>

      <div className="space-y-6 px-4 pb-6 text-sm">
        {result?.summary && <p>{result.summary}</p>}

        {!!result?.decisions.length && (
          <section className="space-y-2">
            <h3 className="font-heading font-semibold">Decisions</h3>
            <ul className="list-disc space-y-1 pl-5">
              {result.decisions.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </section>
        )}

        <section className="space-y-2">
          <h3 className="font-heading font-semibold">Action items</h3>
          {result?.actionItems.length ? (
            result.actionItems.map((a, i) => (
              <div key={i} className="rounded-xl border p-3">
                <p className="font-medium">{a.title}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <Badge variant="outline">
                    <IconUser /> {a.owner ?? "Unassigned"}
                  </Badge>
                  {a.due && (
                    <Badge variant="outline">
                      <IconCalendarDue /> {format(new Date(`${a.due}T00:00:00`), "EEE d MMM")}
                    </Badge>
                  )}
                  {a.team !== "other" && <Badge variant="secondary">{a.team}</Badge>}
                </div>
                {a.quote && <p className="mt-2 text-xs italic text-muted-foreground">&ldquo;{a.quote}&rdquo;</p>}
              </div>
            ))
          ) : (
            <p className="text-muted-foreground">No action items in this one.</p>
          )}
        </section>

        {transcript.length > 0 && (
          <section className="space-y-2">
            <h3 className="font-heading font-semibold">Transcript</h3>
            <div className="space-y-3">
              {transcript.map((u, i) => (
                <div key={i}>
                  <p>
                    <span className="mr-2 font-mono text-xs text-muted-foreground">
                      S{u.speaker} {Math.floor(u.start / 60)}:{String(Math.floor(u.start % 60)).padStart(2, "0")}
                    </span>
                    {u.text}
                  </p>
                  {translations.has(i) && <p className="mt-0.5 text-muted-foreground">{translations.get(i)}</p>}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
