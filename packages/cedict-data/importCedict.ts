import { createReadStream } from "node:fs";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

import { ConvexHttpClient } from "convex/browser";
import { config } from "dotenv";

import { parseCedictLine, type DictionaryEntry } from "./CedictParser";
import { api } from "@handeck/backend/convex/_generated/api.js";

const packageRoot = dirname(fileURLToPath(import.meta.url));

config({ path: resolve(packageRoot, ".env.local") });
config({ path: resolve(packageRoot, "../../apps/web/.env") });

const args = process.argv.slice(2);
const flags = new Set(args.filter((arg) => arg.startsWith("--")));
const cedictPath = resolve(
  process.cwd(),
  args.find((arg) => !arg.startsWith("--")) ?? resolve(packageRoot, "cedict_ts.u8"),
);

const batchSize = Number.parseInt(getFlagValue("--batch-size") ?? "250", 10);
const limit = getFlagValue("--limit");
const maxEntries = limit ? Number.parseInt(limit, 10) : undefined;
const shouldClear = flags.has("--clear");
const dryRun = flags.has("--dry-run");
const convexUrl = process.env.CONVEX_URL ?? process.env.VITE_CONVEX_URL;
const importToken = process.env.CEDICT_IMPORT_TOKEN;
const dictionaryEntriesApi = api.dictionaryEntries;

if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 500) {
  throw new Error("--batch-size must be an integer between 1 and 500.");
}

if (maxEntries !== undefined && (!Number.isInteger(maxEntries) || maxEntries < 1)) {
  throw new Error("--limit must be a positive integer.");
}

if (!dryRun && !convexUrl) {
  throw new Error("Set CONVEX_URL or VITE_CONVEX_URL before importing CEDICT.");
}

if (!dryRun && !importToken) {
  throw new Error("Set CEDICT_IMPORT_TOKEN locally and in Convex before importing CEDICT.");
}

const client = dryRun ? undefined : new ConvexHttpClient(convexUrl!);

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

  const result = await client!.mutation(dictionaryEntriesApi.insertBatch, {
    importToken: importToken!,
    entries,
  });
  return result.inserted;
}

async function clearDictionaryEntries() {
  let deleted = 0;

  for (;;) {
    const result = await client!.mutation(dictionaryEntriesApi.clearBatch, {
      importToken: importToken!,
      limit: 200,
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
