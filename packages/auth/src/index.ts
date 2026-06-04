import { randomUUID } from "node:crypto";

import { createDb } from "@handeck/db";
import * as schema from "@handeck/db/schema/auth";
import { env } from "@handeck/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { tanstackStartCookies } from "better-auth/tanstack-start";

export function createAuth() {
  const db = createDb();

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",
      schema,
    }),
    trustedOrigins: [env.CORS_ORIGIN],
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    plugins: [tanstackStartCookies()],
    advanced: {
      database: {
        generateId: () => randomUUID(),
      },
    },
  });
}

export const auth = createAuth();
