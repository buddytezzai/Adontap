import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The repo root has its own lockfile (the CRA app); pin the tracing root to this app so Next stops guessing.
  outputFileTracingRoot: path.resolve(process.cwd()),
  agentRules: false, // Next 16 otherwise writes AGENTS.md/CLAUDE.md into the project on `next dev`
  // Keep the Prisma/pg/bcrypt server libs out of the client & edge bundles.
  serverExternalPackages: ["pg", "bcryptjs"],
};

export default nextConfig;
