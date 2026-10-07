"use client";

import { IconChevronDown, IconSortAscending, IconSortDescending } from "@tabler/icons-react";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { RouterOutputs } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

export type TabGrid = RouterOutputs["sheets"]["tab"];
export type CellMeta = TabGrid["cells"][string];
export type GridEdits = Map<string, string>;
export type Pos = { row: number; col: number };
export type GridSelection = { anchor: Pos; focus: Pos };
export type Bounds = { top: number; bottom: number; left: number; right: number };

export const cellKey = (row: number, col: number) => `${row}:${col}`;

export function columnLetter(index: number) {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

export function boundsOf(sel: GridSelection): Bounds {
  return {
    top: Math.min(sel.anchor.row, sel.focus.row),
    bottom: Math.max(sel.anchor.row, sel.focus.row),
    left: Math.min(sel.anchor.col, sel.focus.col),
    right: Math.max(sel.anchor.col, sel.focus.col),
  };
}

/** "B4" for one cell, "B4:D9" for a block. */
export function rangeLabel(sel: GridSelection) {
  const b = boundsOf(sel);
  const start = `${columnLetter(b.left)}${b.top + 1}`;
  return b.top === b.bottom && b.left === b.right ? start : `${start}:${columnLetter(b.right)}${b.bottom + 1}`;
}

const EXTRA_ROWS = 25;
const EXTRA_COLS = 3;
const MIN_COLS = 8;
const MAX_COLS = 60;
const HEADER_H = 30;
const ROW_HEADER_W = 64;
const NUMERIC = /^[-+(]?[$₹€£¥]?\s?[\d,]*\.?\d+%?\)?$/;

type Handlers = {
  down: (row: number, col: number, e: MouseEvent) => void;
  enter: (row: number, col: number, e: MouseEvent) => void;
  edit: (row: number, col: number) => void;
  toggleRow: (row: number, checked: boolean) => void;
  check: (row: number, col: number, checked: boolean) => void;
};

/**
 * A spreadsheet grid that draws a Google Sheets tab the way it looks there:
 * formatting, frozen rows and columns, merged cells, notes, links, checkboxes
 * and dropdowns. Supports range selection, copy and paste, and keyboard editing.
 * Edits stay local until the parent saves them.
 */
export function SheetGrid({
  grid,
  edits,
  onEdit,
  onEditMany,
  selection,
  onSelectionChange,
  selectedRows,
  onToggleRow,
  filter,
  onSort,
  onShortcut,
}: {
  grid: TabGrid;
  edits: GridEdits;
  onEdit: (row: number, col: number, value: string) => void;
  onEditMany: (changes: { row: number; col: number; value: string }[]) => void;
  selection: GridSelection;
  onSelectionChange: (sel: GridSelection) => void;
  selectedRows: Set<number>;
  onToggleRow: (row: number, checked: boolean) => void;
  filter: string;
  onSort: (col: number, ascending: boolean) => void;
  onShortcut: (action: "bold" | "italic" | "underline" | "strike") => void;
}) {
  const { values, cells } = grid;
  const container = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState<{ pos: Pos; draft: string } | null>(null);

  // ── Size of the drawn area ──
  let editedMaxRow = -1;
  let editedMaxCol = -1;
  for (const key of edits.keys()) {
    const [r, c] = key.split(":").map(Number) as [number, number];
    editedMaxRow = Math.max(editedMaxRow, r);
    editedMaxCol = Math.max(editedMaxCol, c);
  }
  const usedCols = values.reduce((max, row) => Math.max(max, row.length), 0);
  const colCount = Math.min(MAX_COLS, Math.max(MIN_COLS, usedCols + EXTRA_COLS, editedMaxCol + 2, grid.frozenColumns));
  const rowCount = Math.max(values.length, editedMaxRow + 1, grid.frozenRows) + EXTRA_ROWS;

  const widths = useMemo(
    () => Array.from({ length: colCount }, (_, c) => Math.max(56, grid.columnWidths[c] ?? 100)),
    [colCount, grid.columnWidths],
  );
  const heightOf = useCallback((r: number) => Math.max(28, grid.rowHeights[r] ?? 21), [grid.rowHeights]);

  const query = filter.trim().toLowerCase();
  const headerRows = Math.max(grid.frozenRows, 1);
  const visibleRows = useMemo(() => {
    const hidden = new Set(grid.hiddenRows);
    const out: number[] = [];
    for (let r = 0; r < rowCount; r++) {
      if (hidden.has(r)) continue;
      if (query && r >= headerRows) {
        const row = values[r];
        if (!row?.some((v) => v != null && String(v).toLowerCase().includes(query))) continue;
      }
      out.push(r);
    }
    return out;
  }, [grid.hiddenRows, rowCount, query, headerRows, values]);
  const visibleCols = useMemo(() => {
    const hidden = new Set(grid.hiddenColumns);
    return Array.from({ length: colCount }, (_, c) => c).filter((c) => !hidden.has(c));
  }, [grid.hiddenColumns, colCount]);

  // ── Merged cells (ignored while filtering, since spans would cross hidden rows) ──
  const { spans, masterOf } = useMemo(() => {
    const spans = new Map<string, { rows: number; cols: number }>();
    const masterOf = new Map<string, Pos>();
    if (query) return { spans, masterOf };
    for (const m of grid.merges) {
      spans.set(cellKey(m.row, m.col), { rows: m.rows, cols: m.cols });
      for (let r = m.row; r < m.row + m.rows; r++)
        for (let c = m.col; c < m.col + m.cols; c++)
          if (r !== m.row || c !== m.col) masterOf.set(cellKey(r, c), { row: m.row, col: m.col });
    }
    return { spans, masterOf };
  }, [grid.merges, query]);

  // ── Frozen offsets ──
  const frozenTop = useMemo(() => {
    const tops = new Map<number, number>();
    let y = HEADER_H;
    for (const r of visibleRows) {
      if (r >= grid.frozenRows) break;
      tops.set(r, y);
      y += heightOf(r);
    }
    return tops;
  }, [visibleRows, grid.frozenRows, heightOf]);
  const frozenLeft = useMemo(() => {
    const lefts = new Map<number, number>();
    let x = ROW_HEADER_W;
    for (const c of visibleCols) {
      if (c >= grid.frozenColumns) break;
      lefts.set(c, x);
      x += widths[c] ?? 100;
    }
    return lefts;
  }, [visibleCols, grid.frozenColumns, widths]);

  const display = useCallback(
    (row: number, col: number) => {
      const key = cellKey(row, col);
      if (edits.has(key)) return edits.get(key)!;
      const v = values[row]?.[col];
      return v == null ? "" : String(v);
    },
    [edits, values],
  );
  /** What you edit: the formula if there is one, otherwise the value. */
  const raw = useCallback(
    (row: number, col: number) => {
      const key = cellKey(row, col);
      if (edits.has(key)) return edits.get(key)!;
      return cells[key]?.formula ?? display(row, col);
    },
    [edits, cells, display],
  );

  const active = selection.focus;
  const bounds = boundsOf(selection);
  const multi = bounds.top !== bounds.bottom || bounds.left !== bounds.right;

  useEffect(() => {
    if (editing) return;
    const el = container.current?.querySelector<HTMLElement>(`[data-cell="${active.row}:${active.col}"]`);
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active, editing]);

  // ── Movement that respects hidden rows, filters and merges ──
  const step = (pos: Pos, dRow: number, dCol: number): Pos => {
    let next = pos;
    const from = masterOf.get(cellKey(pos.row, pos.col)) ?? pos;
    for (let guard = 0; guard < 60; guard++) {
      const ri = visibleRows.indexOf(next.row);
      const ci = visibleCols.indexOf(next.col);
      const row = visibleRows[Math.max(0, Math.min(visibleRows.length - 1, (ri < 0 ? 0 : ri) + dRow))] ?? next.row;
      const col = visibleCols[Math.max(0, Math.min(visibleCols.length - 1, (ci < 0 ? 0 : ci) + dCol))] ?? next.col;
      if (row === next.row && col === next.col) return next;
      next = { row, col };
      const master = masterOf.get(cellKey(row, col));
      if (!master) return next;
      if (master.row !== from.row || master.col !== from.col) return master;
    }
    return next;
  };

  const select = (focus: Pos, extend = false) =>
    onSelectionChange({ anchor: extend ? selection.anchor : focus, focus });

  const startEdit = (pos: Pos, draft?: string) => {
    if (cells[cellKey(pos.row, pos.col)]?.checkbox) return;
    setEditing({ pos, draft: draft ?? raw(pos.row, pos.col) });
  };

  const commit = (next?: Pos) => {
    if (!editing) return;
    const { pos, draft } = editing;
    if (draft !== raw(pos.row, pos.col)) onEdit(pos.row, pos.col, draft);
    setEditing(null);
    if (next) select(next);
    container.current?.focus();
  };

  const clearSelection = () => {
    const changes: { row: number; col: number; value: string }[] = [];
    for (let r = bounds.top; r <= bounds.bottom; r++)
      for (let c = bounds.left; c <= bounds.right; c++)
        if (display(r, c) !== "") changes.push({ row: r, col: c, value: "" });
    if (changes.length) onEditMany(changes);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (editing) return;
    const mod = e.metaKey || e.ctrlKey;
    const { row, col } = active;
    const meta = cells[cellKey(row, col)];
    if (mod && e.key.toLowerCase() === "c") {
      const lines: string[] = [];
      for (let r = bounds.top; r <= bounds.bottom; r++) {
        const line: string[] = [];
        for (let c = bounds.left; c <= bounds.right; c++) line.push(display(r, c));
        lines.push(line.join("\t"));
      }
      void navigator.clipboard?.writeText(lines.join("\n"));
    } else if (mod && e.key.toLowerCase() === "a") {
      onSelectionChange({
        anchor: { row: 0, col: 0 },
        focus: { row: Math.max(0, values.length - 1), col: Math.max(0, usedCols - 1) },
      });
    } else if (mod && ["b", "i", "u"].includes(e.key.toLowerCase())) {
      onShortcut(({ b: "bold", i: "italic", u: "underline" } as const)[e.key.toLowerCase() as "b" | "i" | "u"]);
    } else if (mod && e.shiftKey && e.key.toLowerCase() === "x") {
      onShortcut("strike");
    } else if (mod) {
      return; // Let the browser handle paste and everything else.
    } else if (e.key === "ArrowDown") select(step(active, 1, 0), e.shiftKey);
    else if (e.key === "ArrowUp") select(step(active, -1, 0), e.shiftKey);
    else if (e.key === "ArrowRight") select(step(active, 0, 1), e.shiftKey);
    else if (e.key === "ArrowLeft") select(step(active, 0, -1), e.shiftKey);
    else if (e.key === "Tab") select(step(active, 0, e.shiftKey ? -1 : 1));
    else if (e.key === "PageDown") select(step(active, 20, 0), e.shiftKey);
    else if (e.key === "PageUp") select(step(active, -20, 0), e.shiftKey);
    else if (e.key === "Escape") select(active);
    else if (e.key === " " && meta?.checkbox)
      onEdit(row, col, display(row, col).toUpperCase() === "TRUE" ? "FALSE" : "TRUE");
    else if (e.key === "Enter" || e.key === "F2") startEdit(active);
    else if (e.key === "Delete" || e.key === "Backspace") clearSelection();
    else if (e.key.length === 1 && !e.altKey && !meta?.options?.length) startEdit(active, e.key);
    else return;
    e.preventDefault();
    // Keep app-wide shortcuts (like Ctrl+B for the sidebar) from firing too.
    e.stopPropagation();
  };

  const onPaste = (e: ClipboardEvent<HTMLDivElement>) => {
    if (editing) return;
    const text = e.clipboardData.getData("text/plain");
    if (!text) return;
    e.preventDefault();
    const rows = text.replace(/\r/g, "").replace(/\n$/, "").split("\n");
    const changes: { row: number; col: number; value: string }[] = [];
    rows.forEach((line, i) =>
      line.split("\t").forEach((value, j) => {
        const c = active.col + j;
        if (c < MAX_COLS) changes.push({ row: active.row + i, col: c, value });
      }),
    );
    onEditMany(changes);
    const last = changes[changes.length - 1];
    if (last)
      onSelectionChange({
        anchor: active,
        focus: { row: last.row, col: active.col + (rows[0]?.split("\t").length ?? 1) - 1 },
      });
  };

  // Stable handlers for memoized rows, always reading the latest state.
  const latest = useRef<Handlers>(null);
  useLayoutEffect(() => {
    latest.current = {
      down: (row, col, e) => {
        if (editing && (editing.pos.row !== row || editing.pos.col !== col)) commit();
        if (e.button !== 0) return;
        select({ row, col }, e.shiftKey);
      },
      enter: (row, col, e) => {
        if (e.buttons === 1 && !editing) onSelectionChange({ anchor: selection.anchor, focus: { row, col } });
      },
      edit: (row, col) => startEdit({ row, col }),
      toggleRow: onToggleRow,
      check: (row, col, checked) => onEdit(row, col, checked ? "TRUE" : "FALSE"),
    };
  });
  const handlers = useMemo<Handlers>(
    () => ({
      down: (...a) => latest.current?.down(...a),
      enter: (...a) => latest.current?.enter(...a),
      edit: (...a) => latest.current?.edit(...a),
      toggleRow: (...a) => latest.current?.toggleRow(...a),
      check: (...a) => latest.current?.check(...a),
    }),
    [],
  );

  const selectColumn = (col: number) =>
    onSelectionChange({ anchor: { row: 0, col }, focus: { row: rowCount - 1, col } });
  const selectRow = (row: number) => onSelectionChange({ anchor: { row, col: 0 }, focus: { row, col: colCount - 1 } });

  const lastFrozenRow = grid.frozenRows > 0 ? grid.frozenRows - 1 : -1;
  const lastFrozenCol = grid.frozenColumns > 0 ? grid.frozenColumns - 1 : -1;
  const totalWidth = ROW_HEADER_W + visibleCols.reduce((sum, c) => sum + (widths[c] ?? 100), 0);

  return (
    <div
      ref={container}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      role="grid"
      aria-label="Spreadsheet"
      aria-multiselectable
      className="relative min-h-0 flex-1 overflow-auto bg-card text-[13px] outline-none select-none"
    >
      <table className="table-fixed border-separate border-spacing-0" style={{ width: totalWidth }}>
        <colgroup>
          <col style={{ width: ROW_HEADER_W }} />
          {visibleCols.map((c) => (
            <col key={c} style={{ width: widths[c] }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th
              className="sticky top-0 left-0 z-40 border-r border-b bg-muted"
              style={{ height: HEADER_H }}
              onMouseDown={() =>
                onSelectionChange({ anchor: { row: 0, col: 0 }, focus: { row: rowCount - 1, col: colCount - 1 } })
              }
              aria-label="Select all"
            />
            {visibleCols.map((c) => {
              const inSel = c >= bounds.left && c <= bounds.right;
              const left = frozenLeft.get(c);
              return (
                <th
                  key={c}
                  scope="col"
                  style={{ height: HEADER_H, left }}
                  onMouseDown={(e) => {
                    if ((e.target as HTMLElement).closest("button")) return;
                    selectColumn(c);
                  }}
                  className={cn(
                    "group/col sticky top-0 z-20 border-r border-b bg-muted px-1 text-xs font-medium text-muted-foreground transition-colors",
                    left !== undefined && "z-30",
                    c === lastFrozenCol && "border-r-2 border-r-foreground/25",
                    inSel && "bg-[color-mix(in_oklch,var(--primary)_16%,var(--muted))] text-brand",
                  )}
                >
                  <span className="relative flex items-center justify-center">
                    {columnLetter(c)}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label={`Column ${columnLetter(c)} options`}
                          className="absolute right-0 grid size-5 place-items-center rounded opacity-0 group-hover/col:opacity-100 hover:bg-foreground/10 data-[state=open]:opacity-100"
                        >
                          <IconChevronDown className="size-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem onSelect={() => onSort(c, true)}>
                          <IconSortAscending />
                          Sort sheet A to Z
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => onSort(c, false)}>
                          <IconSortDescending />
                          Sort sheet Z to A
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((r) => {
            const rowInSel = r >= bounds.top && r <= bounds.bottom;
            const isActiveRow = active.row === r;
            const isEditingRow = editing?.pos.row === r;
            return (
              <GridRow
                key={r}
                row={r}
                height={heightOf(r)}
                stickyTop={frozenTop.get(r)}
                lastFrozen={r === lastFrozenRow}
                cols={visibleCols}
                frozenLeft={frozenLeft}
                lastFrozenCol={lastFrozenCol}
                values={values[r]}
                cells={cells}
                edits={edits}
                spans={spans}
                masterOf={masterOf}
                selLeft={rowInSel && multi ? bounds.left : -1}
                selRight={rowInSel && multi ? bounds.right : -1}
                headerInSel={rowInSel}
                activeCol={isActiveRow ? active.col : -1}
                checked={selectedRows.has(r)}
                bold={r === 0 && grid.frozenRows === 0}
                handlers={handlers}
                onSelectRow={selectRow}
                editor={
                  isEditingRow && editing ? (
                    <CellEditor
                      key={`${editing.pos.row}:${editing.pos.col}`}
                      col={editing.pos.col}
                      draft={editing.draft}
                      options={cells[cellKey(editing.pos.row, editing.pos.col)]?.options}
                      onDraft={(draft) => setEditing({ pos: editing.pos, draft })}
                      onCommit={(dir, value) => {
                        const { row, col } = editing.pos;
                        if (value !== undefined) {
                          if (value !== raw(row, col)) onEdit(row, col, value);
                          setEditing(null);
                          container.current?.focus();
                          return;
                        }
                        commit(
                          dir === "down"
                            ? step({ row, col }, 1, 0)
                            : dir === "up"
                              ? step({ row, col }, -1, 0)
                              : dir === "right"
                                ? step({ row, col }, 0, 1)
                                : dir === "left"
                                  ? step({ row, col }, 0, -1)
                                  : undefined,
                        );
                      }}
                      onCancel={() => {
                        setEditing(null);
                        container.current?.focus();
                      }}
                    />
                  ) : null
                }
              />
            );
          })}
        </tbody>
      </table>
      {query && visibleRows.length <= headerRows && (
        <p className="sticky left-0 p-6 text-center text-sm text-muted-foreground">
          No rows contain &ldquo;{filter}&rdquo;.
        </p>
      )}
    </div>
  );
}

type RowProps = {
  row: number;
  height: number;
  stickyTop: number | undefined;
  lastFrozen: boolean;
  cols: number[];
  frozenLeft: Map<number, number>;
  lastFrozenCol: number;
  values: (string | number | boolean | null)[] | undefined;
  cells: Record<string, CellMeta>;
  edits: GridEdits;
  spans: Map<string, { rows: number; cols: number }>;
  masterOf: Map<string, Pos>;
  selLeft: number;
  selRight: number;
  headerInSel: boolean;
  activeCol: number;
  checked: boolean;
  bold: boolean;
  handlers: Handlers;
  onSelectRow: (row: number) => void;
  editor: React.ReactNode;
};

const GridRow = memo(function GridRow({
  row,
  height,
  stickyTop,
  lastFrozen,
  cols,
  frozenLeft,
  lastFrozenCol,
  values,
  cells,
  edits,
  spans,
  masterOf,
  selLeft,
  selRight,
  headerInSel,
  activeCol,
  checked,
  bold,
  handlers,
  onSelectRow,
  editor,
}: RowProps) {
  const sticky = stickyTop !== undefined;
  return (
    <tr
      className={cn(checked && "[&>td]:shadow-[inset_0_0_0_9999px_color-mix(in_oklch,var(--primary)_7%,transparent)]")}
    >
      <th
        scope="row"
        style={{ height, top: stickyTop }}
        className={cn(
          "sticky left-0 z-10 border-r border-b bg-muted px-1.5 text-xs font-normal text-muted-foreground",
          sticky && "z-30",
          lastFrozen && "border-b-2 border-b-foreground/25",
          headerInSel && "bg-[color-mix(in_oklch,var(--primary)_16%,var(--muted))] text-brand",
        )}
      >
        <span className="flex items-center justify-between gap-1">
          <Checkbox
            checked={checked}
            onCheckedChange={(v) => handlers.toggleRow(row, Boolean(v))}
            aria-label={`Select row ${row + 1}`}
            className="size-3.5"
          />
          <button type="button" className="tabular-nums hover:text-foreground" onMouseDown={() => onSelectRow(row)}>
            {row + 1}
          </button>
        </span>
      </th>
      {cols.map((c) => {
        const key = cellKey(row, c);
        if (masterOf.has(key)) return null;
        const span = spans.get(key);
        const meta = cells[key];
        const dirty = edits.has(key);
        const raw = values?.[c];
        const text = dirty ? edits.get(key)! : raw == null ? "" : String(raw);
        const isActive = activeCol === c;
        const inSel = selLeft >= 0 && c >= selLeft && c <= selRight;
        const left = frozenLeft.get(c);
        const align = meta?.align ?? (NUMERIC.test(text.trim()) && text.trim() ? "right" : undefined);
        const style: CSSProperties = {
          height,
          top: stickyTop,
          left,
          color: meta?.color ?? (meta?.fill ? "#1f1f1f" : undefined),
          backgroundColor: meta?.fill,
          textAlign: align,
          fontWeight: meta?.bold || bold ? 600 : undefined,
          fontStyle: meta?.italic ? "italic" : undefined,
          textDecoration:
            [meta?.underline || meta?.link ? "underline" : "", meta?.strike ? "line-through" : ""].join(" ").trim() ||
            undefined,
        };
        return (
          <td
            key={c}
            data-cell={key}
            role="gridcell"
            aria-selected={isActive || inSel}
            rowSpan={span?.rows}
            colSpan={span?.cols}
            style={style}
            onMouseDown={(e) => handlers.down(row, c, e)}
            onMouseEnter={(e) => handlers.enter(row, c, e)}
            onDoubleClick={() => handlers.edit(row, c)}
            className={cn(
              "relative overflow-hidden border-r border-b bg-card px-1.5 leading-tight",
              (sticky || left !== undefined) && "sticky z-[5]",
              sticky && left !== undefined && "z-[6]",
              lastFrozen && "border-b-2 border-b-foreground/25",
              c === lastFrozenCol && "border-r-2 border-r-foreground/25",
              meta?.wrap ? "whitespace-pre-wrap" : "whitespace-nowrap",
              meta?.link && "text-brand",
              dirty && "shadow-[inset_0_0_0_9999px_color-mix(in_oklch,var(--highlight)_28%,transparent)]",
              inSel && "after:pointer-events-none after:absolute after:inset-0 after:bg-primary/10",
              isActive && "outline-2 -outline-offset-2 outline-primary",
            )}
          >
            {editor && isActive ? (
              editor
            ) : meta?.checkbox ? (
              <span className="flex h-full items-center justify-center">
                <Checkbox
                  checked={text.toUpperCase() === "TRUE"}
                  onCheckedChange={(v) => handlers.check(row, c, Boolean(v))}
                  onMouseDown={(e) => e.stopPropagation()}
                  aria-label={`Toggle ${columnLetter(c)}${row + 1}`}
                />
              </span>
            ) : meta?.options?.length ? (
              <span className="flex items-center gap-1">
                {text && (
                  <span className="truncate rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                    {text}
                  </span>
                )}
                <IconChevronDown className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
              </span>
            ) : (
              <span className={cn("block", !meta?.wrap && "truncate")}>{text}</span>
            )}
            {meta?.note && <NoteMarker note={meta.note} />}
            {meta?.formula && !dirty && isActive && (
              <span className="absolute bottom-0 left-0 rounded-tr bg-primary px-1 font-mono text-[9px] leading-3 text-primary-foreground">
                fx
              </span>
            )}
          </td>
        );
      })}
    </tr>
  );
});

function NoteMarker({ note }: { note: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="absolute top-0 right-0 size-0 border-t-[7px] border-l-[7px] border-t-highlight border-l-transparent"
          aria-label="Has a note"
        />
      </TooltipTrigger>
      <TooltipContent className="max-w-64 whitespace-pre-wrap">{note}</TooltipContent>
    </Tooltip>
  );
}

type Direction = "down" | "up" | "right" | "left" | undefined;

function CellEditor({
  col,
  draft,
  options,
  onDraft,
  onCommit,
  onCancel,
}: {
  col: number;
  draft: string;
  options?: string[];
  onDraft: (draft: string) => void;
  /** Pass a value to commit it directly (dropdowns), or a direction to move after committing the draft. */
  onCommit: (dir: Direction, value?: string) => void;
  onCancel: () => void;
}) {
  if (options?.length) {
    return (
      <Select
        defaultOpen
        value={draft || undefined}
        onValueChange={(v) => onCommit(undefined, v)}
        onOpenChange={(o) => !o && onCancel()}
      >
        <SelectTrigger size="sm" className="absolute inset-0 h-full w-full rounded-none border-0 bg-background">
          <SelectValue placeholder="Pick one" />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  return (
    <Input
      autoFocus
      value={draft}
      onChange={(e) => onDraft(e.target.value)}
      onMouseDown={(e) => e.stopPropagation()}
      onFocus={(e) => {
        const el = e.currentTarget;
        el.setSelectionRange(el.value.length, el.value.length);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onCommit(e.shiftKey ? "up" : "down");
        } else if (e.key === "Tab") {
          e.preventDefault();
          onCommit(e.shiftKey ? "left" : "right");
        } else if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        }
        e.stopPropagation();
      }}
      onBlur={() => onCommit(undefined)}
      className={cn(
        "absolute inset-0 z-10 h-full min-w-full rounded-none select-text border-0 bg-background px-1.5 text-[13px] shadow-lg outline-2 -outline-offset-2 outline-primary focus-visible:ring-0 md:text-[13px]",
        draft.startsWith("=") && "font-mono",
      )}
      aria-label={`Edit ${columnLetter(col)}`}
    />
  );
}
