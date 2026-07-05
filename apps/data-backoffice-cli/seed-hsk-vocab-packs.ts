import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { RPC_PATH } from "@handeck/api/rpc-paths";
import type { AppRouterClient } from "@handeck/api/routers/index";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";

import { env } from "./env";
import { applyHskVocabPackMatchOverrides } from "./hsk-vocab-pack-match-overrides";
import { parseHskWordListWithMetadata, type HskVocabPackWord } from "./hsk-vocab-pack-parser";

type HskPackConfig = {
  fileName: string;
  name: string;
  description: string;
};

const packageRoot = dirname(fileURLToPath(import.meta.url));
const hskWordsRoot = resolve(packageRoot, "hsk-words");
const appOrigin = env.APP_ORIGIN;
const importToken = env.CEDICT_IMPORT_TOKEN;

const hskPacks: HskPackConfig[] = [
  {
    fileName: "HSK_Level_1_words.txt",
    name: "HSK Level 1",
    description: "HSK Level 1 vocabulary words.",
  },
  {
    fileName: "HSK_Level_2_words.txt",
    name: "HSK Level 2",
    description: "HSK Level 2 vocabulary words.",
  },
  {
    fileName: "HSK_Level_3_words.txt",
    name: "HSK Level 3",
    description: "HSK Level 3 vocabulary words.",
  },
  {
    fileName: "HSK_Level_4_words.txt",
    name: "HSK Level 4",
    description: "HSK Level 4 vocabulary words.",
  },
  {
    fileName: "HSK_Level_5_words.txt",
    name: "HSK Level 5",
    description: "HSK Level 5 vocabulary words.",
  },
  {
    fileName: "HSK_Level_6_words.txt",
    name: "HSK Level 6",
    description: "HSK Level 6 vocabulary words.",
  },
  {
    fileName: "HSK_Level_7-9_words.txt",
    name: "HSK Level 7-9",
    description: "HSK Level 7-9 vocabulary words.",
  },
];

if (!importToken) {
  throw new Error("Set CEDICT_IMPORT_TOKEN before importing HSK vocab packs.");
}

const client = createClient(appOrigin);

for (const pack of hskPacks) {
  const words = await readHskWords(pack.fileName);

  const result = await client.vocabPack.create({
    importToken,
    name: pack.name,
    description: pack.description,
    words,
    replaceExisting: true,
  });

  if (result.missingCount > 0) {
    const missingSummary = result.missingWords
      .slice(0, 20)
      .map((word) => `${word.simplifiedHanzi} (${word.numberedPinyinSearch})`)
      .join(", ");
    throw new Error(
      `${pack.name} has ${result.missingCount} unmatched HSK rows. Missing examples: ${missingSummary}`,
    );
  }

  console.log(
    `Created ${result.name}: ${result.insertedWordCount} word rows from ${result.requestedCount} HSK entries.`,
  );
}

async function readHskWords(fileName: string): Promise<HskVocabPackWord[]> {
  const contents = await readFile(resolve(hskWordsRoot, fileName), "utf8");
  return applyHskVocabPackMatchOverrides(parseHskWordListWithMetadata(contents));
}

function createClient(origin: string): AppRouterClient {
  const link = new RPCLink({
    url: `${origin.replace(/\/$/, "")}${RPC_PATH}`,
  });

  return createORPCClient(link);
}
