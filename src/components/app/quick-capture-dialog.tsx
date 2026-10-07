"use client";

import {
  IconBrandGoogleDrive,
  IconFileText,
  IconMicrophone,
  IconPencil,
  IconPlayerStopFilled,
  IconSearch,
  IconSparkles,
  IconTable,
  IconUpload,
  IconUsers,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { useRouter } from "next/navigation";
import { useDeferredValue, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useShell } from "@/components/app/shell-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { errorMessage, useTRPC } from "@/lib/trpc/client";
import { stripCaptions } from "@/lib/transcripts";
import { cn } from "@/lib/utils";

const PLACEHOLDER =
  "Just got off a call with the client. They want the deck by Friday, Riya will send the pricing sheet, and I need to fix the contact form...";

type Source = "TEXT" | "VOICE" | "MEETING" | "EMAIL" | "MOBILE";

/**
 * Every way a conversation gets into Loopify: type it, record it (live
 * transcript in the browser), upload a transcript file, or import a Google
 * Meet transcript / Doc / Sheet from Drive. All of them end in suggested cards.
 */
export function QuickCaptureDialog() {
  const { captureOpen, setCaptureOpen, captureTab } = useShell();
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<string>(captureTab);
  // Each time the dialog opens, start on the tab it was opened for.
  const [openedFor, setOpenedFor] = useState({ open: captureOpen, tab: captureTab });
  if (openedFor.open !== captureOpen || openedFor.tab !== captureTab) {
    setOpenedFor({ open: captureOpen, tab: captureTab });
    if (captureOpen) setTab(captureTab);
  }

  const done = async (capture: { id: string; status: string }) => {
    await queryClient.invalidateQueries({ queryKey: trpc.capture.list.queryKey() });
    setCaptureOpen(false);
    toast.success(
      capture.status === "READY" ? "Action items found" : "Capturing. Suggestions will appear in a moment.",
      {
        action: { label: "Review", onClick: () => router.push(`/capture?id=${capture.id}`) },
      },
    );
    router.push(`/capture?id=${capture.id}`);
  };

  const create = useMutation(
    trpc.capture.create.mutationOptions({ onSuccess: done, onError: (e) => toast.error(errorMessage(e)) }),
  );
  const submit = (text: string, source: Source, title?: string) =>
    text.trim().length >= 3 && create.mutate({ text, source, title });

  return (
    <Dialog open={captureOpen} onOpenChange={setCaptureOpen}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading text-xl">
            <IconSparkles className="size-5 text-brand" />
            Capture a conversation
          </DialogTitle>
          <DialogDescription>
            Write it, record it, or bring in a meeting transcript. You&apos;ll get suggested cards to accept with one
            tap.
          </DialogDescription>
        </DialogHeader>
        <Tabs value={tab} onValueChange={setTab} className="min-w-0">
          <TabsList className="w-full sm:w-fit">
            <TabsTrigger value="write">
              <IconPencil /> <span className="hidden sm:inline">Write</span>
            </TabsTrigger>
            <TabsTrigger value="record">
              <IconMicrophone /> <span className="hidden sm:inline">Record</span>
            </TabsTrigger>
            <TabsTrigger value="upload">
              <IconUpload /> <span className="hidden sm:inline">Upload</span>
            </TabsTrigger>
            <TabsTrigger value="drive">
              <IconBrandGoogleDrive /> <span className="hidden sm:inline">Google Drive</span>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="write" className="pt-3">
            <WriteTab pending={create.isPending} onSubmit={(t) => submit(t, "TEXT")} />
          </TabsContent>
          <TabsContent value="record" className="pt-3">
            <RecordTab active={captureOpen && tab === "record"} pending={create.isPending} onSubmit={submit} />
          </TabsContent>
          <TabsContent value="upload" className="pt-3">
            <UploadTab pending={create.isPending} onSubmit={submit} />
          </TabsContent>
          <TabsContent value="drive" className="pt-3">
            <DriveTab onImported={done} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function SubmitButton({ pending, disabled, onClick }: { pending: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <Button onClick={onClick} disabled={pending || disabled}>
      {pending ? <Spinner /> : <IconSparkles />}
      Find action items
    </Button>
  );
}

function WriteTab({ pending, onSubmit }: { pending: boolean; onSubmit: (text: string) => void }) {
  const [text, setText] = useState("");
  return (
    <div className="space-y-3">
      <Textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") onSubmit(text);
        }}
        placeholder={PLACEHOLDER}
        className="min-h-48 resize-y"
      />
      <DialogFooter className="items-center sm:justify-between">
        <span className="hidden text-xs text-muted-foreground sm:inline-flex sm:items-center sm:gap-1">
          <KbdGroup>
            <Kbd>Ctrl</Kbd>
            <Kbd>Enter</Kbd>
          </KbdGroup>
          to capture
        </span>
        <SubmitButton pending={pending} disabled={text.trim().length < 3} onClick={() => onSubmit(text)} />
      </DialogFooter>
    </div>
  );
}

/* ---------- Record: live transcript with the browser's speech recognition ---------- */

type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult:
    ((e: { resultIndex: number; results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function getRecognition(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => Recognition;
    webkitSpeechRecognition?: new () => Recognition;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function RecordTab({
  active,
  pending,
  onSubmit,
}: {
  active: boolean;
  pending: boolean;
  onSubmit: (text: string, source: Source, title?: string) => void;
}) {
  const [supported] = useState(() => Boolean(getRecognition()));
  const [recording, setRecording] = useState(false);
  const [finalText, setFinalText] = useState("");
  const [interim, setInterim] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [kind, setKind] = useState<"MEETING" | "VOICE">("MEETING");
  const rec = useRef<Recognition | null>(null);
  const wantOn = useRef(false);

  const stop = () => {
    wantOn.current = false;
    rec.current?.stop();
    setRecording(false);
    setInterim("");
  };

  const start = () => {
    const Ctor = getRecognition();
    if (!Ctor) return;
    const r = new Ctor();
    r.continuous = true;
    r.interimResults = true;
    r.lang = navigator.language || "en-US";
    r.onresult = (e) => {
      let live = "";
      let committed = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]!;
        if (res.isFinal) committed += `${res[0].transcript.trim()}\n`;
        else live += res[0].transcript;
      }
      if (committed) setFinalText((t) => t + committed);
      setInterim(live);
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed") toast.error("Microphone access was blocked. Allow it in the browser to record.");
      if (e.error !== "no-speech") stop();
    };
    // Browsers end recognition after a pause; keep going until the user stops.
    r.onend = () => (wantOn.current ? r.start() : undefined);
    rec.current = r;
    wantOn.current = true;
    r.start();
    setRecording(true);
  };

  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  // Closing the dialog or switching tabs stops the microphone.
  useEffect(() => {
    if (!active && wantOn.current) stop();
  }, [active]);

  if (!supported) {
    return (
      <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        Live transcription needs Chrome, Edge or Safari. You can still upload a transcript, import one from Google
        Drive, or record on the Loopify mobile app.
      </div>
    );
  }

  const text = `${finalText}${interim}`;
  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="lg"
          variant={recording ? "destructive" : "default"}
          onClick={recording ? stop : start}
          className="gap-2"
        >
          {recording ? <IconPlayerStopFilled /> : <IconMicrophone />}
          {recording ? "Stop" : finalText ? "Keep recording" : "Start recording"}
        </Button>
        <span
          className={cn("font-mono text-sm tabular-nums", recording ? "text-destructive" : "text-muted-foreground")}
        >
          {recording && <span className="mr-1.5 inline-block size-2 animate-pulse rounded-full bg-destructive" />}
          {clock}
        </span>
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          value={kind}
          onValueChange={(v) => v && setKind(v as typeof kind)}
          className="ml-auto"
        >
          <ToggleGroupItem value="MEETING">
            <IconUsers /> Meeting
          </ToggleGroupItem>
          <ToggleGroupItem value="VOICE">
            <IconMicrophone /> Voice note
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <Textarea
        value={text}
        onChange={(e) => {
          setFinalText(e.target.value);
          setInterim("");
        }}
        placeholder="The transcript appears here as people talk. You can fix words before capturing."
        className="min-h-44 resize-y"
        readOnly={recording}
      />
      <DialogFooter className="items-center sm:justify-between">
        <span className="text-xs text-muted-foreground">Audio stays in your browser. Only the text is sent.</span>
        <SubmitButton
          pending={pending}
          disabled={recording || text.trim().length < 3}
          onClick={() => onSubmit(text, kind, kind === "MEETING" ? "Meeting transcript" : "Voice note")}
        />
      </DialogFooter>
    </div>
  );
}

/* ---------- Upload a transcript file ---------- */

function UploadTab({
  pending,
  onSubmit,
}: {
  pending: boolean;
  onSubmit: (text: string, source: Source, title?: string) => void;
}) {
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const read = async (f: File) => {
    if (f.size > 2_000_000) return toast.error("That file is over 2 MB. Try a text transcript instead.");
    const raw = await f.text();
    const text = /\.(vtt|srt)$/i.test(f.name) ? stripCaptions(raw) : raw;
    setFile({ name: f.name.replace(/\.[^.]+$/, ""), text: text.trim() });
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files[0];
          if (f) void read(f);
        }}
        className={cn(
          "flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed p-8 text-center transition-colors",
          dragging ? "border-primary bg-brand-soft" : "hover:bg-muted/60",
        )}
      >
        <IconUpload className="size-7 text-brand" />
        <span className="font-medium">{file ? file.name : "Drop a transcript or click to choose"}</span>
        <span className="text-xs text-muted-foreground">
          Zoom, Teams or Meet exports (.vtt, .srt), or any .txt / .md notes
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept=".txt,.vtt,.srt,.md,.csv,text/plain,text/vtt"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void read(f);
          e.target.value = "";
        }}
      />
      {file && (
        <Textarea
          value={file.text}
          onChange={(e) => setFile({ ...file, text: e.target.value })}
          className="max-h-60 min-h-32 resize-y font-mono text-xs"
        />
      )}
      <DialogFooter>
        <SubmitButton
          pending={pending}
          disabled={!file || file.text.length < 3}
          onClick={() => file && onSubmit(file.text, "MEETING", file.name)}
        />
      </DialogFooter>
    </div>
  );
}

/* ---------- Google Drive: Meet transcripts, Docs, Sheets ---------- */

const KIND_ICON = { transcript: IconUsers, doc: IconFileText, sheet: IconTable, text: IconFileText } as const;

function DriveTab({ onImported }: { onImported: (c: { id: string; status: string }) => void }) {
  const trpc = useTRPC();
  const sources = useQuery(trpc.capture.sources.queryOptions());
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<"meetings" | "all">("meetings");
  const query = useDeferredValue(search.trim());
  const connected = sources.data?.google.connected;
  const files = useQuery({
    ...trpc.capture.driveFiles.queryOptions({ query: query || undefined, kind }),
    enabled: Boolean(connected),
  });
  const importFile = useMutation(
    trpc.capture.importDriveFile.mutationOptions({
      onSuccess: onImported,
      onError: (e) => toast.error(errorMessage(e)),
    }),
  );

  if (!sources.data) return <Skeleton className="h-64 rounded-2xl" />;
  if (!sources.data.google.configured || !connected) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed p-8 text-center">
        <IconBrandGoogleDrive className="size-8 text-brand" />
        <p className="font-medium">Bring in Google Meet transcripts</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Connect Google once and import any meeting transcript, Doc or Sheet from your Drive. Loopify only reads the
          file you pick.
        </p>
        {sources.data.google.configured ? (
          <Button asChild>
            <a href="/api/integrations/google/connect?returnTo=/capture">Connect Google</a>
          </Button>
        ) : (
          <Badge variant="outline">Google isn&apos;t set up on the server yet</Badge>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <IconSearch className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your Drive"
            className="pl-9"
          />
        </div>
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          value={kind}
          onValueChange={(v) => v && setKind(v as typeof kind)}
        >
          <ToggleGroupItem value="meetings">Meeting transcripts</ToggleGroupItem>
          <ToggleGroupItem value="all">All files</ToggleGroupItem>
        </ToggleGroup>
      </div>
      <ScrollArea className="h-72 rounded-2xl border">
        {files.isLoading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-xl" />
            ))}
          </div>
        ) : files.error ? (
          <p className="p-6 text-center text-sm text-destructive">{files.error.message}</p>
        ) : !files.data?.files.length ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            {kind === "meetings"
              ? "No meeting transcripts found. Turn on transcripts in Google Meet, or switch to All files."
              : "Nothing matches that search."}
          </p>
        ) : (
          <ul className="divide-y">
            {files.data.files.map((f) => {
              const Icon = KIND_ICON[f.kind];
              const busy = importFile.isPending && importFile.variables?.fileId === f.id;
              return (
                <li key={f.id}>
                  <button
                    type="button"
                    disabled={importFile.isPending}
                    onClick={() => importFile.mutate({ fileId: f.id })}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted disabled:opacity-60"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                      <Icon className="size-4.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{f.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {f.kind === "transcript" ? "Meeting transcript" : f.kind === "sheet" ? "Sheet" : "Document"}
                        {f.modifiedTime &&
                          ` · ${formatDistanceToNowStrict(new Date(f.modifiedTime), { addSuffix: true })}`}
                      </span>
                    </span>
                    {busy ? <Spinner /> : <span className="text-xs font-medium text-brand">Import</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </ScrollArea>
      <p className="text-xs text-muted-foreground">
        Connected as {sources.data.google.accountEmail ?? "your Google account"}.
      </p>
    </div>
  );
}
