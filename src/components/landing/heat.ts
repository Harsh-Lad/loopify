/** Deterministic pseudo-random heat levels (0-4) so server and client render the same mock heatmap. */
export function heatLevel(index: number, total: number): number {
  const hash = (Math.imul(index + 7, 2654435761) >>> 0) % 100;
  const trend = (index / total) * 35;
  const score = hash * 0.75 + trend;
  if (score < 18) return 0;
  if (score < 38) return 1;
  if (score < 56) return 2;
  if (score < 72) return 3;
  return 4;
}

export const HEAT_CLASSES = ["bg-(--heat-0)", "bg-(--heat-1)", "bg-(--heat-2)", "bg-(--heat-3)", "bg-(--heat-4)"];
