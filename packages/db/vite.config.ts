import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      "db:push": {
        command: "drizzle-kit push",
        cache: false,
      },
      "db:generate": {
        command: "drizzle-kit generate",
        cache: false,
      },
      "db:studio": {
        command: "drizzle-kit studio",
        cache: false,
      },
      "db:migrate": {
        command: "drizzle-kit migrate",
        cache: false,
      },
      typecheck: {
        command: "tsc --noEmit",
      },
    },
  },
});
