/**
 * Web app env (Vite `VITE_*`). Per deploy, align with Convex + Google OAuth:
 *
 * - **This file**: `VITE_CONVEX_URL` (`.cloud`), `VITE_CONVEX_SITE_URL` (`.site`),
 *   `VITE_APP_ORIGIN` (browser origin, e.g. `https://app.example.com`; required in prod builds).
 * - **Convex** ([`packages/backend/convex/auth.ts`](../../backend/convex/auth.ts)): `SITE_URL`,
 *   `CONVEX_SITE_URL`, optional `BETTER_AUTH_TRUSTED_ORIGINS`.
 * - **Google Cloud**: Authorized redirect URIs for `{VITE_APP_ORIGIN}/api/auth/...` (app origin, not only Convex).
 */
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const isProd = Boolean((import.meta as { env?: { PROD?: boolean } }).env?.PROD);

export const env = createEnv({
  clientPrefix: "VITE_",
  client: {
    VITE_CONVEX_URL: z.url(),
    VITE_CONVEX_SITE_URL: z.url(),
    /** SSR snapshot for auth `baseURL` when `window` is unavailable; client uses `window.location.origin`. Required in production builds. */
    VITE_APP_ORIGIN: isProd ? z.url() : z.url().optional(),
  },
  runtimeEnv: (import.meta as any).env,
  emptyStringAsUndefined: true,
});
