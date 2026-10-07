"use client";

import { IconPlus, IconSquarePlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { DueDate } from "@/components/common/due-date";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { errorMessage, useTRPC } from "@/lib/trpc/client";

/** Pick from your open cards, or type a new one straight into today. */
export function AddToToday({ plannedCardIds }: { plannedCardIds: string[] }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [boardId, setBoardId] = useState<string | null>(null);

  const mine = useQuery({ ...trpc.card.mine.queryOptions({ includeDone: false }), enabled: open });
  const boards = useQuery({ ...trpc.board.list.queryOptions(), enabled: open });
  const selectedBoard = boardId ?? boards.data?.[0]?.id ?? null;

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: trpc.day.today.queryKey() });
    void queryClient.invalidateQueries({ queryKey: trpc.card.mine.queryKey() });
  };

  const plan = useMutation(
    trpc.day.plan.mutationOptions({
      onSuccess: () => {
        refresh();
        setQuery("");
      },
      onError: (e) => toast.error(errorMessage(e)),
    }),
  );
  const create = useMutation(
    trpc.card.create.mutationOptions({
      onSuccess: async (card) => {
        await plan.mutateAsync({ cardId: card.id });
        toast.success(`Created ${card.key} and added it to today`);
        void queryClient.invalidateQueries({ queryKey: trpc.board.get.queryKey({ boardId: card.boardId }) });
      },
      onError: (e) => toast.error(errorMessage(e)),
    }),
  );

  const me = useQuery(trpc.me.get.queryOptions());
  const available = mine.data?.filter((c) => !plannedCardIds.includes(c.id)) ?? [];
  const trimmed = query.trim();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <IconPlus />
          Add to today
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(26rem,calc(100vw-2rem))] p-0">
        <Command shouldFilter>
          <CommandInput placeholder="Find a card or type a new one..." value={query} onValueChange={setQuery} />
          <CommandList className="max-h-80">
            <CommandEmpty>{trimmed ? "No card like that yet." : "No open cards assigned to you."}</CommandEmpty>
            {available.length > 0 && (
              <CommandGroup heading="Your open cards">
                {available.map((card) => (
                  <CommandItem
                    key={card.id}
                    value={`${card.key} ${card.title}`}
                    onSelect={() => plan.mutate({ cardId: card.id })}
                  >
                    <IconSquarePlus className="text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{card.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {card.key}, {card.column.name}
                      </p>
                    </div>
                    <DueDate date={card.dueDate} />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {trimmed && selectedBoard && (
              <CommandGroup heading="New card" forceMount>
                <CommandItem
                  forceMount
                  value={`__create ${trimmed}`}
                  disabled={create.isPending}
                  onSelect={() =>
                    create.mutate({ boardId: selectedBoard, title: trimmed, assigneeId: me.data?.id ?? null })
                  }
                >
                  <IconPlus className="text-brand" />
                  <span className="truncate">Create &ldquo;{trimmed}&rdquo;</span>
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
        {boards.data && boards.data.length > 1 && (
          <div className="flex items-center gap-2 border-t p-2 text-xs text-muted-foreground">
            New cards go to
            <Select value={selectedBoard ?? undefined} onValueChange={setBoardId}>
              <SelectTrigger size="sm" className="h-7 flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {boards.data.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
