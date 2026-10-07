import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const TINTS = ["blue", "violet", "pink", "orange", "amber", "green", "teal", "sky"];

function tintFor(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return TINTS[hash % TINTS.length];
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

/** Avatar with a stable, name-derived colour so people are recognisable at a glance. */
export function UserAvatar({ name, image, className }: { name: string; image?: string | null; className?: string }) {
  return (
    <Avatar className={cn("size-6", className)}>
      {image && <AvatarImage src={image} alt="" />}
      <AvatarFallback
        className={cn("font-heading text-[0.7em] font-bold text-white", `tint-${tintFor(name)}`)}
        style={{ background: "var(--tint)" }}
      >
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
