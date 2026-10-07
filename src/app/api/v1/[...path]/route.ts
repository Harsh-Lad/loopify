import { createOpenApiFetchHandler } from "trpc-to-openapi";
import { appRouter } from "@/server/trpc/root";
import { createContext } from "@/server/trpc/init";

/**
 * REST API for the mobile app, generated from the same tRPC procedures the web
 * app uses. Spec: GET /api/v1/openapi.json
 */
function handler(req: Request) {
  return createOpenApiFetchHandler({
    endpoint: "/api/v1",
    router: appRouter,
    createContext: () => createContext({ req }),
    req,
  });
}

export { handler as DELETE, handler as GET, handler as PATCH, handler as POST, handler as PUT };
