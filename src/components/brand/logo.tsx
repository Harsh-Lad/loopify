import { cn } from "@/lib/utils";

/**
 * The Loopify mark (direction 03, "Ink Block"): a paper tile with an ink border,
 * lifted off a brand-yellow block, carrying a hand-drawn looped "l".
 * Colors come from theme tokens, so the mark flips with light and dark mode.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" aria-hidden className={cn("size-7", className)}>
      <rect x="18" y="18" width="94" height="94" rx="20" className="fill-primary" />
      <rect x="8" y="8" width="94" height="94" rx="20" strokeWidth="8" className="fill-card stroke-foreground" />
      <path
        d="M34 80C47 68 64 45 59.5 31.5 55.5 19.5 38.5 27.5 42 50.5 45 69 54 81 74 76"
        fill="none"
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-foreground"
      />
    </svg>
  );
}

/** Mark plus the serif "loopify" wordmark. `compact` shows the mark alone. */
export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 select-none", className)}>
      <LogoMark />
      {!compact && (
        <span className="font-wordmark text-xl leading-none font-extrabold tracking-[-0.02em]">loopify</span>
      )}
    </span>
  );
}
