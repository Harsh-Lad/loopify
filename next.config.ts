import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // The on-disk dev cache (.next/dev/cache/turbopack) can come back stale after a restart: every
    // page load then triggers a rebuild and a full reload, forever. Cold starts are slower without it,
    // but restarts are reliable. `npm run dev:clean` wipes it if you turn it back on.
    turbopackFileSystemCacheForDev: false,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
