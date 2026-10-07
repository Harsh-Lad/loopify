"use client";

import {
  IconCalendarMonth,
  IconChartBar,
  IconLayoutDashboard,
  IconShieldLock,
  IconLayoutKanban,
  IconMoon,
  IconSettings,
  IconSparkles,
  IconSquareCheck,
  IconSunHigh,
  IconTable,
  IconTemplate,
  IconUserPlus,
  IconUsersGroup,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useDeferredValue, useState } from "react";
import { useShell } from "@/components/app/shell-context";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useTRPC } from "@/lib/trpc/client";

export function CommandPalette() {
  const { commandOpen, setCommandOpen, openCapture, setInviteOpen } = useShell();
  const router = useRouter();
  const trpc = useTRPC();
  const { resolvedTheme, setTheme } = useTheme();
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query.trim());

  const boards = useQuery({ ...trpc.board.list.queryOptions(), enabled: commandOpen });
  const me = useQuery(trpc.me.get.queryOptions());
  const cards = useQuery({
    ...trpc.card.search.queryOptions({ query: deferred }),
    enabled: commandOpen && deferred.length >= 2,
  });

  const run = (fn: () => void) => {
    setCommandOpen(false);
    setQuery("");
    fn();
  };
  const go = (href: string) => run(() => router.push(href));

  return (
    <CommandDialog
      open={commandOpen}
      onOpenChange={setCommandOpen}
      title="Jump anywhere"
      description="Search pages, boards and cards"
    >
      <Command>
        <CommandInput placeholder="Search cards, boards, pages..." value={query} onValueChange={setQuery} />
        <CommandList>
          <CommandEmpty>Nothing matches that. Try another word.</CommandEmpty>

          {cards.data && cards.data.length > 0 && (
            <CommandGroup heading="Cards">
              {cards.data.map((card) => (
                <CommandItem
                  key={card.id}
                  value={`card ${card.board.key}-${card.number} ${card.title}`}
                  onSelect={() => go(`/boards/${card.board.id}?card=${card.id}`)}
                >
                  <IconSquareCheck className={card.completedAt ? "text-success" : undefined} />
                  <span className="truncate">{card.title}</span>
                  <CommandShortcut>{`${card.board.key}-${card.number}`}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          <CommandGroup heading="Go to">
            <CommandItem onSelect={() => go("/dashboard")}>
              <IconLayoutDashboard /> Dashboard
            </CommandItem>
            <CommandItem onSelect={() => go("/today")}>
              <IconSunHigh /> Today
            </CommandItem>
            <CommandItem onSelect={() => go("/capture")}>
              <IconSparkles /> Capture inbox
            </CommandItem>
            <CommandItem onSelect={() => go("/sheets")}>
              <IconTable /> Sheets
            </CommandItem>
            <CommandItem onSelect={() => go("/calendar")}>
              <IconCalendarMonth /> Calendar
            </CommandItem>
            <CommandItem onSelect={() => go("/reports")}>
              <IconChartBar /> Reports
            </CommandItem>
            {me.data?.isPlatformAdmin && (
              <CommandItem onSelect={() => go("/admin")}>
                <IconShieldLock /> Platform admin
              </CommandItem>
            )}
            <CommandItem onSelect={() => go("/teams")}>
              <IconUsersGroup /> Teams
            </CommandItem>
            <CommandItem onSelect={() => go("/templates")}>
              <IconTemplate /> Workflows
            </CommandItem>
            <CommandItem onSelect={() => go("/settings")}>
              <IconSettings /> Settings
            </CommandItem>
          </CommandGroup>

          {boards.data && boards.data.length > 0 && (
            <CommandGroup heading="Boards">
              {boards.data.map((board) => (
                <CommandItem
                  key={board.id}
                  value={`board ${board.name} ${board.team?.name ?? "personal"}`}
                  onSelect={() => go(`/boards/${board.id}`)}
                >
                  <IconLayoutKanban />
                  {board.name}
                  <CommandShortcut>{board.team?.name ?? "Personal"}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          <CommandSeparator />
          <CommandGroup heading="Do">
            <CommandItem onSelect={() => run(() => openCapture())}>
              <IconSparkles /> Capture a conversation
              <CommandShortcut>C</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => run(() => setInviteOpen(true))}>
              <IconUserPlus /> Invite someone
            </CommandItem>
            <CommandItem onSelect={() => run(() => setTheme(resolvedTheme === "dark" ? "light" : "dark"))}>
              <IconMoon /> Switch to {resolvedTheme === "dark" ? "light" : "dark"} mode
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
