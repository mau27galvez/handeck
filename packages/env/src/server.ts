import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url().optional(),
    CORS_ORIGIN: z.string().min(1).optional(),
    CEDICT_IMPORT_TOKEN: z.string().min(1).optional(),
    OPENROUTER_API_KEY: z.string().min(1),
    S3_BUCKET: z.string().min(1),
    S3_KEY_PREFIX: z
      .string()
      .min(1)
      .transform((value) => value.replace(/^\/+|\/+$/g, ""))
      .refine((value) => value.length > 0 && !value.includes(".."), {
        message: "S3_KEY_PREFIX must not be empty or contain path traversal",
      }),
    S3_REGION: z.string().min(1),
    S3_ENDPOINT: z.url().optional(),
    S3_FORCE_PATH_STYLE: z.coerce.boolean().optional().default(false),
    AWS_ACCESS_KEY_ID: z.string().min(1),
    AWS_SECRET_ACCESS_KEY: z.string().min(1),
    GEMINI_API_KEY: z.string().min(1),
    INNGEST_DEV: z
      .enum(["1", "0"])
      .default("0")
      .transform((value) => value === "1"),
    INNGEST_EVENT_KEY: z.string().min(1).optional(),
    INNGEST_SIGNING_KEY: z.string().min(1).optional(),
    OPENROUTER_SENTENCE_BATCH_RPM: z.coerce.number().int().positive().default(60),
    OPENROUTER_SENTENCE_BATCH_CONCURRENCY: z.coerce.number().int().positive().default(10),
    GEMINI_WORD_AUDIO_RPM: z.coerce.number().int().positive().default(120),
    GEMINI_WORD_AUDIO_CONCURRENCY: z.coerce.number().int().positive().default(20),
    DECK_SENTENCE_BATCH_WINDOW_SIZE: z.coerce.number().int().positive().default(100),
    DECK_WORD_AUDIO_WINDOW_SIZE: z.coerce.number().int().positive().default(500),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    VERCEL_URL: z.string().min(1).optional(),
    VERCEL_BRANCH_URL: z.string().min(1).optional(),
    VERCEL_PROJECT_PRODUCTION_URL: z.string().min(1).optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});

export function getAppOrigin() {
  const explicitOrigin = normalizeOrigin(env.BETTER_AUTH_URL) ?? parseOrigins(env.CORS_ORIGIN)[0];
  if (explicitOrigin) {
    return explicitOrigin;
  }

  const vercelOrigin = vercelOrigins()[0];
  if (vercelOrigin) {
    return vercelOrigin;
  }

  return "http://localhost:3001";
}

export function getTrustedOrigins() {
  return [...new Set([getAppOrigin(), ...parseOrigins(env.CORS_ORIGIN), ...vercelOrigins()])];
}

function vercelOrigins() {
  return [env.VERCEL_URL, env.VERCEL_BRANCH_URL, env.VERCEL_PROJECT_PRODUCTION_URL]
    .map(normalizeOrigin)
    .filter((origin): origin is string => origin != null);
}

function parseOrigins(origins: string | undefined) {
  return (
    origins
      ?.split(",")
      .map((origin) => normalizeOrigin(origin.trim()))
      .filter((origin): origin is string => origin != null) ?? []
  );
}

function normalizeOrigin(origin: string | undefined) {
  if (!origin) return undefined;
  const withProtocol =
    origin.startsWith("http://") || origin.startsWith("https://") ? origin : `https://${origin}`;

  try {
    const url = new URL(withProtocol);
    return url.origin;
  } catch {
    return undefined;
  }
}
