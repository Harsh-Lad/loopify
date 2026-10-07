"use client";

import { AnimatedBell } from "@/components/brand/animated-icons";
import { IconBell, IconBellRinging } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTRPC } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const list = useQuery({ ...trpc.notification.list.queryOptions(), refetchInterval: 30_000 });
  const markRead = useMutation(
    trpc.notification.markRead.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: trpc.notification.list.queryKey() }),
    }),
  );
  const unread = list.data?.unread ?? 0;

  return (
    <Popover onOpenChange={(open) => !open && unread > 0 && markRead.mutate({})}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={unread ? `${unread} unread notifications` : "Notifications"}
          className="relative"
        >
          {unread ? <IconBellRinging className="origin-top animate-[wiggle_1s_ease-in-out_2]" /> : <IconBell />}
          {unread > 0 && (
            <span className="absolute top-1.5 right-1.5 grid min-w-4 place-items-center rounded-full bg-highlight px-1 text-[10px] font-bold text-highlight-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-4 py-3 font-heading font-semibold">Notifications</div>
        {list.data?.items.length ? (
          <ScrollArea className="max-h-96">
            <ul className="divide-y">
              {list.data.items.map((n) => (
                <li key={n.id}>
                  <Link
                    href={n.link ?? "#"}
                    className={cn("block px-4 py-3 text-sm hover:bg-muted", !n.readAt && "bg-accent/40")}
                  >
                    <p className="font-medium leading-snug">{n.title}</p>
                    {n.body && <p className="mt-0.5 line-clamp-2 text-muted-foreground">{n.body}</p>}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDistanceToNowStrict(n.createdAt, { addSuffix: true })}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </ScrollArea>
        ) : (
          <Empty className="p-8">
            <EmptyHeader>
              <EmptyMedia variant="icon" className="size-14 rounded-2xl bg-brand-soft text-brand">
                <AnimatedBell className="size-8" trigger="loop" />
              </EmptyMedia>
              <EmptyTitle>All quiet</EmptyTitle>
              <EmptyDescription>Comments and new assignments land here.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </PopoverContent>
    </Popover>
  );
}
