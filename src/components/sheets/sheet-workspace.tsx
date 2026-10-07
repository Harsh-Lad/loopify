"use client";

import { AnimatedSparkles } from "@/components/brand/animated-icons";
import {
  IconArrowLeft,
  IconChartBar,
  IconCheck,
  IconCopy,
  IconExternalLink,
  IconEyeOff,
  IconInfoCircle,
  IconLayoutSidebarRightCollapse,
  IconLayoutSidebarRightExpand,
  IconLink,
  IconPlus,
  IconRefresh,
  IconSend,
  IconSparkles,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChatPane } from "@/components/sheets/chat-pane";
import { SendRowsDialog } from "@/components/sheets/send-rows-dialog";
import {
  boundsOf,
  cellKey,
  SheetGrid,
  type GridEdits,
  type GridSelection,
  type TabGrid,
} from "@/components/sheets/sheet-grid";
import { FormulaBar, SheetToolbar, type FormatPatch } from "@/components/sheets/sheet-toolbar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { errorMessage, useTRPC, type RouterOutputs } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

type Meta = RouterOutputs["sheets"]["spreadsheet"];

const ORIGIN: GridSelection = { anchor: { row: 0, col: 0 }, focus: { row: 0, col: 0 } };

/** One spreadsheet: a Google Sheets style editor on the left and a chat bound to it on the right. */
export function SheetWorkspace({ spreadsheetId }: { spreadsheetId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const status = useQuery(trpc.sheets.status.queryOptions());
  const meta = useQuery(trpc.sheets.spreadsheet.queryOptions({ spreadsheetId }));
  const [tab, setTab] = useState<string | null>(null);
  const activeTab = tab ?? meta.data?.tabs.find((t) => !t.hidden)?.title ?? meta.data?.tabs[0]?.title ?? null;
  const activeSheet = meta.data?.tabs.find((t) => t.title === activeTab);
  const tabInput = { spreadsheetId, tab: activeTab ?? "" };
  const tabKey = trpc.sheets.tab.queryKey(tabInput);

  const data = useQuery({ ...trpc.sheets.tab.queryOptions(tabInput), enabled: Boolean(activeTab) });

  const [edits, setEdits] = useState<GridEdits>(new Map());
  const [selection, setSelection] = useState<GridSelection>(ORIGIN);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState("");
  const [chatOpen, setChatOpen] = useState(true);
  const [sendOpen, setSendOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pendingTab, setPendingTab] = useState<string | null>(null);

  const reloadTab = () => queryClient.invalidateQueries({ queryKey: tabKey });
  const reloadMeta = () =>
    queryClient.invalidateQueries({ queryKey: trpc.sheets.spreadsheet.queryKey({ spreadsheetId }) });
  const onError = (e: unknown) => toast.error(errorMessage(e));

  const save = useMutation(
    trpc.sheets.saveCells.mutationOptions({
      onSuccess: async ({ updatedCells }) => {
        await reloadTab();
        setEdits(new Map());
        toast.success(`Saved ${updatedCells} ${updatedCells === 1 ? "cell" : "cells"} to Google Sheets`);
      },
      onError,
    }),
  );
  const removeRows = useMutation(
    trpc.sheets.deleteRows.mutationOptions({
      onSuccess: async ({ deleted }) => {
        setSelectedRows(new Set());
        await reloadTab();
        toast.success(`Deleted ${deleted} ${deleted === 1 ? "row" : "rows"}`);
      },
      onError,
    }),
  );
  const addTab = useMutation(
    trpc.sheets.addTab.mutationOptions({
      onSuccess: async ({ title }) => {
        await reloadMeta();
        setTab(title);
        toast.success(`Added tab "${title}"`);
      },
      onError,
    }),
  );
  const formatCells = useMutation(
    trpc.sheets.formatCells.mutationOptions({
      onMutate: ({ range, format }) => {
        // Show the new look straight away; Google catches up a moment later.
        queryClient.setQueryData(tabKey, (old) => (old ? patchCells(old, range, format) : old));
      },
      onSettled: () => void reloadTab(),
      onError,
    }),
  );
  const freeze = useMutation(
    trpc.sheets.freeze.mutationOptions({
      onSuccess: () => {
        void reloadTab();
        void reloadMeta();
      },
      onError,
    }),
  );
  const sort = useMutation(
    trpc.sheets.sort.mutationOptions({
      onSuccess: (_, { headerRows }) => {
        void reloadTab();
        toast.success(
          headerRows ? `Sorted. Kept the top ${headerRows === 1 ? "row" : `${headerRows} rows`} in place.` : "Sorted",
        );
      },
      onError,
    }),
  );

  const title = meta.data?.title;
  const session = useQuery({
    ...trpc.sheets.sheetSession.queryOptions({ spreadsheetId, title: title ?? "" }),
    enabled: Boolean(title),
    retry: 1,
    staleTime: Infinity,
  });

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    if (!edits.size) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [edits.size]);

  const grid = data.data;
  const values = useMemo(() => grid?.values ?? [], [grid]);
  const pickedRows = useMemo(
    () => [...selectedRows].sort((a, b) => a - b).map((r) => values[r] ?? []),
    [selectedRows, values],
  );
  const activeKey = cellKey(selection.focus.row, selection.focus.col);
  const activeMeta = grid?.cells[activeKey];
  const activeRaw = edits.has(activeKey)
    ? edits.get(activeKey)!
    : (activeMeta?.formula ?? String(values[selection.focus.row]?.[selection.focus.col] ?? ""));
  const stats = useMemo(() => selectionStats(selection, values, edits), [selection, values, edits]);

  const setCell = (row: number, col: number, value: string) =>
    setEdits((prev) => {
      const next = new Map(prev);
      const key = cellKey(row, col);
      const original = grid?.cells[key]?.formula ?? String(values[row]?.[col] ?? "");
      if (original === value) next.delete(key);
      else next.set(key, value);
      return next;
    });
  const setCells = (changes: { row: number; col: number; value: string }[]) =>
    setEdits((prev) => {
      const next = new Map(prev);
      for (const { row, col, value } of changes) {
        const key = cellKey(row, col);
        const original = grid?.cells[key]?.formula ?? String(values[row]?.[col] ?? "");
        if (original === value) next.delete(key);
        else next.set(key, value);
      }
      return next;
    });

  const saveAll = () =>
    activeTab &&
    edits.size > 0 &&
    !save.isPending &&
    save.mutate({
      spreadsheetId,
      tab: activeTab,
      edits: [...edits].map(([key, value]) => {
        const [row, col] = key.split(":").map(Number) as [number, number];
        return { row, col, value };
      }),
    });

  const applyFormat = (format: FormatPatch) => {
    if (!activeSheet || !grid) return;
    const b = boundsOf(selection);
    const lastRow = Math.max(values.length, b.top + 1);
    const bottom = Math.min(b.bottom, lastRow + 50);
    formatCells.mutate({
      spreadsheetId,
      sheetId: activeSheet.sheetId,
      range: { row: b.top, col: b.left, rows: bottom - b.top + 1, cols: b.right - b.left + 1 },
      format,
    });
  };

  const switchTab = (next: string) => {
    if (next === activeTab) return;
    if (edits.size) return setPendingTab(next);
    goToTab(next);
  };
  const goToTab = (next: string) => {
    setEdits(new Map());
    setSelectedRows(new Set());
    setSelection(ORIGIN);
    setFilter("");
    setTab(next);
  };

  if (meta.isError) {
    return (
      <div className="grid flex-1 place-items-center p-10 text-center">
        <div>
          <h1 className="text-2xl font-bold">Can&apos;t open this sheet</h1>
          <p className="mt-2 text-muted-foreground">{errorMessage(meta.error)}</p>
          <Button asChild variant="outline" className="mt-6">
            <Link href="/sheets">
              <IconArrowLeft /> Back to your sheets
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const editor = (
    <div
      className="relative flex h-full min-h-0 flex-col"
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
          e.preventDefault();
          saveAll();
        }
      }}
    >
      <SheetToolbar
        meta={activeMeta}
        selection={selection}
        frozenRows={grid?.frozenRows ?? 0}
        frozenColumns={grid?.frozenColumns ?? 0}
        filter={filter}
        onFilter={setFilter}
        onFormat={applyFormat}
        onFreeze={(rows, columns) =>
          activeSheet && freeze.mutate({ spreadsheetId, sheetId: activeSheet.sheetId, rows, columns })
        }
        disabled={!grid}
      />
      <FormulaBar
        selection={selection}
        raw={activeRaw}
        meta={activeMeta}
        onCommit={(value) => setCell(selection.focus.row, selection.focus.col, value)}
        onExit={() => document.querySelector<HTMLElement>("[role=grid]")?.focus()}
      />

      <div className="relative flex min-h-0 flex-1 flex-col">
        {data.isError ? (
          <p className="m-4 rounded-xl bg-destructive/10 p-4 text-sm text-destructive">{errorMessage(data.error)}</p>
        ) : !grid ? (
          <div className="space-y-px p-2">
            {Array.from({ length: 14 }).map((_, i) => (
              <Skeleton key={i} className="h-7 rounded-sm" style={{ opacity: 1 - i * 0.06 }} />
            ))}
          </div>
        ) : (
          <SheetGrid
            grid={grid}
            edits={edits}
            onEdit={setCell}
            onEditMany={setCells}
            selection={selection}
            onSelectionChange={setSelection}
            selectedRows={selectedRows}
            onToggleRow={(row, checked) =>
              setSelectedRows((prev) => {
                const next = new Set(prev);
                if (checked) next.add(row);
                else next.delete(row);
                return next;
              })
            }
            filter={filter}
            onSort={(column, ascending) => {
              if (!activeSheet) return;
              if (edits.size) return toast.error("Save or discard your changes before sorting.");
              sort.mutate({
                spreadsheetId,
                sheetId: activeSheet.sheetId,
                column,
                ascending,
                headerRows: Math.max(grid.frozenRows, 1),
              });
            }}
            onShortcut={(action) => applyFormat({ [action]: !activeMeta?.[action] })}
          />
        )}

        {selectedRows.size > 0 && (
          <div className="absolute bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border bg-popover p-1 pl-4 text-sm shadow-lg animate-in fade-in slide-in-from-bottom-3">
            <span className="mr-2 font-medium whitespace-nowrap">
              {selectedRows.size} {selectedRows.size === 1 ? "row" : "rows"}
            </span>
            <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setSendOpen(true)}>
              <IconSend />
              Send to...
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="rounded-full text-destructive hover:text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <IconTrash />
              Delete
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              className="rounded-full"
              aria-label="Clear row selection"
              onClick={() => setSelectedRows(new Set())}
            >
              <IconX />
            </Button>
          </div>
        )}
      </div>

      <footer className="flex shrink-0 items-center gap-2 border-t bg-muted/40 px-2 py-1">
        <NewTabButton onCreate={(name) => addTab.mutate({ spreadsheetId, title: name })} pending={addTab.isPending} />
        <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto [scrollbar-width:thin]">
          {meta.data?.tabs.map((t) => (
            <button
              key={t.sheetId}
              type="button"
              onClick={() => switchTab(t.title)}
              className={cn(
                "relative flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                t.title === activeTab
                  ? "bg-background font-medium text-brand shadow-xs"
                  : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
                t.hidden && "italic opacity-70",
              )}
            >
              {t.hidden && <IconEyeOff className="size-3.5" />}
              {t.title}
              {t.color && (
                <span className="absolute inset-x-2 bottom-0.5 h-0.5 rounded-full" style={{ background: t.color }} />
              )}
            </button>
          ))}
        </div>
        {stats && (
          <Badge variant="secondary" className="hidden shrink-0 font-normal tabular-nums md:inline-flex">
            {stats}
          </Badge>
        )}
        {edits.size > 0 ? (
          <div className="flex shrink-0 items-center gap-1 animate-in fade-in">
            <Button size="sm" variant="ghost" onClick={() => setEdits(new Map())}>
              Discard
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" onClick={saveAll} disabled={save.isPending}>
                  {save.isPending ? <Spinner /> : <IconCheck />}
                  Save {edits.size}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Save to Google (Ctrl+S)</TooltipContent>
            </Tooltip>
          </div>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon-sm" variant="ghost" aria-label="Reload from Google" onClick={() => void reloadTab()}>
                {data.isFetching ? <Spinner /> : <IconRefresh />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reload from Google</TooltipContent>
          </Tooltip>
        )}
      </footer>
    </div>
  );

  const chat = (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex shrink-0 items-center gap-2 border-b px-4 py-2.5">
        <span className="grid size-6 place-items-center rounded-lg bg-primary/10 text-brand">
          <IconSparkles className="size-3.5" />
        </span>
        <span className="text-sm font-semibold">Sheet assistant</span>
        {isMobile && (
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setChatOpen(false)}>
            Back to sheet
          </Button>
        )}
      </div>
      {session.data ? (
        <ChatPane
          sessionId={session.data.id}
          aiConfigured={Boolean(status.data?.aiConfigured)}
          contextTitle={title}
          suggestions={[
            "Summarize this sheet",
            "Find duplicate rows",
            "Copy rows where Status is Done into a new sheet",
            "Give me the share link",
          ]}
          onSheetChanged={() => {
            void reloadTab();
            void reloadMeta();
          }}
        />
      ) : session.isError ? (
        <Empty className="flex-1">
          <EmptyHeader>
            <EmptyMedia variant="icon" className="size-14 rounded-2xl bg-brand-soft text-brand">
              <AnimatedSparkles className="size-8" trigger="loop" />
            </EmptyMedia>
            <EmptyTitle>Chat couldn&apos;t start</EmptyTitle>
            <EmptyDescription>{errorMessage(session.error)}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" size="sm" onClick={() => void session.refetch()}>
              <IconRefresh />
              Try again
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="flex-1 space-y-4 p-4">
          <Skeleton className="ml-auto h-10 w-2/3 rounded-3xl" />
          <Skeleton className="h-20 w-4/5 rounded-3xl" />
          <Skeleton className="ml-auto h-10 w-1/2 rounded-3xl" />
        </div>
      )}
    </div>
  );

  return (
    <div className="flex h-[calc(100svh-3.5rem)] min-h-0 flex-col overflow-hidden md:h-[calc(100svh-4.5rem)]">
      <header className="flex shrink-0 items-center gap-2 border-b px-3 py-2 sm:px-4">
        <Button asChild size="icon-sm" variant="ghost" aria-label="Back to your sheets">
          <Link href="/sheets">
            <IconArrowLeft />
          </Link>
        </Button>
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-success/15 text-success">
          <IconChartBar className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-heading text-base leading-tight font-bold">
            {meta.data?.title ?? <Skeleton className="h-5 w-48" />}
          </h1>
          <p className="truncate text-xs text-muted-foreground">
            {edits.size > 0 ? (
              <span className="font-medium text-foreground">
                {edits.size} unsaved {edits.size === 1 ? "change" : "changes"}
              </span>
            ) : meta.data?.modifiedTime ? (
              `Edited ${formatDistanceToNowStrict(new Date(meta.data.modifiedTime), { addSuffix: true })}${meta.data.lastEditedBy ? ` by ${meta.data.lastEditedBy}` : ""}`
            ) : (
              "Synced with Google Sheets"
            )}
          </p>
        </div>
        {meta.data && <InfoPopover meta={meta.data} grid={grid} activeTab={activeTab} />}
        {meta.data && <SharePopover url={meta.data.url} />}
        <Button size="sm" variant={chatOpen ? "secondary" : "default"} onClick={() => setChatOpen((v) => !v)}>
          {chatOpen ? <IconLayoutSidebarRightCollapse /> : <IconLayoutSidebarRightExpand />}
          <span className="hidden sm:inline">{chatOpen ? "Hide chat" : "Ask AI"}</span>
        </Button>
      </header>

      {isMobile ? (
        <div className="flex min-h-0 flex-1 flex-col">{chatOpen ? chat : editor}</div>
      ) : (
        <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
          <ResizablePanel defaultSize="66" minSize="40">
            {editor}
          </ResizablePanel>
          {chatOpen && (
            <>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize="34" minSize="24" className="min-h-0">
                {chat}
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      )}

      {meta.data && (
        <SendRowsDialog
          open={sendOpen}
          onOpenChange={setSendOpen}
          rows={pickedRows}
          header={values[0] ?? []}
          headerIncluded={selectedRows.has(0)}
          sourceTitle={meta.data.title}
          onSent={() => setSelectedRows(new Set())}
        />
      )}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selectedRows.size} {selectedRows.size === 1 ? "row" : "rows"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              They&apos;re removed from Google Sheets straight away. You can still restore them from the sheet&apos;s
              version history in Google.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                activeSheet &&
                removeRows.mutate({ spreadsheetId, sheetId: activeSheet.sheetId, rows: [...selectedRows] })
              }
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={pendingTab !== null} onOpenChange={(open) => !open && setPendingTab(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave this tab without saving?</AlertDialogTitle>
            <AlertDialogDescription>
              You have {edits.size} unsaved {edits.size === 1 ? "change" : "changes"} on &ldquo;{activeTab}&rdquo;.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingTab) goToTab(pendingTab);
                setPendingTab(null);
              }}
            >
              Discard and switch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** "Sum: 1,240  Avg: 310  Count: 4" for a numeric selection, like the Sheets status bar. */
function selectionStats(sel: GridSelection, values: TabGrid["values"], edits: GridEdits) {
  const b = boundsOf(sel);
  if (b.top === b.bottom && b.left === b.right) return null;
  let count = 0;
  let numbers = 0;
  let sum = 0;
  const lastRow = Math.min(b.bottom, values.length - 1);
  for (let r = b.top; r <= lastRow; r++) {
    for (let c = b.left; c <= b.right; c++) {
      const key = cellKey(r, c);
      const v = edits.has(key) ? edits.get(key) : values[r]?.[c];
      if (v == null || v === "") continue;
      count++;
      const n = Number(String(v).replace(/[,$₹€£%\s]/g, ""));
      if (!Number.isNaN(n)) {
        numbers++;
        sum += n;
      }
    }
  }
  if (!count) return null;
  const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return numbers ? `Sum ${fmt(sum)} · Avg ${fmt(sum / numbers)} · Count ${count}` : `Count ${count}`;
}

/** Applies a format patch to cached grid data so the toolbar feels instant. */
function patchCells(
  grid: TabGrid,
  range: { row: number; col: number; rows: number; cols: number },
  patch: FormatPatch,
): TabGrid {
  const cells = { ...grid.cells };
  for (let r = range.row; r < range.row + range.rows; r++) {
    for (let c = range.col; c < range.col + range.cols; c++) {
      const key = cellKey(r, c);
      const next = patch.clear
        ? {
            formula: cells[key]?.formula,
            note: cells[key]?.note,
            link: cells[key]?.link,
            checkbox: cells[key]?.checkbox,
            options: cells[key]?.options,
          }
        : { ...cells[key] };
      if (patch.bold !== undefined) next.bold = patch.bold || undefined;
      if (patch.italic !== undefined) next.italic = patch.italic || undefined;
      if (patch.strike !== undefined) next.strike = patch.strike || undefined;
      if (patch.underline !== undefined) next.underline = patch.underline || undefined;
      if (patch.color !== undefined) next.color = patch.color ?? undefined;
      if (patch.fill !== undefined) next.fill = patch.fill ?? undefined;
      if (patch.align)
        next.align = patch.align === "LEFT" ? undefined : (patch.align.toLowerCase() as "center" | "right");
      if (patch.wrap !== undefined) next.wrap = patch.wrap || undefined;
      cells[key] = next as TabGrid["cells"][string];
    }
  }
  return { ...grid, cells };
}

function InfoPopover({ meta, grid, activeTab }: { meta: Meta; grid: TabGrid | undefined; activeTab: string | null }) {
  const tab = meta.tabs.find((t) => t.title === activeTab);
  const rows: [string, string | null][] = [
    ["Owner", meta.owner],
    [
      "Last edited",
      meta.modifiedTime
        ? `${formatDistanceToNowStrict(new Date(meta.modifiedTime), { addSuffix: true })}${meta.lastEditedBy ? ` by ${meta.lastEditedBy}` : ""}`
        : null,
    ],
    ["Sharing", meta.shared ? "Shared with others" : "Only you"],
    [
      "Tabs",
      `${meta.tabs.length}${meta.tabs.some((t) => t.hidden) ? ` (${meta.tabs.filter((t) => t.hidden).length} hidden)` : ""}`,
    ],
    ["This tab", tab ? `${tab.rows.toLocaleString()} rows × ${tab.columns} columns` : null],
    [
      "Frozen",
      grid && (grid.frozenRows || grid.frozenColumns)
        ? `${grid.frozenRows} rows, ${grid.frozenColumns} columns`
        : "Nothing",
    ],
    ["Merged cells", grid?.merges.length ? String(grid.merges.length) : null],
    ["Protected ranges", tab?.protectedRanges ? String(tab.protectedRanges) : null],
    ["Locale", [meta.locale, meta.timeZone].filter(Boolean).join(", ") || null],
  ];
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button size="icon-sm" variant="ghost" aria-label="Sheet details">
              <IconInfoCircle />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Sheet details</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-80 space-y-3">
        <p className="font-heading font-bold">{meta.title}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          {rows
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="truncate text-right">{v}</dd>
              </div>
            ))}
        </dl>
        {(tab?.charts.length ?? 0) > 0 && (
          <>
            <Separator />
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">Charts on this tab</p>
              <ul className="space-y-1 text-sm">
                {tab!.charts.map((c, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <IconChartBar className="size-4 text-brand" />
                    <span className="truncate">{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
        {meta.namedRanges.length > 0 && (
          <>
            <Separator />
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">Named ranges</p>
              <div className="flex flex-wrap gap-1">
                {meta.namedRanges.map((n) => (
                  <Badge key={n} variant="outline" className="font-mono">
                    {n}
                  </Badge>
                ))}
              </div>
            </div>
          </>
        )}
        <Button asChild variant="outline" size="sm" className="w-full">
          <a href={meta.url} target="_blank" rel="noreferrer">
            <IconExternalLink />
            Open in Google Sheets
          </a>
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function SharePopover({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Link copied");
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline">
          <IconLink />
          <span className="hidden sm:inline">Share</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 space-y-3">
        <div>
          <p className="font-medium">Share this sheet</p>
          <p className="text-sm text-muted-foreground">People can open the link if they have access in Google Drive.</p>
        </div>
        <InputGroup>
          <InputGroupInput readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="Sheet link" />
          <InputGroupAddon align="inline-end">
            <InputGroupButton size="icon-xs" aria-label="Copy link" onClick={copy}>
              {copied ? <IconCheck /> : <IconCopy />}
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        <Button asChild variant="ghost" size="sm" className="w-full">
          <a href={url} target="_blank" rel="noreferrer">
            <IconExternalLink />
            Open in Google Sheets to change who has access
          </a>
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function NewTabButton({ onCreate, pending }: { onCreate: (name: string) => void; pending: boolean }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const submit = () => {
    if (!name.trim()) return;
    onCreate(name.trim());
    setName("");
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button size="icon-sm" variant="ghost" aria-label="Add a tab" disabled={pending}>
              {pending ? <Spinner /> : <IconPlus />}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Add a tab</TooltipContent>
      </Tooltip>
      <PopoverContent side="top" align="start" className="w-64 space-y-2">
        <p className="text-sm font-medium">New tab</p>
        <Input
          autoFocus
          placeholder="Tab name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <Button size="sm" className="w-full" onClick={submit} disabled={!name.trim()}>
          Add tab
        </Button>
      </PopoverContent>
    </Popover>
  );
}
