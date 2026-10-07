"use client";

import { IconArrowDown, IconArrowUp, IconPlus, IconTemplate, IconTrash } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import type { BoardData } from "@/components/board/board-view";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errorMessage, useTRPC } from "@/lib/trpc/client";
import { COLUMN_COLORS } from "@/lib/workflow-presets";
import { cn } from "@/lib/utils";

const CATEGORY_LABEL = { TODO: "Not started", IN_PROGRESS: "In progress", DONE: "Done" } as const;
const FIELD_TYPES = [
  ["TEXT", "Text"],
  ["NUMBER", "Number"],
  ["DATE", "Date"],
  ["SELECT", "Single choice"],
  ["MULTI_SELECT", "Multiple choice"],
  ["URL", "Link"],
  ["CHECKBOX", "Checkbox"],
  ["PERSON", "Person"],
] as const;

export function BoardSettingsDialog({
  board,
  open,
  onOpenChange,
}: {
  board: BoardData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Workflow for {board.name}</DialogTitle>
          <DialogDescription>
            Shape the steps and fields to match how this team works. Changes apply to this board only.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="steps">
          <TabsList>
            <TabsTrigger value="steps">Steps</TabsTrigger>
            <TabsTrigger value="fields">Fields</TabsTrigger>
            <TabsTrigger value="template">Save as template</TabsTrigger>
          </TabsList>
          <TabsContent value="steps" className="pt-3">
            <ColumnsEditor board={board} />
          </TabsContent>
          <TabsContent value="fields" className="pt-3">
            <FieldsEditor board={board} />
          </TabsContent>
          <TabsContent value="template" className="pt-3">
            <SaveTemplate board={board} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function useRefresh(boardId: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: trpc.board.get.queryKey({ boardId }) });
}

function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: (typeof COLUMN_COLORS)[number]) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Pick a colour"
          className={cn(
            "size-6 shrink-0 rounded-full ring-offset-2 ring-offset-background hover:ring-2 hover:ring-ring/40",
            `tint-${value}`,
          )}
          style={{ background: "var(--tint)" }}
        />
      </PopoverTrigger>
      <PopoverContent className="grid w-auto grid-cols-5 gap-2 p-3">
        {COLUMN_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={color}
            onClick={() => onChange(color)}
            className={cn(
              "size-7 rounded-full transition-transform hover:scale-110",
              `tint-${color}`,
              value === color && "ring-2 ring-ring ring-offset-2 ring-offset-background",
            )}
            style={{ background: "var(--tint)" }}
          />
        ))}
      </PopoverContent>
    </Popover>
  );
}

function ColumnsEditor({ board }: { board: BoardData }) {
  const trpc = useTRPC();
  const refresh = useRefresh(board.id);
  const onError = (e: unknown) => toast.error(errorMessage(e));
  const update = useMutation(trpc.board.updateColumn.mutationOptions({ onSuccess: refresh, onError }));
  const moveColumn = useMutation(trpc.board.moveColumn.mutationOptions({ onSuccess: refresh, onError }));
  const remove = useMutation(
    trpc.board.deleteColumn.mutationOptions({ onSuccess: () => (refresh(), toast("Step removed")), onError }),
  );
  const add = useMutation(
    trpc.board.addColumn.mutationOptions({ onSuccess: () => (refresh(), setDraft("")), onError }),
  );
  const [draft, setDraft] = useState("");
  const cols = board.columns;

  return (
    <div className="space-y-2">
      {cols.map((column, index) => (
        <div key={column.id} className="flex items-center gap-2 rounded-xl border p-2">
          <ColorPicker value={column.color} onChange={(color) => update.mutate({ columnId: column.id, color })} />
          <Input
            defaultValue={column.name}
            aria-label="Step name"
            onBlur={(e) =>
              e.target.value.trim() &&
              e.target.value !== column.name &&
              update.mutate({ columnId: column.id, name: e.target.value.trim() })
            }
            className="h-8 flex-1"
          />
          <Select
            value={column.category}
            onValueChange={(category) => update.mutate({ columnId: column.id, category: category as never })}
          >
            <SelectTrigger size="sm" className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            min={1}
            defaultValue={column.wipLimit ?? ""}
            placeholder="Limit"
            aria-label="Work-in-progress limit"
            onBlur={(e) => {
              const v = e.target.value ? Number(e.target.value) : null;
              if (v !== column.wipLimit) update.mutate({ columnId: column.id, wipLimit: v });
            }}
            className="h-8 w-20"
          />
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Move up"
            disabled={index === 0}
            onClick={() =>
              moveColumn.mutate({
                columnId: column.id,
                beforeId: cols[index - 2]?.id ?? null,
                afterId: cols[index - 1]?.id ?? null,
              })
            }
          >
            <IconArrowUp />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Move down"
            disabled={index === cols.length - 1}
            onClick={() =>
              moveColumn.mutate({
                columnId: column.id,
                beforeId: cols[index + 1]?.id ?? null,
                afterId: cols[index + 2]?.id ?? null,
              })
            }
          >
            <IconArrowDown />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Remove step"
            disabled={cols.length <= 2}
            onClick={() => {
              const target =
                cols.find((c) => c.id !== column.id && c.category === column.category) ??
                cols.find((c) => c.id !== column.id)!;
              remove.mutate({ columnId: column.id, moveCardsTo: target.id });
            }}
          >
            <IconTrash />
          </Button>
        </div>
      ))}
      <form
        className="flex gap-2 pt-1"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim()) add.mutate({ boardId: board.id, name: draft.trim() });
        }}
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="New step, e.g. Waiting on client"
          className="h-9"
        />
        <Button type="submit" disabled={!draft.trim() || add.isPending}>
          <IconPlus />
          Add step
        </Button>
      </form>
      <p className="text-xs text-muted-foreground">Removing a step moves its cards to a step of the same kind.</p>
    </div>
  );
}

function FieldsEditor({ board }: { board: BoardData }) {
  const trpc = useTRPC();
  const refresh = useRefresh(board.id);
  const onError = (e: unknown) => toast.error(errorMessage(e));
  const add = useMutation(
    trpc.board.addField.mutationOptions({
      onSuccess: () => (refresh(), setDraft({ label: "", type: "TEXT", options: "" })),
      onError,
    }),
  );
  const remove = useMutation(trpc.board.deleteField.mutationOptions({ onSuccess: refresh, onError }));
  const [draft, setDraft] = useState({ label: "", type: "TEXT" as (typeof FIELD_TYPES)[number][0], options: "" });
  const needsOptions = draft.type === "SELECT" || draft.type === "MULTI_SELECT";

  const submit = () => {
    const key =
      draft.label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .replace(/^(\d)/, "f_$1")
        .slice(0, 40) || "field";
    add.mutate({
      boardId: board.id,
      key,
      label: draft.label.trim(),
      type: draft.type,
      options: needsOptions
        ? draft.options
            .split(",")
            .map((o) => o.trim())
            .filter(Boolean)
        : [],
    });
  };

  return (
    <div className="space-y-3">
      {board.fields.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No custom fields yet. Add things like Client, Deal value or Platform.
        </p>
      )}
      {board.fields.map((field) => (
        <div key={field.id} className="flex items-center gap-3 rounded-xl border px-3 py-2 text-sm">
          <span className="flex-1 font-medium">{field.label}</span>
          <span className="text-muted-foreground">{FIELD_TYPES.find(([t]) => t === field.type)?.[1]}</span>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Remove ${field.label}`}
            onClick={() => remove.mutate({ fieldId: field.id })}
          >
            <IconTrash />
          </Button>
        </div>
      ))}
      <FieldGroup className="rounded-xl bg-muted/50 p-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="field-label">Field name</FieldLabel>
            <Input
              id="field-label"
              value={draft.label}
              onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
              placeholder="Client"
            />
          </Field>
          <Field>
            <FieldLabel>Type</FieldLabel>
            <Select value={draft.type} onValueChange={(type) => setDraft((d) => ({ ...d, type: type as never }))}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        {needsOptions && (
          <Field>
            <FieldLabel htmlFor="field-options">Choices, separated by commas</FieldLabel>
            <Input
              id="field-options"
              value={draft.options}
              onChange={(e) => setDraft((d) => ({ ...d, options: e.target.value }))}
              placeholder="Instagram, YouTube, LinkedIn"
            />
          </Field>
        )}
        <Button onClick={submit} disabled={!draft.label.trim() || add.isPending} className="justify-self-start">
          <IconPlus />
          Add field
        </Button>
      </FieldGroup>
    </div>
  );
}

function SaveTemplate({ board }: { board: BoardData }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [name, setName] = useState(`${board.name} workflow`);
  const save = useMutation(
    trpc.template.createFromBoard.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: trpc.template.list.queryKey() });
        toast.success("Saved as a template. Other teams can now start from it.");
      },
      onError: (e) => toast.error(errorMessage(e)),
    }),
  );
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Turn this board&apos;s steps and fields into a template other teams can reuse.
      </p>
      <div className="flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Template name" />
        <Button
          onClick={() => save.mutate({ boardId: board.id, name })}
          disabled={name.trim().length < 2 || save.isPending}
        >
          <IconTemplate />
          Save template
        </Button>
      </div>
    </div>
  );
}
