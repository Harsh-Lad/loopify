"use client";

import { useQuery } from "@tanstack/react-query";
import { DynamicIcon } from "@/components/app/dynamic-icon";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { useTRPC } from "@/lib/trpc/client";
import type { PresetColumn } from "@/lib/workflow-presets";
import { cn } from "@/lib/utils";

export function TemplatePicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const trpc = useTRPC();
  const templates = useQuery(trpc.template.list.queryOptions());
  if (!templates.data) return <Skeleton className="h-48 rounded-xl" />;

  return (
    <RadioGroup value={value} onValueChange={onChange} className="grid gap-2 sm:grid-cols-2">
      {templates.data.map((t) => (
        <label
          key={t.id}
          className={cn(
            "flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors hover:bg-muted/60",
            value === t.id && "border-primary bg-primary/5 ring-2 ring-primary/20",
          )}
        >
          <RadioGroupItem value={t.id} className="sr-only" />
          <DynamicIcon name={t.icon} className="mt-0.5 size-5 shrink-0 text-brand" />
          <span className="min-w-0">
            <span className="block text-sm font-medium">{t.name}</span>
            <span className="mt-1 flex flex-wrap gap-1">
              {(t.columns as unknown as PresetColumn[]).map((c) => (
                <span
                  key={c.name}
                  className={cn("inline-flex items-center gap-1 text-[11px] text-muted-foreground", `tint-${c.color}`)}
                >
                  <span className="size-1.5 rounded-full" style={{ background: "var(--tint)" }} />
                  {c.name}
                </span>
              ))}
            </span>
          </span>
        </label>
      ))}
    </RadioGroup>
  );
}
