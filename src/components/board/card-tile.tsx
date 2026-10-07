"use client";

import { IconArrowBackUp, IconLink, IconMessageCircle, IconSitemap, IconSunHigh } from "@tabler/icons-react";
import { DueDate } from "@/components/common/due-date";
import { PriorityIcon } from "@/components/common/priority";
import { UserAvatar } from "@/components/app/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { BoardCard } from "@/components/board/board-view";
import { cn } from "@/lib/utils";

export function CardTile({
  card,
  boardKey,
  planned,
  overlay,
  dragging,
}: {
  card: BoardCard;
  boardKey: string;
  planned: boolean;
  overlay?: boolean;
  dragging?: boolean;
}) {
  const done = Boolean(card.completedAt);
  return (
    <div
      data-card-id={card.id}
      className={cn(
        "group/card relative rounded-xl border bg-card p-3 text-left text-sm shadow-xs transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-md",
        overlay && "shadow-xl ring-2 ring-primary/40",
        dragging && "opacity-35",
        card.rolloverCount >= 3 && !done && "animate-[nudge_0.7s_ease-in-out_2] border-highlight",
      )}
    >
      <div className="flex items-start gap-2">
        <p
          className={cn(
            "flex-1 leading-snug font-medium text-pretty",
            done && "text-muted-foreground line-through decoration-2",
          )}
        >
          {card.title}
        </p>
        {card.assignee && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <UserAvatar name={card.assignee.name} image={card.assignee.image} />
              </span>
            </TooltipTrigger>
            <TooltipContent>{card.assignee.name}</TooltipContent>
          </Tooltip>
        )}
      </div>

      {card.mirror && (
        <p
          className="mt-1.5 inline-flex max-w-full items-center gap-1 rounded-md bg-brand-soft px-1.5 py-0.5 text-[11px] font-medium text-brand"
          title="Mirrored from a team board. Status and details stay in sync."
        >
          <IconLink className="size-3 shrink-0" />
          <span className="truncate">
            {card.mirror.boardName} · {card.mirror.status}
          </span>
        </p>
      )}

      {card.labels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {card.labels.map((label) => (
            <Badge key={label} variant="secondary" className="font-normal">
              {label}
            </Badge>
          ))}
        </div>
      )}

      <div className="mt-2.5 flex items-center gap-2.5 text-xs text-muted-foreground">
        <span className="tabular-nums">
          {card.mirror?.boardKey ?? boardKey}-{card.number}
        </span>
        <PriorityIcon priority={card.priority} className="size-3.5" />
        <DueDate date={card.dueDate} done={done} />
        {card._count.subtasks > 0 && (
          <span className="inline-flex items-center gap-0.5">
            <IconSitemap className="size-3.5" />
            {card._count.subtasks}
          </span>
        )}
        {card._count.comments > 0 && (
          <span className="inline-flex items-center gap-0.5">
            <IconMessageCircle className="size-3.5" />
            {card._count.comments}
          </span>
        )}
        {card.rolloverCount > 0 && !done && (
          <span className="inline-flex items-center gap-0.5" title={`Rolled over ${card.rolloverCount} times`}>
            <IconArrowBackUp className="size-3.5" />
            {card.rolloverCount}
          </span>
        )}
        {planned && (
          <span
            className="ml-auto inline-flex items-center gap-0.5 font-medium text-highlight-foreground dark:text-highlight"
            title="On your plan today"
          >
            <IconSunHigh className="size-3.5" />
            Today
          </span>
        )}
      </div>
    </div>
  );
}
