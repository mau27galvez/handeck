import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { nitro } from "nitro/vite";

export default defineConfig({
  server: {
    // Keep in sync with `DEFAULT_DEV_APP_ORIGIN` in `src/lib/auth-app-origin.ts` (SSR auth baseURL fallback).
    port: 3001,
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [tailwindcss(), tanstackStart(), nitro({ preset: "vercel" }), viteReact()],
  ssr: {
    noExternal: ["@convex-dev/better-auth"],
  },
});
