"use client";

import { AnimatedRocket } from "@/components/brand/animated-icons";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { IconArrowBackUp, IconExternalLink, IconGripVertical, IconMinus } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import Link from "next/link";
import { toast } from "sonner";
import { DoneCheck } from "@/components/common/done-check";
import { DueDate } from "@/components/common/due-date";
import { PriorityIcon } from "@/components/common/priority";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { errorMessage, useTRPC, type RouterOutputs } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

type Item = RouterOutputs["day"]["today"]["items"][number];
type Today = RouterOutputs["day"]["today"];

export function PlanList({ items }: { items: Item[] }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const key = trpc.day.today.queryKey();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const reorder = useMutation(
    trpc.day.reorder.mutationOptions({
      onError: (e) => toast.error(errorMessage(e)),
      onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
    }),
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.id === active.id);
    const to = items.findIndex((i) => i.id === over.id);
    const next = arrayMove(items, from, to);
    queryClient.setQueryData<Today>(key, (old) => (old ? { ...old, items: next } : old));
    reorder.mutate({
      itemId: String(active.id),
      beforeId: next[to - 1]?.id ?? null,
      afterId: next[to + 1]?.id ?? null,
    });
  }

  if (!items.length) {
    return (
      <Empty className="rounded-2xl border border-dashed py-14">
        <EmptyHeader>
          <EmptyMedia variant="icon" className="size-14 rounded-2xl bg-brand-soft text-brand">
            <AnimatedRocket className="size-8" trigger="loop" />
          </EmptyMedia>
          <EmptyTitle>Nothing planned yet</EmptyTitle>
          <EmptyDescription>
            Add cards from your boards, or capture a conversation and turn it into cards.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <ul className="space-y-2">
          {items.map((item) => (
            <PlanRow key={item.id} item={item} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function PlanRow({ item }: { item: Item }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const key = trpc.day.today.queryKey();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const done = item.status === "DONE";

  const setDone = useMutation(
    trpc.card.setDone.mutationOptions({
      onMutate: async ({ done }) => {
        await queryClient.cancelQueries({ queryKey: key });
        const previous = queryClient.getQueryData<Today>(key);
        queryClient.setQueryData<Today>(key, (old) =>
          old
            ? {
                ...old,
                items: old.items.map((i) =>
                  i.id === item.id
                    ? { ...i, status: done ? "DONE" : "PLANNED", card: { ...i.card, completed: done } }
                    : i,
                ),
              }
            : old,
        );
        return { previous };
      },
      onSuccess: (_, { done }) => {
        if (done) toast.success("Done and dusted", { description: item.card.title, duration: 2500 });
      },
      onError: (e, _, context) => {
        if (context?.previous) queryClient.setQueryData(key, context.previous);
        toast.error(errorMessage(e));
      },
      onSettled: () => {
        void queryClient.invalidateQueries({ queryKey: key });
        void queryClient.invalidateQueries({ queryKey: trpc.board.get.queryKey({ boardId: item.card.boardId }) });
      },
    }),
  );

  const unplan = useMutation(
    trpc.day.unplan.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: key });
        toast("Removed from today", { description: "It's still on its board." });
      },
      onError: (e) => toast.error(errorMessage(e)),
    }),
  );

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("relative", isDragging && "z-10")}
    >
      <motion.div
        initial={{ opacity: 0, y: -12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 380, damping: 26 }}
        className={cn(
          "group relative flex items-center gap-3 rounded-xl border bg-card px-3 py-3 shadow-xs transition-shadow",
          isDragging && "rotate-1 shadow-lg ring-2 ring-primary/30",
          done && "bg-muted/40",
        )}
      >
        <button
          type="button"
          className="-ml-1 cursor-grab touch-none rounded text-muted-foreground/50 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 active:cursor-grabbing"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <IconGripVertical className="size-4" />
        </button>
        <DoneCheck
          checked={done}
          onCheckedChange={(checked) => setDone.mutate({ cardId: item.card.id, done: checked })}
        />
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "truncate font-medium transition-colors",
              done && "text-muted-foreground line-through decoration-2",
            )}
          >
            {item.card.title}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className={cn("inline-flex items-center gap-1.5", `tint-${item.card.columnColor}`)}>
              <span className="size-2 rounded-full" style={{ background: "var(--tint)" }} />
              {item.card.columnName}
            </span>
            <span>{item.card.boardName}</span>
            <DueDate date={item.card.dueDate} done={done} />
            {item.rolled && (
              <span className="inline-flex items-center gap-1">
                <IconArrowBackUp className="size-3.5" />
                rolled over
              </span>
            )}
            {item.card.rolloverCount >= 3 && !done && (
              <Badge variant="highlight">rolled {item.card.rolloverCount}×</Badge>
            )}
          </div>
        </div>
        <PriorityIcon priority={item.card.priority} />
        <span className="hidden text-xs text-muted-foreground tabular-nums sm:inline">{item.card.key}</span>
        <div className="flex opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button asChild size="icon-sm" variant="ghost" aria-label="Open card">
                <Link href={`/boards/${item.card.boardId}?card=${item.card.id}`}>
                  <IconExternalLink />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Open card</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Remove from today"
                onClick={() => unplan.mutate({ itemId: item.id })}
              >
                <IconMinus />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Remove from today</TooltipContent>
          </Tooltip>
        </div>
      </motion.div>
    </li>
  );
}
