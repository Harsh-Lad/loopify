import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/trpc/root";
import { createContext } from "@/server/trpc/init";

function handler(req: Request) {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createContext({ req }),
    onError({ path, error }) {
      if (error.code === "INTERNAL_SERVER_ERROR") console.error(`[trpc] ${path ?? "<no-path>"}`, error);
    },
  });
}

export { handler as GET, handler as POST };

// Capture processing (an AI call) runs after the response, inside this function's time budget.
export const maxDuration = 60;
