import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits .next/standalone so the production container ships without the full
  // node_modules tree.
  output: "standalone",
  // Do not leak the framework version in responses.
  poweredByHeader: false,
};

export default nextConfig;
