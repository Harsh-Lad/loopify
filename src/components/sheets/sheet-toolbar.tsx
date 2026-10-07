"use client";

import {
  IconAlignCenter,
  IconAlignLeft,
  IconAlignRight,
  IconBold,
  IconBucketDroplet,
  IconChevronDown,
  IconClearFormatting,
  IconExternalLink,
  IconFilter,
  IconItalic,
  IconLetterA,
  IconMathFunction,
  IconNote,
  IconSnowflake,
  IconStrikethrough,
  IconTextWrap,
  IconUnderline,
  IconX,
} from "@tabler/icons-react";
import { useState, type ComponentType } from "react";
import { columnLetter, type CellMeta, type GridSelection, rangeLabel } from "@/components/sheets/sheet-grid";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type FormatPatch = {
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  underline?: boolean;
  color?: string | null;
  fill?: string | null;
  align?: "LEFT" | "CENTER" | "RIGHT";
  wrap?: boolean;
  clear?: boolean;
};

const PALETTE = [
  "#000000",
  "#434343",
  "#999999",
  "#ffffff",
  "#e06666",
  "#f6b26b",
  "#ffd966",
  "#93c47d",
  "#6fa8dc",
  "#8e7cc3",
  "#cc0000",
  "#e69138",
  "#f1c232",
  "#6aa84f",
  "#3d85c6",
  "#674ea7",
  "#f4cccc",
  "#fce5cd",
  "#fff2cc",
  "#d9ead3",
  "#cfe2f3",
  "#d9d2e9",
];

/** The formatting row above the grid, like the Google Sheets toolbar. */
export function SheetToolbar({
  meta,
  selection,
  frozenRows,
  frozenColumns,
  filter,
  onFilter,
  onFormat,
  onFreeze,
  disabled,
}: {
  meta: CellMeta | undefined;
  selection: GridSelection;
  frozenRows: number;
  frozenColumns: number;
  filter: string;
  onFilter: (value: string) => void;
  onFormat: (patch: FormatPatch) => void;
  onFreeze: (rows: number, columns: number) => void;
  disabled?: boolean;
}) {
  const row = selection.focus.row + 1;
  const col = selection.focus.col + 1;
  return (
    <div className="flex items-center gap-1 overflow-x-auto border-b px-2 py-1.5 [scrollbar-width:none]">
      <FormatToggle
        icon={IconBold}
        label="Bold (Ctrl+B)"
        pressed={Boolean(meta?.bold)}
        disabled={disabled}
        onChange={(v) => onFormat({ bold: v })}
      />
      <FormatToggle
        icon={IconItalic}
        label="Italic (Ctrl+I)"
        pressed={Boolean(meta?.italic)}
        disabled={disabled}
        onChange={(v) => onFormat({ italic: v })}
      />
      <FormatToggle
        icon={IconStrikethrough}
        label="Strikethrough (Ctrl+Shift+X)"
        pressed={Boolean(meta?.strike)}
        disabled={disabled}
        onChange={(v) => onFormat({ strike: v })}
      />
      <FormatToggle
        icon={IconUnderline}
        label="Underline (Ctrl+U)"
        pressed={Boolean(meta?.underline)}
        disabled={disabled}
        onChange={(v) => onFormat({ underline: v })}
      />
      <ColorPicker
        icon={IconLetterA}
        label="Text color"
        value={meta?.color}
        disabled={disabled}
        onPick={(color) => onFormat({ color })}
      />
      <ColorPicker
        icon={IconBucketDroplet}
        label="Fill color"
        value={meta?.fill}
        disabled={disabled}
        onPick={(fill) => onFormat({ fill })}
      />
      <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-5" />
      <FormatToggle
        icon={IconAlignLeft}
        label="Align left"
        pressed={!meta?.align}
        disabled={disabled}
        onChange={() => onFormat({ align: "LEFT" })}
      />
      <FormatToggle
        icon={IconAlignCenter}
        label="Align center"
        pressed={meta?.align === "center"}
        disabled={disabled}
        onChange={() => onFormat({ align: "CENTER" })}
      />
      <FormatToggle
        icon={IconAlignRight}
        label="Align right"
        pressed={meta?.align === "right"}
        disabled={disabled}
        onChange={() => onFormat({ align: "RIGHT" })}
      />
      <FormatToggle
        icon={IconTextWrap}
        label="Wrap text"
        pressed={Boolean(meta?.wrap)}
        disabled={disabled}
        onChange={(v) => onFormat({ wrap: v })}
      />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Clear formatting"
            disabled={disabled}
            onClick={() => onFormat({ clear: true })}
          >
            <IconClearFormatting />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Clear formatting</TooltipContent>
      </Tooltip>
      <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-5" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            disabled={disabled}
            className={cn((frozenRows || frozenColumns) && "text-brand")}
          >
            <IconSnowflake />
            Freeze
            <IconChevronDown data-icon="inline-end" className="opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Rows</DropdownMenuLabel>
          <FreezeItem active={frozenRows === 0} onSelect={() => onFreeze(0, frozenColumns)}>
            No rows
          </FreezeItem>
          <FreezeItem active={frozenRows === 1} onSelect={() => onFreeze(1, frozenColumns)}>
            1 row
          </FreezeItem>
          <FreezeItem active={frozenRows === 2} onSelect={() => onFreeze(2, frozenColumns)}>
            2 rows
          </FreezeItem>
          {row > 2 && (
            <FreezeItem active={frozenRows === row} onSelect={() => onFreeze(row, frozenColumns)}>
              Up to row {row}
            </FreezeItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Columns</DropdownMenuLabel>
          <FreezeItem active={frozenColumns === 0} onSelect={() => onFreeze(frozenRows, 0)}>
            No columns
          </FreezeItem>
          <FreezeItem active={frozenColumns === 1} onSelect={() => onFreeze(frozenRows, 1)}>
            1 column
          </FreezeItem>
          {col > 1 && (
            <FreezeItem active={frozenColumns === col} onSelect={() => onFreeze(frozenRows, col)}>
              Up to column {columnLetter(col - 1)}
            </FreezeItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <InputGroup className="ml-auto h-8 w-44 min-w-36 shrink-0">
        <InputGroupAddon>
          <IconFilter />
        </InputGroupAddon>
        <InputGroupInput
          placeholder="Filter rows"
          value={filter}
          onChange={(e) => onFilter(e.target.value)}
          aria-label="Filter rows"
        />
        {filter && (
          <InputGroupAddon align="inline-end">
            <InputGroupButton size="icon-xs" aria-label="Clear filter" onClick={() => onFilter("")}>
              <IconX />
            </InputGroupButton>
          </InputGroupAddon>
        )}
      </InputGroup>
    </div>
  );
}

function FreezeItem({
  active,
  onSelect,
  children,
}: {
  active: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenuItem onSelect={onSelect} className={cn(active && "font-semibold text-brand")}>
      {children}
    </DropdownMenuItem>
  );
}

function FormatToggle({
  icon: Icon,
  label,
  pressed,
  onChange,
  disabled,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  pressed: boolean;
  onChange: (pressed: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Toggle
          size="sm"
          pressed={pressed}
          onPressedChange={onChange}
          aria-label={label}
          disabled={disabled}
          className="px-2 data-[state=on]:bg-primary/12 data-[state=on]:text-brand"
        >
          <Icon />
        </Toggle>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function ColorPicker({
  icon: Icon,
  label,
  value,
  onPick,
  disabled,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string | undefined;
  onPick: (color: string | null) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button size="icon-sm" variant="ghost" aria-label={label} disabled={disabled} className="flex-col gap-0">
              <Icon className="size-4" />
              <span
                className="h-1 w-4 rounded-full border border-foreground/10"
                style={{ background: value ?? "transparent" }}
              />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
      <PopoverContent align="start" className="w-auto space-y-2 p-3">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <div className="grid grid-cols-6 gap-1.5">
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              onClick={() => {
                onPick(c);
                setOpen(false);
              }}
              className={cn(
                "size-6 rounded-md border border-foreground/10 transition-transform hover:scale-110",
                value === c && "ring-2 ring-primary ring-offset-1 ring-offset-background",
              )}
              style={{ background: c }}
            />
          ))}
        </div>
        <Button size="sm" variant="ghost" className="w-full" onClick={() => (onPick(null), setOpen(false))}>
          Reset
        </Button>
      </PopoverContent>
    </Popover>
  );
}

/** Name box plus formula bar: shows and edits the active cell's formula or value. */
export function FormulaBar({
  selection,
  raw,
  meta,
  onCommit,
  onExit,
}: {
  selection: GridSelection;
  raw: string;
  meta: CellMeta | undefined;
  onCommit: (value: string) => void;
  onExit: () => void;
}) {
  return (
    <div className="flex items-center gap-2 border-b px-2 py-1.5">
      <span className="w-20 shrink-0 truncate rounded-md border bg-muted/50 px-2 py-1 text-center font-mono text-xs">
        {rangeLabel(selection)}
      </span>
      <IconMathFunction className="size-4 shrink-0 text-muted-foreground" />
      <FormulaInput
        key={`${selection.focus.row}:${selection.focus.col}:${raw}`}
        raw={raw}
        onCommit={onCommit}
        onExit={onExit}
      />
      {meta?.note && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="grid size-7 shrink-0 place-items-center rounded-md">
              <IconNote className="size-4 text-highlight" />
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-64 whitespace-pre-wrap">{meta.note}</TooltipContent>
        </Tooltip>
      )}
      {meta?.link && (
        <Button size="sm" variant="ghost" asChild className="shrink-0">
          <a href={meta.link} target="_blank" rel="noreferrer">
            <IconExternalLink />
            Open link
          </a>
        </Button>
      )}
    </div>
  );
}

function FormulaInput({
  raw,
  onCommit,
  onExit,
}: {
  raw: string;
  onCommit: (value: string) => void;
  onExit: () => void;
}) {
  const [draft, setDraft] = useState(raw);
  return (
    <Input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          if (draft !== raw) onCommit(draft);
          onExit();
        } else if (e.key === "Escape") {
          setDraft(raw);
          onExit();
        }
      }}
      onBlur={() => draft !== raw && onCommit(draft)}
      placeholder="Value or formula, like =SUM(B2:B20)"
      aria-label="Formula bar"
      className={cn(
        "h-8 flex-1 rounded-md border-transparent bg-transparent shadow-none focus-visible:border-input",
        draft.startsWith("=") && "font-mono text-xs",
      )}
    />
  );
}
