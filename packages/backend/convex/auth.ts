/**
 * Better Auth on Convex: keep `SITE_URL` / `trustedOrigins` in sync with the web app’s
 * public origin (`VITE_APP_ORIGIN` + `VITE_CONVEX_SITE_URL` in `@handeck/env/web`).
 */
import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth/minimal";
import { multiSession } from "better-auth/plugins";

import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import authConfig from "./auth.config";
import betterAuthSchema from "./betterAuth/schema";

const siteUrl = process.env.SITE_URL!;

/** Browser origins + Convex HTTP site; optional extras via `BETTER_AUTH_TRUSTED_ORIGINS` (comma-separated). */
function trustedOriginsForSite(site: string): string[] {
  const convexSite = process.env.CONVEX_SITE_URL?.trim();
  const fromEnv =
    process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? [];
  return [...new Set([site, ...(convexSite ? [convexSite] : []), ...fromEnv].filter(Boolean))];
}

/**
 * Creates the Better Auth instance with full configuration.
 * Use this in mutation/query handlers where ctx is available.
 */
export function createAuth(ctx: GenericCtx<DataModel>) {
  return betterAuth({
    baseURL: siteUrl,
    trustedOrigins: trustedOriginsForSite(siteUrl),
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    plugins: [
      convex({
        authConfig,
        jwksRotateOnTokenGenerationError: true,
      }),
      multiSession(),
    ],
  });
}

export const authComponent = createClient<DataModel, typeof betterAuthSchema>(
  components.betterAuth,
  { local: { schema: betterAuthSchema } },
);

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return await authComponent.safeGetAuthUser(ctx);
  },
});
