import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { nitro } from "nitro/vite";

const awsSdkExternals = ["@aws-sdk/client-s3", "@aws-sdk/s3-request-presigner", "tslib"];

export default defineConfig({
  server: {
    // Keep in sync with `DEFAULT_DEV_APP_ORIGIN` in `src/lib/auth-app-origin.ts` (SSR auth baseURL fallback).
    port: 3001,
  },
  resolve: {
    tsconfigPaths: true,
  },
  ssr: {
    external: awsSdkExternals,
  },
  environments: {
    ssr: {
      resolve: {
        external: awsSdkExternals,
      },
    },
  },
  plugins: [
    tailwindcss(),
    tanstackStart(),
    // We add `react` to fix an issue with Vercel bundle. We may be able to remove this in the future.
    nitro({
      preset: "vercel",
      traceDeps: ["react", "@aws-sdk/client-s3", "@aws-sdk/s3-request-presigner"],
      rolldownConfig: {
        external: awsSdkExternals,
      },
    }),
    viteReact(),
  ],
});
