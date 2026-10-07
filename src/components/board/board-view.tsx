"use client";

import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { IconLock, IconSearch, IconSettings, IconUser } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { BoardColumn } from "@/components/board/board-column";
import { BoardSettingsDialog } from "@/components/board/board-settings-dialog";
import { CardSheet } from "@/components/board/card-sheet";
import { CardTile } from "@/components/board/card-tile";
import { PersonalBoardTools } from "@/components/board/personal-board-tools";
import { DynamicIcon } from "@/components/app/dynamic-icon";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Toggle } from "@/components/ui/toggle";
import { celebrateAt } from "@/lib/celebrate";
import { errorMessage, useTRPC, type RouterOutputs } from "@/lib/trpc/client";

export type BoardData = RouterOutputs["board"]["get"];
export type BoardCard = BoardData["cards"][number];
type Layout = Record<string, string[]>;

function layoutFrom(board: BoardData): Layout {
  const layout: Layout = Object.fromEntries(board.columns.map((c) => [c.id, [] as string[]]));
  for (const card of board.cards) layout[card.columnId]?.push(card.id);
  return layout;
}

export function BoardView({ boardId }: { boardId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const openCardId = params.get("card");

  const [dragging, setDragging] = useState<string | null>(null);
  const board = useQuery({ ...trpc.board.get.queryOptions({ boardId }), refetchInterval: dragging ? false : 5000 });
  const me = useQuery(trpc.me.get.queryOptions());
  // While dragging, the board renders from a local copy; otherwise straight from the server data.
  const [dragLayout, setDragLayout] = useState<Layout | null>(null);
  const [onlyMine, setOnlyMine] = useState(false);
  const [search, setSearch] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const dragOrigin = useRef<string | null>(null);

  const layout = useMemo(() => dragLayout ?? (board.data ? layoutFrom(board.data) : {}), [dragLayout, board.data]);
  const setLayout = (update: (prev: Layout) => Layout) => setDragLayout((prev) => update(prev ?? layout));
  const cardsById = useMemo(() => new Map(board.data?.cards.map((c) => [c.id, c]) ?? []), [board.data]);
  const columnOf = (cardId: string) => Object.keys(layout).find((col) => layout[col]?.includes(cardId));

  const move = useMutation(
    trpc.card.move.mutationOptions({
      onError: (e) => toast.error(errorMessage(e, "Couldn't move that card")),
      onSettled: () => {
        void queryClient.invalidateQueries({ queryKey: trpc.board.get.queryKey({ boardId }) });
        void queryClient.invalidateQueries({ queryKey: trpc.day.today.queryKey() });
      },
    }),
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (board.isError) {
    return (
      <div className="grid flex-1 place-items-center p-10 text-center">
        <div>
          <h1 className="text-2xl font-bold">This board isn&apos;t here</h1>
          <p className="mt-2 text-muted-foreground">{errorMessage(board.error)}</p>
        </div>
      </div>
    );
  }
  if (!board.data) return <BoardSkeleton />;
  const data = board.data;

  const query = search.trim().toLowerCase();
  const visible = (card: BoardCard) =>
    (!onlyMine || card.assigneeId === me.data?.id) &&
    (!query || card.title.toLowerCase().includes(query) || `${data.key}-${card.number}`.toLowerCase().includes(query));

  function onDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    setDragging(id);
    setDragLayout(layout);
    dragOrigin.current = columnOf(id) ?? null;
  }

  function onDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const from = columnOf(activeId);
    const to = layout[overId] ? overId : columnOf(overId);
    if (!from || !to || from === to) return;

    setLayout((prev) => {
      const source = prev[from]!.filter((id) => id !== activeId);
      const target = [...prev[to]!];
      const index = prev[overId] ? target.length : Math.max(0, target.indexOf(overId));
      target.splice(index, 0, activeId);
      return { ...prev, [from]: source, [to]: target };
    });
  }

  function onDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    const column = columnOf(activeId);
    setDragging(null);
    setDragLayout(null);
    if (!column || !overId) return;

    let ids = layout[column]!;
    const oldIndex = ids.indexOf(activeId);
    const newIndex = layout[overId] ? ids.length - 1 : ids.indexOf(overId);
    if (newIndex >= 0 && oldIndex !== newIndex) ids = arrayMove(ids, oldIndex, newIndex);
    const finalLayout = { ...layout, [column]: ids };

    const index = ids.indexOf(activeId);
    const card = cardsById.get(activeId);
    const unchanged = dragOrigin.current === column && oldIndex === index;
    if (!card || unchanged) return;

    // Optimistically write the new order into the cache so the card doesn't jump back.
    queryClient.setQueryData<BoardData>(trpc.board.get.queryKey({ boardId }), (old) =>
      old
        ? {
            ...old,
            cards: old.columns.flatMap((col) =>
              (finalLayout[col.id] ?? []).flatMap((id, i) => {
                const c = old.cards.find((x) => x.id === id);
                return c ? [{ ...c, columnId: col.id, position: i }] : [];
              }),
            ),
          }
        : old,
    );

    const target = data.columns.find((c) => c.id === column);
    if (target?.category === "DONE" && !card.completedAt) {
      celebrateAt(document.querySelector(`[data-card-id="${activeId}"]`));
      toast.success("Done and dusted", { description: card.title, duration: 2500 });
    }
    move.mutate({
      cardId: activeId,
      columnId: column,
      beforeId: ids[index - 1] ?? null,
      afterId: ids[index + 1] ?? null,
    });
  }

  const draggingCard = dragging ? cardsById.get(dragging) : null;
  const setCard = (cardId: string | null) => {
    const next = new URLSearchParams(params);
    if (cardId) next.set("card", cardId);
    else next.delete("card");
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-3 px-4 pt-5 pb-4 sm:px-6">
        {data.team ? (
          <span
            className={`grid size-9 place-items-center rounded-xl text-white tint-${data.team.color}`}
            style={{ background: "var(--tint)" }}
          >
            <DynamicIcon name={data.icon} className="size-5" stroke={2} />
          </span>
        ) : (
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <DynamicIcon name={data.icon} className="size-5" stroke={2} />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold">{data.name}</h1>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            {data.team ? (
              <>
                {data.team.name} team, cards are {data.key}-1, {data.key}-2...
              </>
            ) : (
              <>
                <IconLock className="size-3.5" /> Only you can see this board. Mirrored team cards stay in sync.
              </>
            )}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <InputGroup className="h-8 w-48">
            <InputGroupAddon>
              <IconSearch />
            </InputGroupAddon>
            <InputGroupInput placeholder="Filter cards" value={search} onChange={(e) => setSearch(e.target.value)} />
          </InputGroup>
          {data.ownerId ? (
            <PersonalBoardTools boardId={data.id} />
          ) : (
            <Toggle
              size="sm"
              variant="outline"
              pressed={onlyMine}
              onPressedChange={setOnlyMine}
              aria-label="Only my cards"
            >
              <IconUser />
              Mine
            </Toggle>
          )}
          <Button size="sm" variant="ghost" onClick={() => setSettingsOpen(true)}>
            <IconSettings />
            Workflow
          </Button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          setDragging(null);
          setDragLayout(null);
        }}
      >
        <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto px-4 pb-6 sm:px-6">
          {data.columns.map((column) => (
            <BoardColumn
              key={column.id}
              boardId={data.id}
              column={column}
              cards={(layout[column.id] ?? [])
                .map((id) => cardsById.get(id))
                .filter((c): c is BoardCard => Boolean(c && visible(c)))}
              boardKey={data.key}
              plannedIds={data.plannedCardIds}
              onOpenCard={setCard}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={{ duration: 220, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" }}>
          {draggingCard && (
            <div className="rotate-[3deg] scale-105 cursor-grabbing">
              <CardTile
                card={draggingCard}
                boardKey={data.key}
                planned={data.plannedCardIds.includes(draggingCard.id)}
                overlay
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <CardSheet cardId={openCardId} onClose={() => setCard(null)} />
      <BoardSettingsDialog board={data} open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}

export function BoardSkeleton() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-3 px-6 pt-5 pb-4">
        <Skeleton className="size-9 rounded-xl" />
        <Skeleton className="h-7 w-48" />
      </div>
      <div className="flex gap-3 px-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="w-72 shrink-0 space-y-2">
            <Skeleton className="h-6 w-28" />
            {Array.from({ length: 3 - (i % 2) }).map((__, j) => (
              <Skeleton key={j} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
