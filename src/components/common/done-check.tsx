"use client";

import { IconCheck } from "@tabler/icons-react";
import { motion } from "motion/react";
import { useRef } from "react";
import { celebrateAt } from "@/lib/celebrate";
import { cn } from "@/lib/utils";

/** The big round "done" tick. Bounces and throws a little confetti when checked. */
export function DoneCheck({
  checked,
  onCheckedChange,
  disabled,
  className,
  label = "Mark as done",
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  label?: string;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <motion.button
      ref={ref}
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={checked ? "Mark as not done" : label}
      disabled={disabled}
      whileTap={{ scale: 0.8 }}
      onClick={(e) => {
        e.stopPropagation();
        if (!checked) celebrateAt(ref.current);
        onCheckedChange(!checked);
      }}
      className={cn(
        "grid size-6 shrink-0 place-items-center rounded-full border-2 transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50",
        checked
          ? "border-success bg-success text-success-foreground"
          : "border-muted-foreground/40 hover:border-success hover:bg-success/10",
        className,
      )}
    >
      <motion.span
        initial={false}
        animate={checked ? { scale: [0.4, 1.25, 1], opacity: 1 } : { scale: 0.4, opacity: 0 }}
        transition={{ duration: 0.35 }}
      >
        <IconCheck className="size-3.5" stroke={3} />
      </motion.span>
    </motion.button>
  );
}
