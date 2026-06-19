import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    CEDICT_IMPORT_TOKEN: z.string().min(1).optional(),
    APP_ORIGIN: z.url().default("http://localhost:3001"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
