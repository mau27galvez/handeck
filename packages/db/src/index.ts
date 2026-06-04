import { env } from "@handeck/env/server";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  dbClient: postgres.Sql | undefined;
};

const client =
  globalForDb.dbClient ??
  postgres(env.DATABASE_URL, {
    max: 5,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.dbClient = client;
}

export function createDb() {
  return drizzle(client, {
    schema,
    casing: "snake_case",
    logger: process.env.NODE_ENV !== "production",
  });
}

export const db = createDb();
