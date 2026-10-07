import { IconCalendarEvent } from "@tabler/icons-react";
import { differenceInCalendarDays, format } from "date-fns";
import { cn } from "@/lib/utils";

export function DueDate({
  date,
  done,
  className,
}: {
  date: Date | string | null | undefined;
  done?: boolean;
  className?: string;
}) {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  const days = differenceInCalendarDays(d, new Date());
  const label = days === 0 ? "Today" : days === 1 ? "Tomorrow" : days === -1 ? "Yesterday" : format(d, "d MMM");
  const tone = done
    ? "text-muted-foreground"
    : days < 0
      ? "text-destructive"
      : days <= 1
        ? "text-[oklch(0.62_0.15_60)]"
        : "text-muted-foreground";
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs", tone, className)}>
      <IconCalendarEvent className="size-3.5" stroke={2} />
      {label}
    </span>
  );
}
