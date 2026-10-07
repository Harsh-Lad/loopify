"use client";

import {
  IconArrowBackUp,
  IconArrowUp,
  IconAt,
  IconCheck,
  IconChecks,
  IconEraser,
  IconExternalLink,
  IconFilePlus,
  IconLayoutGridAdd,
  IconPencil,
  IconRowInsertBottom,
  IconSparkles,
  IconTable,
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import Link from "next/link";
import { useEffect, useRef, useState, type ComponentType } from "react";
import { toast } from "sonner";
import { ChatMarkdown } from "@/components/sheets/chat-markdown";
import { SheetMentionPicker, type SheetMention } from "@/components/sheets/sheet-mention-picker";
import { Badge } from "@/components/ui/badge";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "@/components/ui/input-group";
import { Message, MessageAvatar, MessageContent, MessageFooter } from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { errorMessage, useTRPC, type RouterOutputs } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

type Session = RouterOutputs["sheets"]["session"];
type Operation = Session["operations"][number];

const MENTION = /@\[([^\]]*)\]\(sheet:([\w-]+)\)/g;

/** Splits a stored user message into its tagged sheets and the text. */
function parseMentions(content: string) {
  const sheets: SheetMention[] = [];
  for (const match of content.matchAll(MENTION)) sheets.push({ title: match[1] ?? "", id: match[2] ?? "" });
  return { sheets, text: content.replace(MENTION, "").trim() };
}

/**
 * A chat thread about Google Sheets. Type @ (or tap the @ button) to tag one or
 * more sheets, or create a new one. Edits to existing sheets wait for approval;
 * new spreadsheets are created straight away.
 */
export function ChatPane({
  sessionId,
  aiConfigured,
  initialDraft = "",
  onSheetChanged,
  contextTitle,
  suggestions = [],
  placeholder = "Ask anything, or type @ to bring in sheets",
}: {
  sessionId: string;
  aiConfigured: boolean;
  initialDraft?: string;
  /** Called after a change is applied or undone, so an open editor can reload. */
  onSheetChanged?: () => void;
  /** The sheet that's open next to the chat, if any. */
  contextTitle?: string;
  suggestions?: string[];
  placeholder?: string;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const session = useQuery(trpc.sheets.session.queryOptions({ sessionId }));
  const [draft, setDraft] = useState(initialDraft);
  const [mentions, setMentions] = useState<SheetMention[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [optimistic, setOptimistic] = useState<string | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: trpc.sheets.session.queryKey({ sessionId }) });

  const send = useMutation(
    trpc.sheets.send.mutationOptions({
      onSettled: async () => {
        await refresh();
        setOptimistic(null);
        void queryClient.invalidateQueries({ queryKey: trpc.sheets.sessions.queryKey() });
        void queryClient.invalidateQueries({ queryKey: trpc.sheets.browse.queryKey() });
      },
      onError: (e) => toast.error(errorMessage(e)),
    }),
  );

  const submit = (text = draft) => {
    const message = text.trim();
    if ((!message && !mentions.length) || send.isPending) return;
    const tags = mentions.map((m) => `@[${m.title}](sheet:${m.id})`).join(" ");
    setOptimistic([tags, message].filter(Boolean).join(" "));
    setDraft("");
    send.mutate({ sessionId, message, mentions });
    setMentions([]);
  };

  const toggleMention = (sheet: SheetMention) =>
    setMentions((prev) =>
      prev.some((m) => m.id === sheet.id) ? prev.filter((m) => m.id !== sheet.id) : [...prev, sheet],
    );

  const closePicker = (open: boolean) => {
    setPickerOpen(open);
    if (!open) requestAnimationFrame(() => textarea.current?.focus());
  };

  const timeline = [
    ...(session.data?.messages ?? [])
      .filter((m) => m.content.trim())
      .map((m) => ({ kind: "message" as const, id: m.id, at: m.createdAt, m })),
    ...(session.data?.operations ?? []).map((op) => ({ kind: "op" as const, id: op.id, at: op.createdAt, op })),
  ].sort((a, b) => +new Date(a.at) - +new Date(b.at));
  const pending = session.data?.operations.filter((op) => op.status === "PROPOSED") ?? [];
  const empty = session.data && timeline.length === 0 && !optimistic;

  const changed = () => {
    void refresh();
    onSheetChanged?.();
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <MessageScrollerProvider autoScroll defaultScrollPosition="end">
        <MessageScroller className="min-h-0 flex-1">
          <MessageScrollerViewport>
            <MessageScrollerContent className="mx-auto w-full max-w-3xl gap-5 px-4 py-5">
              {!aiConfigured && (
                <p className="rounded-xl bg-highlight/20 p-3 text-sm">
                  Sheets chat needs an AI key. Add AI_API_KEY to the server&apos;s .env.
                </p>
              )}
              {!session.data && !session.isError && (
                <div className="space-y-4">
                  <Skeleton className="ml-auto h-10 w-2/3 rounded-3xl" />
                  <Skeleton className="h-24 w-4/5 rounded-3xl" />
                </div>
              )}
              {session.isError && <p className="text-sm text-destructive">{errorMessage(session.error)}</p>}
              {empty && (
                <EmptyChat
                  contextTitle={contextTitle}
                  suggestions={suggestions}
                  onPick={(s) => submit(s)}
                  onMention={() => setPickerOpen(true)}
                />
              )}
              {timeline.map((entry) => (
                <MessageScrollerItem key={entry.id} messageId={entry.id}>
                  {entry.kind === "message" ? (
                    entry.m.role === "USER" ? (
                      <UserMessage content={entry.m.content} at={entry.m.createdAt} />
                    ) : (
                      <AssistantMessage content={entry.m.content} />
                    )
                  ) : (
                    <OperationCard op={entry.op} onChange={changed} />
                  )}
                </MessageScrollerItem>
              ))}
              {optimistic && (
                <MessageScrollerItem messageId="optimistic" scrollAnchor>
                  <UserMessage content={optimistic} />
                </MessageScrollerItem>
              )}
              {send.isPending && (
                <MessageScrollerItem messageId="thinking">
                  <Thinking />
                </MessageScrollerItem>
              )}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>

      <div className="shrink-0 space-y-2 bg-gradient-to-t from-background via-background to-background/0 px-3 pt-1 pb-3">
        {pending.length > 1 && <ApproveAllBar pending={pending} onDone={changed} />}
        <SheetMentionPicker open={pickerOpen} onOpenChange={closePicker} selected={mentions} onToggle={toggleMention}>
          <InputGroup className="mx-auto max-w-3xl rounded-2xl bg-background shadow-sm has-[[data-slot=input-group-control]:focus-visible]:ring-[3px]">
            {(mentions.length > 0 || contextTitle) && (
              <InputGroupAddon align="block-start" className="flex-wrap gap-1.5 pb-0">
                {contextTitle && mentions.length === 0 && (
                  <span className="inline-flex max-w-full items-center gap-1.5 truncate text-xs text-muted-foreground">
                    <IconTable className="size-3.5 text-success" />
                    Talking about <strong className="truncate font-medium text-foreground">{contextTitle}</strong>
                  </span>
                )}
                {mentions.map((m) => (
                  <MentionChip key={m.id} title={m.title} onRemove={() => toggleMention(m)} />
                ))}
              </InputGroupAddon>
            )}
            <InputGroupTextarea
              ref={textarea}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                const el = e.currentTarget;
                const before = el.value.slice(0, el.selectionStart ?? 0);
                if (e.key === "@" && (!before || /\s$/.test(before))) {
                  e.preventDefault();
                  setPickerOpen(true);
                } else if (e.key === "Backspace" && !el.value && mentions.length) {
                  setMentions((prev) => prev.slice(0, -1));
                } else if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder={placeholder}
              rows={1}
              className="max-h-40 min-h-11"
              aria-label="Message"
            />
            <InputGroupAddon align="block-end" className="gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <InputGroupButton
                    size="sm"
                    variant="ghost"
                    onClick={() => setPickerOpen(true)}
                    className="text-muted-foreground"
                  >
                    <IconAt />
                    Sheets
                  </InputGroupButton>
                </TooltipTrigger>
                <TooltipContent>Tag sheets to work across, or create one</TooltipContent>
              </Tooltip>
              <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">
                Enter to send, Shift+Enter for a new line
              </span>
              <InputGroupButton
                size="icon-sm"
                variant="default"
                className="ml-2 rounded-full transition-transform active:scale-90"
                aria-label="Send"
                onClick={() => submit()}
                disabled={(!draft.trim() && !mentions.length) || send.isPending}
              >
                {send.isPending ? <Spinner /> : <IconArrowUp />}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </SheetMentionPicker>
      </div>
    </div>
  );
}

function MentionChip({ title, onRemove }: { title: string; onRemove?: () => void }) {
  return (
    <span className="inline-flex max-w-56 items-center gap-1 rounded-full border bg-success/10 py-0.5 pr-1 pl-2 text-xs font-medium text-foreground animate-in fade-in zoom-in-95">
      <IconTable className="size-3.5 shrink-0 text-success" />
      <span className="truncate">{title}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${title}`}
          className="grid size-4 place-items-center rounded-full text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
        >
          <IconX className="size-3" />
        </button>
      )}
    </span>
  );
}

function EmptyChat({
  contextTitle,
  suggestions,
  onPick,
  onMention,
}: {
  contextTitle?: string;
  suggestions: string[];
  onPick: (prompt: string) => void;
  onMention: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-brand animate-in zoom-in-50">
        <IconSparkles className="size-6" />
      </span>
      <h2 className="mt-4 font-heading text-xl font-bold text-balance">
        {contextTitle ? "What should we do with this sheet?" : "What should we do in your sheets?"}
      </h2>
      <p className="mt-1 max-w-sm text-sm text-pretty text-muted-foreground">
        Ask questions, clean data, or move rows around. Type{" "}
        <button type="button" onClick={onMention} className="font-medium text-brand hover:underline">
          @
        </button>{" "}
        to work across several sheets or create a new one.
      </p>
      {suggestions.length > 0 && (
        <div className="mt-5 flex max-w-md flex-wrap justify-center gap-2">
          {suggestions.map((s) => (
            <Button
              key={s}
              variant="outline"
              size="sm"
              className="h-auto rounded-full py-1.5 whitespace-normal transition-transform hover:-translate-y-0.5"
              onClick={() => onPick(s)}
            >
              {s}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

function UserMessage({ content, at }: { content: string; at?: Date | string }) {
  const { sheets, text } = parseMentions(content);
  return (
    <Message align="end">
      <MessageContent>
        {sheets.length > 0 && (
          <div className="flex flex-wrap justify-end gap-1.5">
            {sheets.map((s) => (
              <Link key={s.id} href={`/sheets/${s.id}`} className="transition-opacity hover:opacity-80">
                <MentionChip title={s.title} />
              </Link>
            ))}
          </div>
        )}
        {text && (
          <Bubble variant="default" align="end">
            <BubbleContent className="rounded-br-lg whitespace-pre-wrap">{text}</BubbleContent>
          </Bubble>
        )}
        {at && (
          <MessageFooter className="opacity-0 transition-opacity group-hover/message:opacity-100">
            {format(new Date(at), "h:mm a")}
          </MessageFooter>
        )}
      </MessageContent>
    </Message>
  );
}

function AssistantMessage({ content }: { content: string }) {
  return (
    <Message>
      <MessageAvatar className="size-7 min-w-7 self-start bg-primary/10 text-brand">
        <IconSparkles className="size-4" />
      </MessageAvatar>
      <MessageContent>
        <Bubble variant="ghost" className="max-w-full pt-0.5">
          <BubbleContent className="w-full">
            <ChatMarkdown>{content}</ChatMarkdown>
          </BubbleContent>
        </Bubble>
      </MessageContent>
    </Message>
  );
}

const THINKING = ["Reading your sheets", "Working it out", "Checking the numbers", "Almost there"];

function Thinking() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep((s) => (s + 1) % THINKING.length), 2200);
    return () => clearInterval(id);
  }, []);
  return (
    <Message>
      <MessageAvatar className="size-7 min-w-7 self-start bg-primary/10 text-brand">
        <IconSparkles className="size-4 animate-pulse" />
      </MessageAvatar>
      <div className="flex items-center gap-2 pt-1 text-sm text-muted-foreground">
        <span className="flex gap-1" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="size-1.5 animate-bounce rounded-full bg-primary/60"
              style={{ animationDelay: `${i * 120}ms` }}
            />
          ))}
        </span>
        <span key={step} className="animate-in fade-in slide-in-from-bottom-1">
          {THINKING[step]}...
        </span>
      </div>
    </Message>
  );
}

const KIND: Record<Operation["kind"], { icon: ComponentType<{ className?: string }>; label: string }> = {
  UPDATE: { icon: IconPencil, label: "Edit cells" },
  APPEND: { icon: IconRowInsertBottom, label: "Add rows" },
  CLEAR: { icon: IconEraser, label: "Clear cells" },
  CREATE_SPREADSHEET: { icon: IconFilePlus, label: "New spreadsheet" },
  ADD_SHEET: { icon: IconLayoutGridAdd, label: "New tab" },
};

const STATUS: Record<
  Operation["status"],
  { label: string; variant: "secondary" | "success" | "destructive" | "outline" | "highlight" }
> = {
  PROPOSED: { label: "Needs your OK", variant: "highlight" },
  APPLIED: { label: "Done", variant: "success" },
  REJECTED: { label: "Skipped", variant: "outline" },
  UNDONE: { label: "Undone", variant: "outline" },
  FAILED: { label: "Failed", variant: "destructive" },
};

function OperationCard({ op, onChange }: { op: Operation; onChange: () => void }) {
  const trpc = useTRPC();
  const onError = (e: unknown) => toast.error(errorMessage(e));
  const approve = useMutation(
    trpc.sheets.approve.mutationOptions({ onSuccess: () => (onChange(), toast.success("Change applied")), onError }),
  );
  const reject = useMutation(trpc.sheets.reject.mutationOptions({ onSuccess: onChange, onError }));
  const undo = useMutation(
    trpc.sheets.undo.mutationOptions({ onSuccess: () => (onChange(), toast("Change undone")), onError }),
  );
  const [showBefore, setShowBefore] = useState(false);
  const after = Array.isArray(op.after) ? (op.after as unknown[][]) : null;
  const before = Array.isArray(op.before) ? (op.before as unknown[][]) : null;
  const spec = !Array.isArray(op.after) ? (op.after as { title?: string; tabs?: { title: string }[] } | null) : null;
  const result = op.result as { url?: string; spreadsheetId?: string } | null;
  const kind = KIND[op.kind];
  const Icon = kind.icon;
  const table = showBefore ? before : after;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border bg-card shadow-xs transition-colors animate-in fade-in slide-in-from-bottom-2",
        op.status === "PROPOSED" && "border-highlight ring-4 ring-highlight/15",
        (op.status === "REJECTED" || op.status === "UNDONE") && "opacity-70",
      )}
    >
      <div className="flex items-start gap-3 p-3.5">
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-xl",
            op.status === "APPLIED" ? "bg-success/15 text-success" : "bg-primary/10 text-brand",
          )}
        >
          <Icon className="size-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{kind.label}</span>
            <Badge variant={STATUS[op.status].variant} className="h-5">
              {op.status === "APPLIED" && <IconCheck />}
              {STATUS[op.status].label}
            </Badge>
          </div>
          <p className="mt-0.5 text-sm leading-snug font-medium text-pretty">{op.summary}</p>
          {op.range && <p className="mt-1 font-mono text-xs text-muted-foreground">{op.range}</p>}
          {spec?.title && op.kind === "CREATE_SPREADSHEET" && (
            <p className="mt-1 text-xs text-muted-foreground">
              {spec.title}
              {spec.tabs?.length ? ` · tabs: ${spec.tabs.map((t) => t.title).join(", ")}` : ""}
            </p>
          )}
        </div>
      </div>

      {table && table.length > 0 && (
        <div className="px-3.5 pb-3">
          {before && before.length > 0 && op.kind === "UPDATE" && (
            <div className="mb-2 inline-flex rounded-lg bg-muted p-0.5 text-xs">
              {[false, true].map((b) => (
                <button
                  key={String(b)}
                  type="button"
                  onClick={() => setShowBefore(b)}
                  className={cn(
                    "rounded-md px-2.5 py-1 font-medium transition-colors",
                    showBefore === b ? "bg-background shadow-xs" : "text-muted-foreground",
                  )}
                >
                  {b ? "Before" : "After"}
                </button>
              ))}
            </div>
          )}
          <div className="max-h-56 overflow-auto rounded-xl border bg-background text-xs">
            <table className="w-full">
              <tbody>
                {table.slice(0, 25).map((row, i) => (
                  <tr key={i} className="border-b last:border-0 odd:bg-muted/30">
                    <td className="w-8 border-r px-1.5 py-1 text-right text-muted-foreground tabular-nums">{i + 1}</td>
                    {row.map((cell, j) => (
                      <td key={j} className="px-2 py-1 whitespace-nowrap">
                        {String(cell ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {table.length > 25 && <p className="mt-1 text-xs text-muted-foreground">and {table.length - 25} more rows</p>}
        </div>
      )}

      {op.error && <p className="px-3.5 pb-3 text-sm text-destructive">{op.error}</p>}

      {(op.status === "PROPOSED" || op.status === "APPLIED" || result?.url) && (
        <div className="flex flex-wrap items-center gap-2 border-t bg-muted/30 px-3.5 py-2.5">
          {op.status === "PROPOSED" && (
            <>
              <Button size="sm" onClick={() => approve.mutate({ operationId: op.id })} disabled={approve.isPending}>
                {approve.isPending ? <Spinner /> : <IconCheck />}
                Approve
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => reject.mutate({ operationId: op.id })}
                disabled={reject.isPending}
              >
                <IconX />
                Skip
              </Button>
            </>
          )}
          {op.status === "APPLIED" && op.kind !== "CREATE_SPREADSHEET" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => undo.mutate({ operationId: op.id })}
              disabled={undo.isPending}
            >
              {undo.isPending ? <Spinner /> : <IconArrowBackUp />}
              Undo
            </Button>
          )}
          {op.kind === "CREATE_SPREADSHEET" && result?.spreadsheetId && (
            <Button size="sm" asChild>
              <Link href={`/sheets/${result.spreadsheetId}`}>
                <IconTable />
                Open here
              </Link>
            </Button>
          )}
          {result?.url && (
            <Button size="sm" variant="ghost" asChild>
              <a href={result.url} target="_blank" rel="noreferrer">
                <IconExternalLink />
                Google Sheets
              </a>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function ApproveAllBar({ pending, onDone }: { pending: Operation[]; onDone: () => void }) {
  const trpc = useTRPC();
  const approve = useMutation(trpc.sheets.approve.mutationOptions());
  const [running, setRunning] = useState(false);
  const run = async () => {
    setRunning(true);
    let ok = 0;
    for (const op of pending) {
      try {
        await approve.mutateAsync({ operationId: op.id });
        ok++;
      } catch (e) {
        toast.error(errorMessage(e));
      }
    }
    setRunning(false);
    onDone();
    if (ok) toast.success(`Applied ${ok} ${ok === 1 ? "change" : "changes"}`);
  };
  return (
    <div className="mx-auto flex max-w-3xl items-center gap-2 rounded-xl border border-highlight bg-highlight/15 px-3 py-2 text-sm animate-in fade-in slide-in-from-bottom-2">
      <span className="flex-1">{pending.length} changes are waiting for you</span>
      <Button size="sm" onClick={run} disabled={running}>
        {running ? <Spinner /> : <IconChecks />}
        Approve all
      </Button>
    </div>
  );
}
