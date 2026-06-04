import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const isProd = Boolean((import.meta as { env?: { PROD?: boolean } }).env?.PROD);

export const env = createEnv({
  clientPrefix: "VITE_",
  client: {
    /** SSR snapshot for auth `baseURL` when `window` is unavailable; client uses `window.location.origin`. Required in production builds. */
    VITE_APP_ORIGIN: isProd ? z.url() : z.url().optional(),
  },
  runtimeEnv: (import.meta as any).env,
  emptyStringAsUndefined: true,
});
