import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";
import { nitro } from "nitro/vite";

export default defineConfig({
  server: {
    // Keep in sync with `DEFAULT_DEV_APP_ORIGIN` in `src/lib/auth-app-origin.ts` (SSR auth baseURL fallback).
    port: 3001,
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    tailwindcss(),
    tanstackStart(),
    // We add `react` to fix an issue with Vercel bundle. We may be able to remove this in the future.
    nitro({ preset: "vercel", traceDeps: ["react"] }),
    viteReact(),
  ],
  run: {
    tasks: {
      build: {
        command: "vp build",
        env: [
          "VITE_APP_ORIGIN",
          "DATABASE_URL",
          "BETTER_AUTH_SECRET",
          "BETTER_AUTH_URL",
          "CORS_ORIGIN",
          "VERCEL_URL",
          "VERCEL_BRANCH_URL",
          "VERCEL_PROJECT_PRODUCTION_URL",
        ],
        input: [{ auto: true }, { pattern: ".env*", base: "package" }],
        output: ["dist/**", ".vercel/output/**"],
      },
      dev: {
        command: "vp dev",
        cache: false,
      },
    },
  },
});
