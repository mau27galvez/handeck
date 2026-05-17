import { createReadStream } from "node:fs";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

import { ConvexHttpClient } from "convex/browser";
import { config } from "dotenv";

import { api } from "./convex/_generated/api.js";

type DictionaryEntry = {
  simplifiedHanzi: string;
  numberedPinyin: string;
  diacriticPinyin: string;
  normalizedPinyin: string;
  meaning: string;
};

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

function parseCedictLine(line: string): DictionaryEntry | null {
  if (!line || line.startsWith("#")) {
    return null;
  }

  // CC-CEDICT v2: Traditional Simplified [[pinyin]] /sense/sense/.../
  // https://cc-cedict.org/wiki/syntax_v2
  const match = line.match(/^(\S+)\s+(\S+)\s+\[\[(.*?)\]\]\s+\/(.+)\/$/);
  if (!match) {
    return null;
  }

  const [, , simplifiedHanzi, rawPinyin, rawMeaning] = match;
  const numberedPinyin = rawPinyin?.trim().replace(/\s+/g, " ") ?? "";

  return {
    simplifiedHanzi: simplifiedHanzi ?? "",
    numberedPinyin,
    diacriticPinyin: toDiacriticPinyin(numberedPinyin),
    normalizedPinyin: normalizePinyin(numberedPinyin),
    meaning: formatDefinitionPinyin(rawMeaning?.split("/").filter(Boolean).join("; ") ?? ""),
  };
}

function formatDefinitionPinyin(meaning: string): string {
  return meaning.replace(/\[([^\][]+)\]/g, (match, bracketedPinyin: string) => {
    if (!looksLikeNumberedPinyin(bracketedPinyin)) {
      return match;
    }

    return `[${toDiacriticPinyin(bracketedPinyin)}]`;
  });
}

function looksLikeNumberedPinyin(value: string): boolean {
  return /[a-zA-ZüÜ:]+[1-5]/.test(value);
}

/**
 * Maps numbered CC-CEDICT v2 pinyin to diacritic or normalized form while preserving:
 * - spaces and ", " only between v2 words (never between syllables inside a word);
 * - hyphens between hyphenated pieces;
 * - apostrophes between syllables (e.g. si4'er4yi1).
 */
function mapV2PinyinWordStructure(
  pinyin: string,
  mapSyllable: (numberedSyllable: string) => string,
): string {
  const trimmed = pinyin.trim().replace(/\s+/g, " ");
  const parts = trimmed.split(/(\s+|,\s*)/);
  return parts
    .map((part) => {
      if (/^\s+$/.test(part) || /^,\s*$/.test(part)) {
        return part;
      }
      return mapV2PinyinWordToken(part, mapSyllable);
    })
    .join("");
}

function mapV2PinyinWordToken(token: string, mapSyllable: (s: string) => string): string {
  if (token.includes("-")) {
    return token
      .split("-")
      .filter(Boolean)
      .map((piece) => mapBraceOrGluedPiece(piece, mapSyllable))
      .join("-");
  }
  return mapBraceOrGluedPiece(token, mapSyllable);
}

function mapBraceOrGluedPiece(piece: string, mapSyllable: (s: string) => string): string {
  if (piece.startsWith("{") && piece.endsWith("}")) {
    const inner = piece.slice(1, -1);
    if (/^\d+$/.test(inner)) {
      return inner;
    }
    return transformGluedChunk(inner, mapSyllable);
  }
  return transformGluedChunk(piece, mapSyllable);
}

function transformGluedChunk(chunk: string, mapSyllable: (s: string) => string): string {
  let out = "";
  let index = 0;
  while (index < chunk.length) {
    if (chunk.charAt(index) === "'") {
      out += "'";
      index += 1;
      continue;
    }
    const rest = chunk.slice(index);
    const syllable = rest.match(/^([a-zA-ZüÜ:]+)([1-5])/);
    if (syllable) {
      out += mapSyllable(syllable[1]! + syllable[2]!);
      index += syllable[0].length;
      continue;
    }
    const latin = rest.match(/^([a-zA-Z0-9]+)/);
    if (latin) {
      out += latin[1]!;
      index += latin[1]!.length;
      continue;
    }
    out += chunk.charAt(index);
    index += 1;
  }
  return out;
}

function toDiacriticPinyin(numberedPinyin: string): string {
  return mapV2PinyinWordStructure(numberedPinyin, (syllable) => applyToneMark(syllable));
}

function normalizePinyin(numberedPinyin: string): string {
  return mapV2PinyinWordStructure(numberedPinyin, (syllable) => {
    if (!/[a-zA-ZüÜ]/.test(syllable)) {
      return syllable;
    }
    return syllable.replace(/[1-5]$/, "").replace(/u:/gi, "ü");
  }).toLowerCase();
}

function applyToneMark(syllable: string): string {
  const match = syllable.match(/^(.*?)([1-5])$/);
  if (!match) {
    return syllable.replace(/u:/gi, "ü");
  }

  const [, rawBase, rawTone] = match;
  if (!rawBase || !rawTone) {
    return syllable.replace(/u:/gi, "ü");
  }

  // v2 literals like `{11}` expand to "11"; do not treat trailing digits as tone marks.
  if (!/[a-zA-ZüÜ]/.test(rawBase)) {
    return syllable.replace(/u:/gi, "ü");
  }

  const tone = Number.parseInt(rawTone, 10);
  const base = rawBase.replace(/u:/gi, "ü");

  if (tone === 5) {
    return base;
  }

  const toneIndex = getToneVowelIndex(base);
  if (toneIndex === -1) {
    return base;
  }

  return (
    base.slice(0, toneIndex) + markTone(base.charAt(toneIndex), tone) + base.slice(toneIndex + 1)
  );
}

function getToneVowelIndex(syllable: string): number {
  const lower = syllable.toLowerCase();
  const aIndex = lower.indexOf("a");
  if (aIndex !== -1) {
    return aIndex;
  }

  const eIndex = lower.indexOf("e");
  if (eIndex !== -1) {
    return eIndex;
  }

  const ouIndex = lower.indexOf("ou");
  if (ouIndex !== -1) {
    return ouIndex;
  }

  for (let index = lower.length - 1; index >= 0; index -= 1) {
    if ("iouü".includes(lower.charAt(index))) {
      return index;
    }
  }

  return -1;
}

function markTone(vowel: string, tone: number): string {
  const toneMarks: Record<string, string[]> = {
    a: ["a", "ā", "á", "ǎ", "à"],
    e: ["e", "ē", "é", "ě", "è"],
    i: ["i", "ī", "í", "ǐ", "ì"],
    o: ["o", "ō", "ó", "ǒ", "ò"],
    u: ["u", "ū", "ú", "ǔ", "ù"],
    ü: ["ü", "ǖ", "ǘ", "ǚ", "ǜ"],
    A: ["A", "Ā", "Á", "Ǎ", "À"],
    E: ["E", "Ē", "É", "Ě", "È"],
    I: ["I", "Ī", "Í", "Ǐ", "Ì"],
    O: ["O", "Ō", "Ó", "Ǒ", "Ò"],
    U: ["U", "Ū", "Ú", "Ǔ", "Ù"],
    Ü: ["Ü", "Ǖ", "Ǘ", "Ǚ", "Ǜ"],
  };

  return toneMarks[vowel]?.[tone] ?? vowel;
}

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
