"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useState, type KeyboardEvent } from "react";
import { toast } from "sonner";
import type { BoardCard, BoardData } from "@/components/board/board-view";
import { CardTile } from "@/components/board/card-tile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage, useTRPC } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

type Column = BoardData["columns"][number];

export function BoardColumn({
  boardId,
  column,
  cards,
  boardKey,
  plannedIds,
  onOpenCard,
}: {
  boardId: string;
  column: Column;
  cards: BoardCard[];
  boardKey: string;
  plannedIds: string[];
  onOpenCard: (cardId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const overLimit = column.wipLimit != null && cards.length > column.wipLimit;

  return (
    <section
      className={cn(
        "flex max-h-full w-72 shrink-0 flex-col rounded-2xl bg-muted/60 transition-colors",
        `tint-${column.color}`,
        isOver && "bg-accent",
      )}
      aria-label={column.name}
    >
      <header className="flex items-center gap-2 px-3 pt-3 pb-2">
        <span className="size-2.5 rounded-full" style={{ background: "var(--tint)" }} />
        <h2 className="truncate font-heading text-sm font-semibold tracking-normal">{column.name}</h2>
        <span className="text-xs text-muted-foreground tabular-nums">{cards.length}</span>
        {column.wipLimit != null && (
          <Badge variant={overLimit ? "destructive" : "outline"} className="ml-auto" title="Work-in-progress limit">
            max {column.wipLimit}
          </Badge>
        )}
      </header>

      <div ref={setNodeRef} className="flex min-h-16 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <AnimatePresence initial={false}>
            {cards.map((card) => (
              <SortableCard
                key={card.id}
                card={card}
                boardKey={boardKey}
                planned={plannedIds.includes(card.id)}
                onOpen={() => onOpenCard(card.id)}
              />
            ))}
          </AnimatePresence>
        </SortableContext>
        <AddCard boardId={boardId} columnId={column.id} />
      </div>
    </section>
  );
}

function SortableCard({
  card,
  boardKey,
  planned,
  onOpen,
}: {
  card: BoardCard;
  boardKey: string;
  planned: boolean;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      onKeyDown={(e) => {
        listeners?.onKeyDown?.(e);
        if (e.key === "Enter" && !e.defaultPrevented) onOpen();
      }}
      className="rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 420, damping: 28 }}
      >
        <CardTile card={card} boardKey={boardKey} planned={planned} dragging={isDragging} />
      </motion.div>
    </div>
  );
}

function AddCard({ boardId, columnId }: { boardId: string; columnId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const create = useMutation(
    trpc.card.create.mutationOptions({
      onSuccess: () => {
        setTitle("");
        void queryClient.invalidateQueries({ queryKey: trpc.board.get.queryKey({ boardId }) });
      },
      onError: (e) => toast.error(errorMessage(e)),
    }),
  );

  const submit = () => {
    const value = title.trim();
    if (value) create.mutate({ boardId, columnId, title: value });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
    if (e.key === "Escape") setOpen(false);
  };

  if (!open) {
    return (
      <Button variant="ghost" size="sm" className="justify-start text-muted-foreground" onClick={() => setOpen(true)}>
        <IconPlus />
        Add a card
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-xl bg-card p-2 shadow-xs">
      <Textarea
        autoFocus
        rows={2}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => !title.trim() && setOpen(false)}
        placeholder="What needs doing?"
        className="min-h-0 resize-none border-0 bg-transparent p-1 shadow-none focus-visible:ring-0"
      />
      <div className="flex justify-end gap-1">
        <Button size="xs" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button size="xs" onClick={submit} disabled={create.isPending || !title.trim()}>
          Add card
        </Button>
      </div>
    </div>
  );
}
