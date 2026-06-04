"use client";

import { env } from "@handeck/env/web";
import { useSyncExternalStore } from "react";

/**
 * Dev SSR snapshot for Better Auth `baseURL`. Must stay aligned with
 * `apps/web/vite.config.ts` `server.port`.
 */
export const DEFAULT_DEV_APP_ORIGIN = "http://localhost:3001" as const;

const subscribeNoop = () => () => {};

/**
 * Better Auth UI must use the **browser app origin** for `baseURL` so OAuth
 * `callbackURL` matches `trustedOrigins`. The client uses `window.location.origin`;
 * SSR uses `VITE_APP_ORIGIN` or the dev default.
 */
export function useAuthBaseUrl() {
  return useSyncExternalStore(
    subscribeNoop,
    () => window.location.origin,
    () => env.VITE_APP_ORIGIN ?? DEFAULT_DEV_APP_ORIGIN,
  );
}
