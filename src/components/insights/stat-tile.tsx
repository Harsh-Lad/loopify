"use client";

import { IconArrowDownRight, IconArrowUpRight, IconMinus } from "@tabler/icons-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A headline number. The tile owns the "rest" / "active" variants, so an
 * animated icon passed with trigger="inherit" plays while the tile is hovered.
 */
export function StatTile({
  label,
  value,
  hint,
  icon,
  delta,
  tone = "default",
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  /** Change vs the previous period, as a signed whole number. */
  delta?: { value: number; label: string } | null;
  tone?: "default" | "brand" | "danger" | "success";
  className?: string;
}) {
  return (
    <motion.div
      initial="rest"
      animate="rest"
      whileHover="active"
      className={cn(
        "group relative flex flex-col gap-1 overflow-hidden rounded-2xl border bg-card p-4 text-card-foreground shadow-xs transition-shadow hover:shadow-md",
        tone === "brand" && "border-primary/50 bg-primary text-primary-foreground",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={cn("text-sm", tone === "brand" ? "text-primary-foreground/75" : "text-muted-foreground")}>
          {label}
        </p>
        {icon && (
          <span
            className={cn(
              "grid size-10 shrink-0 place-items-center rounded-xl",
              tone === "brand" && "bg-primary-foreground/10 text-primary-foreground",
              tone === "default" && "bg-brand-soft text-brand",
              tone === "danger" && "bg-destructive/10 text-destructive",
              tone === "success" && "bg-success/15 text-success",
            )}
          >
            {icon}
          </span>
        )}
      </div>
      <p className="font-heading text-3xl font-bold tracking-tight tabular-nums">{value}</p>
      {(hint || delta) && (
        <div
          className={cn(
            "flex flex-wrap items-center gap-x-2 gap-y-1 text-xs",
            tone === "brand" ? "text-primary-foreground/75" : "text-muted-foreground",
          )}
        >
          {delta && <Delta {...delta} onBrand={tone === "brand"} />}
          {hint}
        </div>
      )}
    </motion.div>
  );
}

function Delta({ value, label, onBrand }: { value: number; label: string; onBrand?: boolean }) {
  const Icon = value > 0 ? IconArrowUpRight : value < 0 ? IconArrowDownRight : IconMinus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium",
        onBrand
          ? "bg-primary-foreground/10 text-primary-foreground"
          : value > 0
            ? "bg-success/15 text-foreground"
            : value < 0
              ? "bg-destructive/10 text-destructive"
              : "bg-muted text-muted-foreground",
      )}
    >
      <Icon className="size-3.5" stroke={2.2} />
      {value > 0 ? `+${value}` : value} {label}
    </span>
  );
}
