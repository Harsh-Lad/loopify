import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
  className,
}: {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "center" | "left";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex max-w-2xl flex-col gap-3",
        align === "center" && "mx-auto items-center text-center",
        className,
      )}
    >
      <span className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold tracking-wide text-brand uppercase">
        {eyebrow}
      </span>
      <h2 className="font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl">{title}</h2>
      {description && <p className="text-base text-pretty text-muted-foreground sm:text-lg">{description}</p>}
    </div>
  );
}
