"use client";

import confetti from "canvas-confetti";

const COLORS = ["#3d5afe", "#ffc94a", "#2bc48a", "#ff6b5b", "#b06cf5"];

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** A small burst from a point on screen, e.g. the checkbox that was just ticked. */
export function celebrateAt(element?: Element | null) {
  if (reducedMotion()) return;
  const rect = element?.getBoundingClientRect();
  const origin = rect
    ? { x: (rect.left + rect.width / 2) / window.innerWidth, y: (rect.top + rect.height / 2) / window.innerHeight }
    : { x: 0.5, y: 0.6 };
  void confetti({
    particleCount: 28,
    spread: 55,
    startVelocity: 22,
    gravity: 0.9,
    scalar: 0.7,
    ticks: 120,
    origin,
    colors: COLORS,
    disableForReducedMotion: true,
  });
}

/** The bigger moment, for closing the day or clearing every leftover. */
export function celebrateBig() {
  if (reducedMotion()) return;
  const fire = (ratio: number, opts: confetti.Options) =>
    void confetti({ origin: { y: 0.7 }, colors: COLORS, particleCount: Math.floor(160 * ratio), ...opts });
  fire(0.25, { spread: 26, startVelocity: 55 });
  fire(0.2, { spread: 60 });
  fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
  fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
}
