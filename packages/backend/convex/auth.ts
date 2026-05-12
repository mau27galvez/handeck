import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth/minimal";

import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import authConfig from "./auth.config";
import betterAuthSchema from "./betterAuth/schema";
import { multiSession } from "better-auth/plugins";

const siteUrl = process.env.SITE_URL!;
const clientId = process.env.GOOGLE_CLIENT_ID!;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;

export function createAuthOptions(ctx: GenericCtx<DataModel>) {
  return betterAuth({
    baseURL: siteUrl,
    trustedOrigins: [siteUrl],
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: false,
      requireEmailVerification: false,
    },
    socialProviders: {
      google: {
        enabled: true,
        clientId,
        clientSecret,
      },
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

/**
 * Creates the Better Auth instance with full configuration.
 * Use this in mutation/query handlers where ctx is available.
 */
export function createAuth(ctx: GenericCtx<DataModel>) {
  return createAuthOptions(ctx);
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
