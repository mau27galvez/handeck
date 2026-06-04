import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  clientPrefix: "VITE_",
  client: {
    /** Optional SSR snapshot for auth `baseURL` when `window` is unavailable; client uses `window.location.origin`. */
    VITE_APP_ORIGIN: z.url().optional(),
  },
  runtimeEnv: (import.meta as any).env,
  emptyStringAsUndefined: true,
});

export function getVercelAppOrigin() {
  const vercelUrl = typeof process === "undefined" ? undefined : process.env?.VERCEL_URL;
  return vercelUrl ? `https://${vercelUrl}` : undefined;
}
