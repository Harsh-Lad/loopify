"use client";

import { IconCheck, IconFilePlus, IconTable } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDeferredValue, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { errorMessage, useTRPC } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

export type SheetMention = { id: string; title: string };

/**
 * Pick one or more spreadsheets to talk about. Stays open so several can be
 * ticked, and can create a brand new spreadsheet from whatever was typed.
 */
export function SheetMentionPicker({
  open,
  onOpenChange,
  selected,
  onToggle,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selected: SheetMention[];
  onToggle: (sheet: SheetMention) => void;
  /** The element the picker floats above, usually the composer. */
  children: ReactNode;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const toggle = (sheet: SheetMention) => {
    onToggle(sheet);
    // Keep typing in the search box after ticking a sheet.
    requestAnimationFrame(() => input.current?.focus());
  };
  const deferred = useDeferredValue(query.trim());
  const files = useQuery({
    ...trpc.sheets.browse.queryOptions({ query: deferred || undefined }),
    enabled: open,
    placeholderData: (prev) => prev,
  });
  const create = useMutation(
    trpc.sheets.createSpreadsheet.mutationOptions({ onError: (e) => toast.error(errorMessage(e)) }),
  );
  const createSheet = (title: string) =>
    create.mutate(
      { title },
      {
        onSuccess: ({ id }) => {
          toggle({ id, title });
          setQuery("");
          toast.success(`Created "${title}" in your Google Drive`);
          void queryClient.invalidateQueries({ queryKey: trpc.sheets.browse.queryKey() });
        },
      },
    );
  const isPicked = (id: string) => selected.some((s) => s.id === id);
  const exact = files.data?.files.some((f) => f.name.toLowerCase() === deferred.toLowerCase());

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor asChild>{children}</PopoverAnchor>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={8}
        className="w-(--radix-popover-trigger-width) max-w-md min-w-72 p-0"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          input.current?.focus();
        }}
      >
        <Command shouldFilter={false} className="rounded-lg">
          <CommandInput
            ref={input}
            placeholder="Find a sheet, or type a name for a new one"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList className="max-h-72">
            <CommandEmpty>{files.isFetching ? "Looking through your Drive..." : "No sheets match."}</CommandEmpty>
            {deferred && !exact && (
              <>
                <CommandGroup>
                  <CommandItem
                    value={`create:${deferred}`}
                    onSelect={() => !create.isPending && createSheet(deferred)}
                    className="text-brand"
                  >
                    {create.isPending ? <Spinner /> : <IconFilePlus className="text-brand" />}
                    <span className="truncate">
                      Create new sheet <strong>&ldquo;{deferred}&rdquo;</strong>
                    </span>
                  </CommandItem>
                </CommandGroup>
                <CommandSeparator />
              </>
            )}
            {selected.length > 0 && !deferred && (
              <>
                <CommandGroup heading="Picked">
                  {selected.map((s) => (
                    <PickItem key={s.id} sheet={s} picked onToggle={toggle} />
                  ))}
                </CommandGroup>
                <CommandSeparator />
              </>
            )}
            <CommandGroup heading={deferred ? "Matching sheets" : "Recent sheets"}>
              {files.data?.files
                .filter((f) => deferred || !isPicked(f.id))
                .map((f) => (
                  <PickItem key={f.id} sheet={{ id: f.id, title: f.name }} picked={isPicked(f.id)} onToggle={toggle} />
                ))}
            </CommandGroup>
          </CommandList>
          <p className="border-t px-3 py-2 text-xs text-muted-foreground">
            Pick as many as you need. <kbd className="font-sans font-medium">Esc</kbd> to close.
          </p>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function PickItem({
  sheet,
  picked,
  onToggle,
}: {
  sheet: SheetMention;
  picked: boolean;
  onToggle: (sheet: SheetMention) => void;
}) {
  return (
    <CommandItem value={sheet.id} onSelect={() => onToggle(sheet)} className="group/pick">
      <span
        className={cn(
          "grid size-5 shrink-0 place-items-center rounded-md border transition-colors",
          picked ? "border-primary bg-primary text-primary-foreground" : "bg-background",
        )}
      >
        {picked ? <IconCheck className="size-3.5" /> : <IconTable className="size-3 text-success" />}
      </span>
      <span className="truncate">{sheet.title}</span>
    </CommandItem>
  );
}
