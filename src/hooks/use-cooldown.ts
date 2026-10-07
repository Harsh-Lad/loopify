"use client";

import { useCallback, useEffect, useState } from "react";

/** Seconds left before an action (like "resend code") can run again. */
export function useCooldown(seconds: number, startActive = false) {
  const [left, setLeft] = useState(startActive ? seconds : 0);

  useEffect(() => {
    if (left <= 0) return;
    const id = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);

  const start = useCallback(() => setLeft(seconds), [seconds]);
  return { left, ready: left <= 0, start };
}
