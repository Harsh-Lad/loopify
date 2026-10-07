import { generateOpenApiDocument } from "trpc-to-openapi";
import { appRouter } from "@/server/trpc/root";

export function GET(request: Request) {
  const document = generateOpenApiDocument(appRouter, {
    title: "Loopify API",
    description:
      "REST API for the Loopify mobile app. Authenticate with POST /auth/token, then send Authorization: Bearer <token>.",
    version: "1.0.0",
    baseUrl: `${new URL(request.url).origin}/api/v1`,
    securitySchemes: { Authorization: { type: "http", scheme: "bearer" } },
  });
  return Response.json(document);
}
