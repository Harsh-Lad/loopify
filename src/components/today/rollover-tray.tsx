"use client";

import { IconArrowBackUp, IconX } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { differenceInCalendarDays, format } from "date-fns";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { DueDate } from "@/components/common/due-date";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { celebrateBig } from "@/lib/celebrate";
import { errorMessage, useTRPC, type RouterOutputs } from "@/lib/trpc/client";

type Yesterday = NonNullable<RouterOutputs["day"]["today"]["yesterday"]>;

function dayLabel(dayKey: string) {
  const date = new Date(`${dayKey}T12:00:00`);
  const diff = differenceInCalendarDays(new Date(), date);
  if (diff === 1) return "yesterday";
  if (diff < 7) return `on ${format(date, "EEEE")}`;
  return `on ${format(date, "d MMM")}`;
}

/**
 * The morning moment: what didn't get finished last time, ready to carry into
 * today with one tap or let go of on purpose.
 */
export function RolloverTray({ yesterday }: { yesterday: Yesterday }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: trpc.day.today.queryKey() });

  const rollover = useMutation(
    trpc.day.rollover.mutationOptions({
      onSuccess: async ({ rolled }, variables) => {
        await invalidate();
        if (!variables.itemIds) {
          celebrateBig();
          toast.success(`${rolled} ${rolled === 1 ? "card" : "cards"} rolled into today`);
        }
      },
      onError: (e) => toast.error(errorMessage(e)),
    }),
  );
  const drop = useMutation(
    trpc.day.dropLeftover.mutationOptions({
      onSuccess: () => invalidate(),
      onError: (e) => toast.error(errorMessage(e)),
    }),
  );

  const count = yesterday.left.length;

  return (
    <motion.section
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8 overflow-hidden rounded-2xl border-2 border-highlight/70 bg-highlight/12"
      aria-labelledby="rollover-title"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4">
        <div>
          <h2 id="rollover-title" className="font-heading text-lg font-bold">
            {count} {count === 1 ? "thing" : "things"} left {dayLabel(yesterday.dayKey)}
          </h2>
          <p className="text-sm text-muted-foreground">Carry them into today, or let go of what no longer matters.</p>
        </div>
        <Button variant="highlight" onClick={() => rollover.mutate({})} disabled={rollover.isPending}>
          <IconArrowBackUp />
          Roll all into today
        </Button>
      </div>

      <ul className="mt-3 divide-y divide-highlight/30 px-2 pb-2">
        <AnimatePresence initial={false}>
          {yesterday.left.map((item) => (
            <motion.li
              key={item.id}
              layout
              exit={{ opacity: 0, x: 40, transition: { duration: 0.2 } }}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{item.card.title}</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{item.card.key}</span>
                  <span>{item.card.boardName}</span>
                  <DueDate date={item.card.dueDate} />
                  {item.card.rolloverCount >= 2 && (
                    <Badge variant="highlight" className="animate-[nudge_0.6s_ease-in-out_3]">
                      rolled {item.card.rolloverCount}×
                    </Badge>
                  )}
                </div>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Let it go"
                    onClick={() => drop.mutate({ itemId: item.id })}
                    disabled={drop.isPending}
                  >
                    <IconX />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Let it go (stays on its board)</TooltipContent>
              </Tooltip>
              <Button
                size="sm"
                variant="outline"
                onClick={() => rollover.mutate({ itemIds: [item.id] })}
                disabled={rollover.isPending}
              >
                Roll over
              </Button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      {yesterday.left.some((i) => i.card.rolloverCount >= 3) && (
        <p className="border-t border-highlight/30 px-5 py-3 text-sm text-highlight-foreground dark:text-highlight">
          Some of these keep rolling. Maybe break them into smaller pieces, or hand them to someone else?
        </p>
      )}
    </motion.section>
  );
}
