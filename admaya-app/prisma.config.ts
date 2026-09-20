import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Read leniently on purpose: `prisma generate` (run by `npm run build` in CI/Docker) needs no
    // database, whereas prisma's env() would throw when DATABASE_URL is unset. migrate/seed still fail
    // loudly if it is missing.
    url: process.env.DATABASE_URL ?? "",
  },
});
