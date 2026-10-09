import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Load .env.local first (Next.js), then .env — keeps CLI migrations on the same DB as the app.
config({ path: ".env.local" });
config({ path: ".env" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"] ?? "",
  },
});
