import { db } from "@handeck/db";
import { vocabPacksTable } from "@handeck/db/schema";
import { desc, eq, inArray } from "drizzle-orm";

export async function getAllVocabPacks() {
  const packs = await db.query.vocabPacksTable.findMany({
    with: {
      vocabPackWords: {
        columns: { wordId: true },
      },
    },
    orderBy: desc(vocabPacksTable.name),
  });

  return packs.map((pack) => ({
    id: pack.id,
    name: pack.name,
    description: pack.description ?? undefined,
    wordCount: pack.vocabPackWords.length,
  }));
}

export async function getVocabPackById(vocabPackId: string) {
  const pack = await db.query.vocabPacksTable.findFirst({
    where: eq(vocabPacksTable.id, vocabPackId),
  });

  if (!pack) throw new Error("Vocab pack not found");
  return pack;
}

export async function getVocabPackWithWords(vocabPackId: string) {
  const pack = await db.query.vocabPacksTable.findFirst({
    where: eq(vocabPacksTable.id, vocabPackId),
    with: {
      vocabPackWords: {
        with: {
          word: true,
        },
      },
    },
  });

  if (!pack) throw new Error("Vocab pack not found");
  return pack;
}

export async function getVocabPacksWithWords(vocabPackIds: string[]) {
  const uniquePackIds = [...new Set(vocabPackIds)];
  if (uniquePackIds.length === 0) return [];

  const packs = await db.query.vocabPacksTable.findMany({
    where: inArray(vocabPacksTable.id, uniquePackIds),
    with: {
      vocabPackWords: {
        with: {
          word: true,
        },
      },
    },
  });

  if (packs.length !== uniquePackIds.length) {
    throw new Error("Vocab pack not found");
  }

  return packs;
}
