"use client";

import { IconChevronLeft, IconChevronRight, IconSearch, IconX } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import { format } from "date-fns";
import { useEffect, useState, type ReactNode } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { AnimatedShield } from "@/components/brand/animated-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { useTRPC } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

export const PAGE_SIZE = 25;

export function isForbidden(error: unknown) {
  return error instanceof TRPCClientError && error.data?.code === "FORBIDDEN";
}

/** The value, settled for `ms` after the last change. */
export function useDebounced<T>(value: T, ms = 300) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return settled;
}

export function AdminsOnly() {
  return (
    <Empty className="honeycomb min-h-[50vh] rounded-2xl border">
      <EmptyHeader>
        <EmptyMedia className="grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand">
          <AnimatedShield trigger="mount" className="size-8" />
        </EmptyMedia>
        <EmptyTitle className="font-heading text-lg">Admins only</EmptyTitle>
        <EmptyDescription>
          The platform console is for the people who run Loopify. If you need access, ask an existing platform admin.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

/** Renders the console only for platform admins, a friendly empty state otherwise. */
export function AdminGate({ children }: { children: ReactNode }) {
  const trpc = useTRPC();
  const me = useQuery(trpc.me.get.queryOptions());
  if (me.isPending) return <Skeleton className="mt-6 h-80 rounded-2xl" />;
  if (!me.data?.isPlatformAdmin) return <AdminsOnly />;
  return children;
}

export function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <InputGroup className="w-full sm:max-w-xs">
      <InputGroupAddon>
        <IconSearch />
      </InputGroupAddon>
      <InputGroupInput
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      {value && (
        <InputGroupAddon align="inline-end">
          <InputGroupButton size="icon-xs" aria-label="Clear search" onClick={() => onChange("")}>
            <IconX />
          </InputGroupButton>
        </InputGroupAddon>
      )}
    </InputGroup>
  );
}

export function Pager({
  cursor,
  count,
  total,
  nextCursor,
  onChange,
  noun,
}: {
  cursor: number;
  count: number;
  total: number;
  nextCursor: number | null;
  onChange: (cursor: number) => void;
  noun: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-t px-4 py-3 text-sm text-muted-foreground">
      <span className="tabular-nums">
        {total === 0 ? `No ${noun}` : `${cursor + 1}–${cursor + count} of ${total} ${noun}`}
      </span>
      <div className="flex gap-1">
        <Button
          size="icon-sm"
          variant="outline"
          aria-label="Previous page"
          disabled={cursor === 0}
          onClick={() => onChange(Math.max(0, cursor - PAGE_SIZE))}
        >
          <IconChevronLeft />
        </Button>
        <Button
          size="icon-sm"
          variant="outline"
          aria-label="Next page"
          disabled={nextCursor == null}
          onClick={() => nextCursor != null && onChange(nextCursor)}
        >
          <IconChevronRight />
        </Button>
      </div>
    </div>
  );
}

export function StatusBadge({ suspendedAt }: { suspendedAt: Date | null }) {
  return suspendedAt ? (
    <Badge variant="destructive" title={`Suspended ${format(suspendedAt, "d MMM yyyy")}`}>
      Suspended
    </Badge>
  ) : (
    <Badge variant="success">Active</Badge>
  );
}

const dayLabel = (v: string) => format(new Date(`${v}T12:00:00`), "d MMM");
const dayLabelLong = (v: unknown) => format(new Date(`${String(v)}T12:00:00`), "EEEE, d MMM");

/** One series over 30 days. Small multiples instead of a shared or dual axis. */
export function DailyAreaChart({
  data,
  dataKey,
  label,
  color,
  className,
}: {
  data: Record<string, string | number>[];
  dataKey: string;
  label: string;
  color: string;
  className?: string;
}) {
  const config = { [dataKey]: { label, color } } satisfies ChartConfig;
  const gradientId = `fill-${dataKey}`;
  return (
    <ChartContainer config={config} className={cn("aspect-auto h-40 w-full", className)}>
      <AreaChart data={data} margin={{ left: 0, right: 4, top: 6 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={`var(--color-${dataKey})`} stopOpacity={0.35} />
            <stop offset="95%" stopColor={`var(--color-${dataKey})`} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeOpacity={0.5} />
        <XAxis
          dataKey="dayKey"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
          tickFormatter={dayLabel}
        />
        <YAxis tickLine={false} axisLine={false} width={28} allowDecimals={false} />
        <ChartTooltip cursor content={<ChartTooltipContent indicator="line" labelFormatter={dayLabelLong} />} />
        <Area
          dataKey={dataKey}
          type="monotone"
          stroke={`var(--color-${dataKey})`}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          activeDot={{ r: 4 }}
        />
      </AreaChart>
    </ChartContainer>
  );
}
