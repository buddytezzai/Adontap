import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  agentRules: false, // Next 16 otherwise writes AGENTS.md/CLAUDE.md into the project on `next dev`
  // Keep the Prisma/pg/bcrypt server libs out of the client & edge bundles.
  serverExternalPackages: ["pg", "bcryptjs"],
};

export default nextConfig;
