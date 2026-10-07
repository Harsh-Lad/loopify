"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { Spinner } from "@/components/ui/spinner";

const subscribe = () => () => {};

/** True once the component has hydrated on the client. */
export function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

/**
 * App pages are driven by client-side queries that the sidebar may already
 * have cached by the time a streamed page segment hydrates. Rendering the view
 * after hydration keeps server and client markup identical.
 */
export function ClientView({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const hydrated = useHydrated();
  if (!hydrated) {
    return (
      fallback ?? (
        <div className="grid flex-1 place-items-center p-10 text-muted-foreground">
          <Spinner className="size-5" />
        </div>
      )
    );
  }
  return children;
}
