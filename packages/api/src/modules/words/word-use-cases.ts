import { db } from "@handeck/db";
import { wordsTable } from "@handeck/db/schema";
import { env } from "@handeck/env/server";
import { eq, inArray } from "drizzle-orm";

export const MAX_IMPORT_BATCH_SIZE = 500;

export async function getWord(wordId: string) {
  const word = await getWordOrNull(wordId);

  if (!word) throw new Error("Word not found");
  return word;
}

export async function getWordOrNull(wordId: string) {
  const word = await db.query.wordsTable.findFirst({
    where: eq(wordsTable.id, wordId),
  });

  return word ?? null;
}

export async function getWordsByIds(wordIds: string[]) {
  const uniqueWordIds = [...new Set(wordIds)];
  const words = await db.query.wordsTable.findMany({
    where: inArray(wordsTable.id, uniqueWordIds),
  });

  if (words.length !== uniqueWordIds.length) {
    throw new Error("Word not found");
  }

  return words;
}

export function validateImportToken(importToken: string) {
  const expectedToken = env.CEDICT_IMPORT_TOKEN;

  if (!expectedToken) {
    throw new Error("Set CEDICT_IMPORT_TOKEN before importing CEDICT.");
  }

  if (importToken !== expectedToken) {
    throw new Error("Invalid CEDICT import token.");
  }
}
