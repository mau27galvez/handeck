import { createDb } from "@handeck/db";
import * as schema from "@handeck/db/schema/auth";
import { env, getAppOrigin, getTrustedOrigins } from "@handeck/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { v4 } from "uuid";

export function createAuth() {
  const db = createDb();

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",
      schema,
    }),
    trustedOrigins: getTrustedOrigins(),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: getAppOrigin(),
    plugins: [tanstackStartCookies()],
    advanced: {
      database: {
        generateId: () => v4(),
      },
    },
  });
}

export const auth = createAuth();
