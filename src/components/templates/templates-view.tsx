"use client";

import { IconArrowDown, IconArrowUp, IconPlus, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { DynamicIcon } from "@/components/app/dynamic-icon";
import { PageBody, PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage, useTRPC } from "@/lib/trpc/client";
import { COLUMN_COLORS, type PresetColumn, type PresetField } from "@/lib/workflow-presets";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  ["GENERAL", "General"],
  ["TECH", "Tech"],
  ["CREATIVE", "Creative"],
  ["SALES", "Sales"],
  ["INFLUENCER", "Influencer"],
  ["OUTREACH", "Outreach"],
] as const;

export function TemplatesView() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const templates = useQuery(trpc.template.list.queryOptions());
  const org = useQuery(trpc.org.current.queryOptions());
  const [open, setOpen] = useState(false);
  const canManage = org.data && ["OWNER", "ADMIN", "MANAGER"].includes(org.data.role);
  const remove = useMutation(
    trpc.template.delete.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: trpc.template.list.queryKey() }),
      onError: (e) => toast.error(errorMessage(e)),
    }),
  );

  return (
    <PageBody>
      <PageHeader
        title="Workflows"
        description="Tech, creative, sales and outreach don't move work the same way. Start from one of these, or design your own."
        actions={
          canManage && (
            <Button onClick={() => setOpen(true)}>
              <IconPlus />
              New workflow
            </Button>
          )
        }
      />
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {!templates.data && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-2xl" />)}
        {templates.data?.map((t) => (
          <Card key={t.id}>
            <CardHeader className="flex items-start gap-3">
              <DynamicIcon name={t.icon} className="mt-0.5 size-6 text-brand" />
              <div className="min-w-0 flex-1">
                <CardTitle className="font-heading text-lg">{t.name}</CardTitle>
                {t.description && <CardDescription>{t.description}</CardDescription>}
              </div>
              {t.orgId ? <Badge variant="highlight">Yours</Badge> : <Badge variant="secondary">Built in</Badge>}
            </CardHeader>
            <CardContent className="space-y-3">
              <ol className="flex flex-wrap items-center gap-1.5">
                {(t.columns as unknown as PresetColumn[]).map((c) => (
                  <li
                    key={c.name}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
                      `tint-${c.color}`,
                    )}
                  >
                    <span className="size-2 rounded-full" style={{ background: "var(--tint)" }} />
                    {c.name}
                  </li>
                ))}
              </ol>
              {(t.fields as unknown as PresetField[]).length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Fields: {(t.fields as unknown as PresetField[]).map((f) => f.label).join(", ")}
                </p>
              )}
              {t.orgId && canManage && (
                <Button size="sm" variant="ghost" onClick={() => remove.mutate({ templateId: t.id })}>
                  <IconTrash />
                  Delete
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      <NewTemplateDialog open={open} onOpenChange={setOpen} />
    </PageBody>
  );
}

type DraftColumn = { name: string; color: (typeof COLUMN_COLORS)[number]; category: "TODO" | "IN_PROGRESS" | "DONE" };

function NewTemplateDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number][0]>("GENERAL");
  const [columns, setColumns] = useState<DraftColumn[]>([
    { name: "To do", color: "slate", category: "TODO" },
    { name: "Doing", color: "blue", category: "IN_PROGRESS" },
    { name: "Done", color: "green", category: "DONE" },
  ]);
  const create = useMutation(
    trpc.template.create.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: trpc.template.list.queryKey() });
        toast.success("Workflow saved");
        onOpenChange(false);
        setName("");
      },
    }),
  );

  const set = (i: number, patch: Partial<DraftColumn>) =>
    setColumns((cols) => cols.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const swap = (i: number, j: number) =>
    setColumns((cols) => {
      const next = [...cols];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">New workflow</DialogTitle>
          <DialogDescription>
            List the steps work goes through, in order. Add custom fields later from any board.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
            <Field>
              <FieldLabel htmlFor="tpl-name">Name</FieldLabel>
              <Input
                id="tpl-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Podcast production"
              />
            </Field>
            <Field>
              <FieldLabel>Kind of work</FieldLabel>
              <Select value={category} onValueChange={(v) => setCategory(v as never)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field data-invalid={create.isError || undefined}>
            <FieldLabel>Steps</FieldLabel>
            <div className="space-y-2">
              {columns.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Select value={c.color} onValueChange={(color) => set(i, { color: color as DraftColumn["color"] })}>
                    <SelectTrigger size="sm" className="w-28" aria-label="Colour">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COLUMN_COLORS.map((color) => (
                        <SelectItem key={color} value={color}>
                          <span
                            className={`size-2.5 rounded-full tint-${color}`}
                            style={{ background: "var(--tint)" }}
                          />
                          {color}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={c.name}
                    onChange={(e) => set(i, { name: e.target.value })}
                    className="h-8 flex-1"
                    aria-label="Step name"
                  />
                  <Select value={c.category} onValueChange={(v) => set(i, { category: v as DraftColumn["category"] })}>
                    <SelectTrigger size="sm" className="w-32" aria-label="Kind of step">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TODO">Not started</SelectItem>
                      <SelectItem value="IN_PROGRESS">In progress</SelectItem>
                      <SelectItem value="DONE">Done</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Move up"
                    disabled={i === 0}
                    onClick={() => swap(i, i - 1)}
                  >
                    <IconArrowUp />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Move down"
                    disabled={i === columns.length - 1}
                    onClick={() => swap(i, i + 1)}
                  >
                    <IconArrowDown />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Remove step"
                    disabled={columns.length <= 2}
                    onClick={() => setColumns((cols) => cols.filter((_, j) => j !== i))}
                  >
                    <IconTrash />
                  </Button>
                </div>
              ))}
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setColumns((cols) => [
                    ...cols.slice(0, -1),
                    { name: "", color: "violet", category: "IN_PROGRESS" },
                    ...cols.slice(-1),
                  ])
                }
              >
                <IconPlus />
                Add step
              </Button>
            </div>
            <FieldError>{create.error ? errorMessage(create.error) : null}</FieldError>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button
            disabled={name.trim().length < 2 || columns.some((c) => !c.name.trim()) || create.isPending}
            onClick={() =>
              create.mutate({
                name,
                category,
                columns: columns.map((c) => ({ ...c, name: c.name.trim() })),
                fields: [],
              })
            }
          >
            Save workflow
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
