"use client";

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink, loggerLink, TRPCClientError } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { signOut } from "next-auth/react";
import { useState, type ReactNode } from "react";
import superjson from "superjson";
import type { AppRouter } from "@/server/trpc/root";

export const { TRPCProvider, useTRPC, useTRPCClient } = createTRPCContext<AppRouter>();

export type RouterInputs = inferRouterInputs<AppRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;

// Several queries fail together when a session goes stale; sign out once, not once per query.
let signingOut = false;

function onGlobalError(error: unknown) {
  if (!(error instanceof TRPCClientError)) return;
  const code = error.data?.code;
  if (code === "UNAUTHORIZED") {
    if (signingOut || window.location.pathname.startsWith("/sign-in")) return;
    signingOut = true;
    const next = `/sign-in?next=${encodeURIComponent(window.location.pathname)}`;
    // If the sign-out request itself fails (server restarting), still land on the form.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    signOut({ redirectTo: next }).catch(() => window.location.assign(next));
  } else if (code === "FORBIDDEN" && error.message === "ORG_SUSPENDED") {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    if (!window.location.pathname.startsWith("/suspended")) window.location.assign("/suspended");
  } else if (code === "PRECONDITION_FAILED" && error.message === "NO_ACTIVE_ORG") {
    // Runs in the global query cache, outside the React tree, so the router isn't available here.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    if (!window.location.pathname.startsWith("/onboarding")) window.location.assign("/onboarding");
  }
}

function makeQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({ onError: onGlobalError }),
    mutationCache: new MutationCache({ onError: onGlobalError }),
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        refetchOnWindowFocus: true,
        retry: (count, error) => {
          const code = error instanceof TRPCClientError ? error.data?.code : null;
          if (["UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND", "PRECONDITION_FAILED", "BAD_REQUEST"].includes(code))
            return false;
          return count < 2;
        },
      },
    },
  });
}

export function TRPCReactProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(makeQueryClient);
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        loggerLink({
          enabled: (op) =>
            process.env.NODE_ENV === "development" && op.direction === "down" && op.result instanceof Error,
        }),
        httpBatchLink({ url: "/api/trpc", transformer: superjson }),
      ],
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}

/** The human-readable message from any tRPC error, for toasts and form errors. */
export function errorMessage(error: unknown, fallback = "Something went wrong. Try again.") {
  if (error instanceof TRPCClientError) {
    const zod = error.data?.zodError?.fieldErrors as Record<string, string[] | undefined> | undefined;
    const firstField = zod && Object.values(zod).find((v) => v?.length)?.[0];
    return firstField ?? error.message ?? fallback;
  }
  return error instanceof Error ? error.message : fallback;
}
