/**
 * Offline validation of HSK word lists against the CC-CEDICT dictionary file.
 *
 * Replicates the exact matching pipeline of `seed-hsk-vocab-packs.ts` without a
 * database: cedict entries are loaded with the same seed-time customizations
 * used by `seed-dictionary.ts`, and HSK references are resolved with the same
 * `resolveReferencesToDictionaryWords` the API uses.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  isVariantOfDictionaryEntry,
  resolveReferencesToDictionaryWords,
  type DictionaryWordCandidate,
} from "@handeck/api/modules/vocab-packs/vocab-pack-word-matching";

import { loadDictionaryEntries } from "./cedict-entry-loader";
import { parseHskWordList } from "./hsk-vocab-pack-parser";

const packageRoot = dirname(fileURLToPath(import.meta.url));

const hskFiles = [
  "HSK_Level_1_words.txt",
  "HSK_Level_2_words.txt",
  "HSK_Level_3_words.txt",
  "HSK_Level_4_words.txt",
  "HSK_Level_5_words.txt",
  "HSK_Level_6_words.txt",
  "HSK_Level_7-9_words.txt",
];

const candidatesByHanzi = loadCedictCandidatesByHanzi();
let totalMissing = 0;

for (const fileName of hskFiles) {
  const contents = readFileSync(resolve(packageRoot, "hsk-words", fileName), "utf8");
  const words = parseHskWordList(contents);
  const candidates = words.flatMap((word) => candidatesByHanzi.get(word.simplifiedHanzi) ?? []);
  const { missingWords } = resolveReferencesToDictionaryWords(candidates, words);

  totalMissing += missingWords.length;
  console.log(`${fileName}: ${words.length} entries, ${missingWords.length} unmatched`);

  for (const missing of missingWords) {
    const readings = (candidatesByHanzi.get(missing.simplifiedHanzi) ?? [])
      .filter((candidate) => !isVariantOfDictionaryEntry(candidate.meaning))
      .map((candidate) => candidate.numberedPinyinSearch);
    console.log(
      `  MISSING ${missing.simplifiedHanzi} (${missing.numberedPinyinSearch}) cedict readings: [${[...new Set(readings)].join(", ")}]`,
    );
  }
}

if (totalMissing > 0) {
  console.error(`\n${totalMissing} HSK entries failed to match cedict.`);
  process.exit(1);
}

console.log("\nAll HSK entries resolve against cedict.");

function loadCedictCandidatesByHanzi() {
  const cedictContents = readFileSync(resolve(packageRoot, "cedict_ts.u8"), "utf8");
  const { entries } = loadDictionaryEntries(cedictContents);
  const byHanzi = new Map<string, DictionaryWordCandidate[]>();
  let id = 0;

  for (const entry of entries) {
    // Mirrors the SQL pre-filter in getMatchingWordsByReferences.
    if (entry.meaning.trim().toLowerCase().startsWith("variant of")) {
      continue;
    }

    const candidate: DictionaryWordCandidate = {
      id: String(id++),
      simplifiedHanzi: entry.simplifiedHanzi,
      numberedPinyinSearch: entry.numberedPinyinSearch,
      meaning: entry.meaning,
    };

    const bucket = byHanzi.get(entry.simplifiedHanzi);
    if (bucket) {
      bucket.push(candidate);
    } else {
      byHanzi.set(entry.simplifiedHanzi, [candidate]);
    }
  }

  return byHanzi;
}
