"use client";

import {
  IconArchive,
  IconCalendarEvent,
  IconCheck,
  IconCopy,
  IconLink,
  IconLinkOff,
  IconSend,
  IconSunHigh,
  IconTag,
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { JSONContent } from "@tiptap/react";
import { format, formatDistanceToNowStrict } from "date-fns";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { CustomFieldInput } from "@/components/board/custom-field-input";
import { UserAvatar } from "@/components/app/user-avatar";
import { DoneCheck } from "@/components/common/done-check";
import { PRIORITIES } from "@/components/common/priority";
import { RichEditor } from "@/components/common/rich-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage, useTRPC, type RouterOutputs } from "@/lib/trpc/client";

type CardDetail = RouterOutputs["card"]["get"];

const EVENT_TEXT: Record<string, (e: CardDetail["events"][number]) => string> = {
  CREATED: () => "created this card",
  UPDATED: (e) =>
    `updated ${((e.payload as { fields?: string[] })?.fields ?? []).join(", ").replace(/Text$/, "") || "details"}`,
  MOVED: (e) => `moved it from ${(e.payload as { from?: string }).from} to ${(e.payload as { to?: string }).to}`,
  ASSIGNED: () => "changed the assignee",
  COMMENTED: () => "commented",
  COMPLETED: () => "marked it done",
  REOPENED: () => "reopened it",
  PLANNED: () => "added it to their day",
  UNPLANNED: () => "took it off their day",
  ROLLED_OVER: () => "rolled it over to the next day",
  ARCHIVED: () => "archived it",
  RESTORED: () => "restored it",
};

export function CardSheet({ cardId, onClose }: { cardId: string | null; onClose: () => void }) {
  const trpc = useTRPC();
  const card = useQuery({ ...trpc.card.get.queryOptions({ cardId: cardId ?? "" }), enabled: Boolean(cardId) });

  return (
    <Sheet open={Boolean(cardId)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-xl">
        {card.data ? (
          <CardDetailBody key={card.data.id} card={card.data} onClose={onClose} />
        ) : (
          <div className="space-y-4 p-6">
            <SheetHeader className="sr-only">
              <SheetTitle>Loading card</SheetTitle>
              <SheetDescription>Card details are loading</SheetDescription>
            </SheetHeader>
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function CardDetailBody({ card, onClose }: { card: CardDetail; onClose: () => void }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const members = useQuery(trpc.org.members.queryOptions());
  const [title, setTitle] = useState(card.title);
  const [syncedTitle, setSyncedTitle] = useState(card.title);
  const [labelDraft, setLabelDraft] = useState("");
  const [comment, setComment] = useState("");
  // Pick up renames made elsewhere (adjusting state during render, no effect needed).
  if (syncedTitle !== card.title) {
    setSyncedTitle(card.title);
    setTitle(card.title);
  }

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: trpc.card.get.queryKey({ cardId: card.id }) });
    // Every board view: the card's own board and a personal board it may be mirrored on.
    void queryClient.invalidateQueries({ queryKey: trpc.board.get.queryKey() });
    void queryClient.invalidateQueries({ queryKey: trpc.day.today.queryKey() });
  };
  const onError = (e: unknown) => toast.error(errorMessage(e));

  const update = useMutation(trpc.card.update.mutationOptions({ onSuccess: refresh, onError }));
  const move = useMutation(trpc.card.move.mutationOptions({ onSuccess: refresh, onError }));
  const setDone = useMutation(trpc.card.setDone.mutationOptions({ onSuccess: refresh, onError }));
  const plan = useMutation(
    trpc.day.plan.mutationOptions({
      onSuccess: () => {
        refresh();
        toast.success("Added to today");
      },
      onError,
    }),
  );
  const archive = useMutation(
    trpc.card.archive.mutationOptions({
      onSuccess: () => {
        refresh();
        onClose();
        toast("Card archived", {
          action: { label: "Undo", onClick: () => archive.mutate({ cardId: card.id, archived: false }) },
        });
      },
      onError,
    }),
  );
  const toPersonal = useMutation(
    trpc.card.toPersonal.mutationOptions({
      onSuccess: (result) => {
        refresh();
        toast.success(result.mode === "mirror" ? "Mirrored to your board" : "Copied to your board", {
          description:
            result.mode === "mirror" ? "It stays in sync with the team card." : "An independent copy only you can see.",
          action: { label: "Open", onClick: () => window.open(`/boards/${result.boardId}`, "_self") },
        });
      },
      onError,
    }),
  );
  const unmirror = useMutation(
    trpc.card.unmirror.mutationOptions({
      onSuccess: () => {
        refresh();
        toast("Removed from your board");
      },
      onError,
    }),
  );
  const addComment = useMutation(
    trpc.card.comment.mutationOptions({
      onSuccess: () => {
        setComment("");
        refresh();
      },
      onError,
    }),
  );

  const key = `${card.board.key}-${card.number}`;
  const done = Boolean(card.completedAt);
  const fields = (card.customFields ?? {}) as Record<string, unknown>;

  const saveTitle = () => {
    const value = title.trim();
    if (value && value !== card.title) update.mutate({ cardId: card.id, title: value });
    else setTitle(card.title);
  };

  const addLabel = () => {
    const value = labelDraft.trim();
    if (!value || card.labels.includes(value)) return setLabelDraft("");
    update.mutate({ cardId: card.id, labels: [...card.labels, value] });
    setLabelDraft("");
  };

  return (
    <>
      <SheetHeader className="gap-3 border-b px-6 pt-6 pb-4">
        <div className="flex items-center gap-2 pr-8 text-xs text-muted-foreground">
          <span className="tabular-nums">{key}</span>
          <span>in {card.board.name}</span>
          {card.source === "CAPTURE" && <Badge variant="highlight">from a capture</Badge>}
          {card.personal.isPersonal && <Badge variant="secondary">Personal</Badge>}
          {card.personal.mirrored && (
            <Badge variant="secondary">
              <IconLink /> On your board
            </Badge>
          )}
        </div>
        <div className="flex items-start gap-3">
          <DoneCheck
            className="mt-1.5"
            checked={done}
            onCheckedChange={(checked) => setDone.mutate({ cardId: card.id, done: checked })}
          />
          <SheetTitle className="sr-only">{card.title}</SheetTitle>
          <Textarea
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
            rows={1}
            aria-label="Card title"
            className="min-h-0 resize-none border-0 bg-transparent p-0 font-heading text-xl font-bold shadow-none focus-visible:ring-0 md:text-xl"
          />
        </div>
        <SheetDescription className="sr-only">Edit card details, comments and history.</SheetDescription>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => plan.mutate({ cardId: card.id })}
            disabled={plan.isPending}
          >
            <IconSunHigh />
            Add to today
          </Button>
          {!card.personal.isPersonal &&
            (card.personal.mirrored ? (
              <>
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/boards/${card.personal.boardId}`}>
                    <IconLink />
                    Open on my board
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => unmirror.mutate({ cardId: card.id })}
                  disabled={unmirror.isPending}
                >
                  <IconLinkOff />
                  Remove from my board
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => toPersonal.mutate({ cardId: card.id, mode: "mirror" })}
                disabled={toPersonal.isPending}
                title="Show this team card on your personal board, always in sync"
              >
                <IconLink />
                Mirror to my board
              </Button>
            ))}
          {!card.personal.isPersonal && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => toPersonal.mutate({ cardId: card.id, mode: "duplicate" })}
              disabled={toPersonal.isPending}
              title="Make an independent personal copy"
            >
              <IconCopy />
              Duplicate to my board
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => archive.mutate({ cardId: card.id, archived: true })}>
            <IconArchive />
            Archive
          </Button>
        </div>
      </SheetHeader>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-6 px-6 py-5">
          <dl className="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-x-3 gap-y-3 text-sm">
            <dt className="text-muted-foreground">Status</dt>
            <dd>
              <Select value={card.columnId} onValueChange={(columnId) => move.mutate({ cardId: card.id, columnId })}>
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {card.board.columns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className={`size-2 rounded-full tint-${c.color}`} style={{ background: "var(--tint)" }} />
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </dd>

            <dt className="text-muted-foreground">Assignee</dt>
            <dd>
              <Select
                value={card.assigneeId ?? "none"}
                onValueChange={(v) => update.mutate({ cardId: card.id, assigneeId: v === "none" ? null : v })}
              >
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nobody yet</SelectItem>
                  {members.data?.map((m) => (
                    <SelectItem key={m.user.id} value={m.user.id}>
                      <UserAvatar name={m.user.name} image={m.user.image} className="size-5" />
                      {m.user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </dd>

            <dt className="text-muted-foreground">Priority</dt>
            <dd>
              <Select
                value={card.priority}
                onValueChange={(v) => update.mutate({ cardId: card.id, priority: v as never })}
              >
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      <p.icon className={p.className} />
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </dd>

            <dt className="text-muted-foreground">Due</dt>
            <dd className="flex items-center gap-1">
              <Popover>
                <PopoverTrigger asChild>
                  <Button size="sm" variant="outline" className="flex-1 justify-start font-normal">
                    <IconCalendarEvent />
                    {card.dueDate ? format(card.dueDate, "EEE, d MMM yyyy") : "No due date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={card.dueDate ?? undefined}
                    onSelect={(date) => update.mutate({ cardId: card.id, dueDate: date ?? null })}
                  />
                </PopoverContent>
              </Popover>
              {card.dueDate && (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Clear due date"
                  onClick={() => update.mutate({ cardId: card.id, dueDate: null })}
                >
                  <IconX />
                </Button>
              )}
            </dd>

            <dt className="text-muted-foreground">Labels</dt>
            <dd className="flex flex-wrap items-center gap-1.5">
              {card.labels.map((label) => (
                <Badge key={label} variant="secondary" className="gap-1 pr-1">
                  {label}
                  <button
                    type="button"
                    aria-label={`Remove ${label}`}
                    className="rounded-full hover:bg-foreground/10"
                    onClick={() => update.mutate({ cardId: card.id, labels: card.labels.filter((l) => l !== label) })}
                  >
                    <IconX className="size-3" />
                  </button>
                </Badge>
              ))}
              <div className="flex items-center gap-1">
                <IconTag className="size-4 text-muted-foreground" />
                <Input
                  value={labelDraft}
                  onChange={(e) => setLabelDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addLabel())}
                  onBlur={addLabel}
                  placeholder="Add label"
                  className="h-7 w-28 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
                />
              </div>
            </dd>

            {card.board.fields.map((field) => (
              <CustomFieldRow
                key={field.id}
                field={field}
                value={fields[field.key]}
                members={members.data?.map((m) => m.user) ?? []}
                onChange={(value) => update.mutate({ cardId: card.id, customFields: { [field.key]: value } })}
              />
            ))}
          </dl>

          <div>
            <h3 className="mb-2 text-sm font-semibold">Description</h3>
            <div className="rounded-xl border p-3">
              <RichEditor
                value={
                  (card.description as JSONContent | null) ??
                  (card.descriptionText
                    ? {
                        type: "doc",
                        content: [{ type: "paragraph", content: [{ type: "text", text: card.descriptionText }] }],
                      }
                    : null)
                }
                placeholder="Add context, links, acceptance criteria. Type '-' for a list or '#' for a heading."
                onChange={(description, descriptionText) =>
                  update.mutate({ cardId: card.id, description: description as never, descriptionText })
                }
              />
            </div>
          </div>

          <Separator />

          <Tabs defaultValue="comments">
            <TabsList>
              <TabsTrigger value="comments">
                Comments {card.comments.length > 0 && `(${card.comments.length})`}
              </TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>
            <TabsContent value="comments" className="space-y-4 pt-3">
              {card.comments.map((c) => (
                <div key={c.id} className="flex gap-3">
                  <UserAvatar name={c.author.name} image={c.author.image} className="size-7" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-medium">{c.author.name}</span>{" "}
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNowStrict(c.createdAt, { addSuffix: true })}
                      </span>
                    </p>
                    <p className="mt-0.5 text-sm whitespace-pre-wrap">{c.body}</p>
                  </div>
                </div>
              ))}
              <div className="flex items-end gap-2">
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && comment.trim())
                      addComment.mutate({ cardId: card.id, body: comment });
                  }}
                  placeholder="Write a comment..."
                  rows={2}
                />
                <Button
                  size="icon"
                  aria-label="Send comment"
                  disabled={!comment.trim() || addComment.isPending}
                  onClick={() => addComment.mutate({ cardId: card.id, body: comment })}
                >
                  <IconSend />
                </Button>
              </div>
            </TabsContent>
            <TabsContent value="activity" className="pt-3">
              <ol className="relative space-y-3 border-l pl-4">
                {card.events.map((event) => (
                  <li key={event.id} className="text-sm">
                    <span className="absolute -left-[5px] mt-1.5 size-2.5 rounded-full border-2 border-background bg-primary" />
                    <span className="font-medium">{event.actor.name}</span>{" "}
                    <span className="text-muted-foreground">
                      {EVENT_TEXT[event.type]?.(event) ?? event.type.toLowerCase()}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {format(event.createdAt, "d MMM, h:mm a")}
                    </span>
                  </li>
                ))}
              </ol>
            </TabsContent>
          </Tabs>

          {done && card.completedAt && (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <IconCheck className="size-4 text-success" /> Finished {format(card.completedAt, "d MMM, h:mm a")}
            </p>
          )}
        </div>
      </ScrollArea>
    </>
  );
}

function CustomFieldRow({
  field,
  value,
  members,
  onChange,
}: {
  field: CardDetail["board"]["fields"][number];
  value: unknown;
  members: { id: string; name: string }[];
  onChange: (value: unknown) => void;
}) {
  return (
    <>
      <dt className="truncate text-muted-foreground" title={field.label}>
        {field.label}
      </dt>
      <dd>
        <CustomFieldInput field={field} value={value} members={members} onChange={onChange} />
      </dd>
    </>
  );
}
