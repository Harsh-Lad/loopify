import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// The CLI (migrate, studio) uses the direct, non-pooled Neon connection.
// The app runtime uses the pooled DATABASE_URL through the Neon driver adapter.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DIRECT_URL"),
  },
});
