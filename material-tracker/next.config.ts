import type { NextConfig } from "next";

// Cache Components is intentionally off: pages fetch live data on each visit, and with it enabled
// Next.js keeps visited pages alive (React <Activity>), restoring stale forms and lists on revisit.
const nextConfig: NextConfig = {
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
