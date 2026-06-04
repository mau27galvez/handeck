import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url().optional(),
    CORS_ORIGIN: z.url().optional(),
    CEDICT_IMPORT_TOKEN: z.string().min(1).optional(),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    VERCEL_URL: z.string().min(1).optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});

export function getAppOrigin() {
  const explicitOrigin = env.BETTER_AUTH_URL ?? env.CORS_ORIGIN;
  if (explicitOrigin) {
    return explicitOrigin;
  }

  if (env.VERCEL_URL) {
    return `https://${env.VERCEL_URL}`;
  }

  return "http://localhost:3001";
}

export function getTrustedOrigins() {
  return [...new Set([getAppOrigin(), env.CORS_ORIGIN].filter((origin) => origin != null))];
}
