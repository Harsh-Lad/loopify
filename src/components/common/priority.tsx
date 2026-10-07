import {
  IconAntennaBars1,
  IconAntennaBars3,
  IconAntennaBars4,
  IconAntennaBars5,
  IconUrgent,
  type Icon,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

export const PRIORITIES: {
  value: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  label: string;
  icon: Icon;
  className: string;
}[] = [
  { value: "NONE", label: "No priority", icon: IconAntennaBars1, className: "text-muted-foreground" },
  { value: "LOW", label: "Low", icon: IconAntennaBars3, className: "text-muted-foreground" },
  { value: "MEDIUM", label: "Medium", icon: IconAntennaBars4, className: "text-foreground" },
  { value: "HIGH", label: "High", icon: IconAntennaBars5, className: "text-[oklch(0.7_0.17_50)]" },
  { value: "URGENT", label: "Urgent", icon: IconUrgent, className: "text-destructive" },
];

export function PriorityIcon({ priority, className }: { priority: string; className?: string }) {
  const p = PRIORITIES.find((x) => x.value === priority) ?? PRIORITIES[0]!;
  if (p.value === "NONE") return null;
  return <p.icon className={cn("size-4", p.className, className)} stroke={2} aria-label={`${p.label} priority`} />;
}
