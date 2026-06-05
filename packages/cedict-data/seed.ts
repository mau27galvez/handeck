import { createReadStream } from "node:fs";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

import { RPC_PATH } from "@handeck/api/rpc-paths";
import type { AppRouterClient } from "@handeck/api/routers/index";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { config } from "dotenv";

import { parseCedictLine, type DictionaryEntry } from "./CedictParser";

const packageRoot = dirname(fileURLToPath(import.meta.url));

config({ path: resolve(packageRoot, ".env.local") });
config({ path: resolve(packageRoot, "../../apps/web/.env") });

const args = process.argv.slice(2);
const flags = new Set(args.filter((arg) => arg.startsWith("--")));
const cedictPath = resolve(
  process.cwd(),
  args.find((arg) => !arg.startsWith("--")) ?? resolve(packageRoot, "cedict_ts.u8"),
);

const batchSize = Number.parseInt(getFlagValue("--batch-size") ?? "500", 10);
const limit = getFlagValue("--limit");
const maxEntries = limit ? Number.parseInt(limit, 10) : undefined;
const shouldClear = flags.has("--clear");
const dryRun = flags.has("--dry-run");
const appOrigin =
  process.env.APP_ORIGIN ?? process.env.BETTER_AUTH_URL ?? process.env.VITE_APP_ORIGIN;
const importToken = process.env.CEDICT_IMPORT_TOKEN;

if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 500) {
  throw new Error("--batch-size must be an integer between 1 and 500.");
}

if (maxEntries !== undefined && (!Number.isInteger(maxEntries) || maxEntries < 1)) {
  throw new Error("--limit must be a positive integer.");
}

if (!dryRun && !appOrigin) {
  throw new Error("Set APP_ORIGIN, BETTER_AUTH_URL, or VITE_APP_ORIGIN before importing CEDICT.");
}

if (!dryRun && !importToken) {
  throw new Error("Set CEDICT_IMPORT_TOKEN before importing CEDICT.");
}

const client = dryRun ? undefined : createClient(appOrigin!);

if (shouldClear && client) {
  await clearDictionaryEntries();
}

let parsed = 0;
let skipped = 0;
let inserted = 0;
let previewed = 0;
let batch: DictionaryEntry[] = [];

const lines = createInterface({
  input: createReadStream(cedictPath, { encoding: "utf8" }),
  crlfDelay: Infinity,
});

for await (const line of lines) {
  if (maxEntries !== undefined && parsed >= maxEntries) {
    break;
  }

  const entry = parseCedictLine(line);
  if (!entry) {
    skipped += 1;
    continue;
  }

  parsed += 1;
  batch.push(entry);

  if (batch.length >= batchSize) {
    inserted += await insertBatch(batch);
    batch = [];
  }
}

if (batch.length > 0) {
  inserted += await insertBatch(batch);
}

console.log(
  dryRun
    ? `Parsed ${parsed} CEDICT entries (${skipped} skipped).`
    : `Inserted ${inserted} dictionary entries (${skipped} skipped).`,
);

async function insertBatch(entries: DictionaryEntry[]): Promise<number> {
  if (dryRun) {
    for (const entry of entries.slice(0, Math.max(0, 5 - previewed))) {
      console.log(entry);
      previewed += 1;
    }

    return entries.length;
  }

  const result = await client!.word.insertBatch({
    importToken: importToken!,
    entries,
  });
  return result.inserted;
}

async function clearDictionaryEntries() {
  let deleted = 0;

  for (;;) {
    const result = await client!.word.clearBatch({
      importToken: importToken!,
      limit: 500,
    });
    deleted += result.deleted;

    if (result.isDone) {
      break;
    }

    console.log(`Cleared ${deleted} existing dictionary entries...`);
  }
}

function getFlagValue(name: string): string | undefined {
  const prefix = `${name}=`;
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function createClient(origin: string): AppRouterClient {
  const link = new RPCLink({
    url: `${origin.replace(/\/$/, "")}${RPC_PATH}`,
  });

  return createORPCClient(link);
}
