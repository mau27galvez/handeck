import { ORPCError } from "@orpc/server";
import { db } from "@handeck/db";
import { vocabPacksTable, vocabPackWordsTable, wordsTable } from "@handeck/db/schema";
import { desc, eq, inArray, and, sql } from "drizzle-orm";
import { v4 } from "uuid";

import { validateImportToken } from "../words/word-use-cases";
import {
  NON_VARIANT_MEANING_LIKE_PATTERN,
  wordReferenceKey,
  type VocabPackWordReference,
} from "./vocab-pack-word-matching";

export type { VocabPackWordReference };

export type CreateVocabPackInput = {
  importToken: string;
  name: string;
  description?: string;
  words: VocabPackWordReference[];
  replaceExisting?: boolean;
};

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

export async function createVocabPack(input: CreateVocabPackInput) {
  validateImportToken(input.importToken);

  const wordReferences = dedupeWordReferences(input.words);
  const matchingWords =
    wordReferences.length === 0 ? [] : await getMatchingWordsByReferences(wordReferences);
  const matchedKeys = new Set(matchingWords.map((word) => wordReferenceKey(word)));
  const missingWords = wordReferences.filter((word) => !matchedKeys.has(wordReferenceKey(word)));
  const now = new Date();
  const vocabPackId = v4();

  await db.transaction(async (tx) => {
    const existingPacks = await tx
      .select({ id: vocabPacksTable.id })
      .from(vocabPacksTable)
      .where(eq(vocabPacksTable.name, input.name));

    if (input.replaceExisting) {
      const existingPackIds = existingPacks.map((pack) => pack.id);

      if (existingPackIds.length > 0) {
        await tx
          .delete(vocabPackWordsTable)
          .where(inArray(vocabPackWordsTable.vocabPackId, existingPackIds));
        await tx.delete(vocabPacksTable).where(inArray(vocabPacksTable.id, existingPackIds));
      }
    } else if (existingPacks.length > 0) {
      throw new ORPCError("CONFLICT", {
        message: `A vocab pack named "${input.name}" already exists. Set replaceExisting to true to replace it.`,
      });
    }

    await tx.insert(vocabPacksTable).values({
      id: vocabPackId,
      name: input.name,
      description: input.description ?? null,
      createdAt: now,
      updatedAt: now,
    });

    if (matchingWords.length > 0) {
      await tx.insert(vocabPackWordsTable).values(
        matchingWords.map((word) => ({
          vocabPackId,
          wordId: word.id,
          createdAt: now,
          updatedAt: now,
        })),
      );
    }
  });

  return {
    id: vocabPackId,
    name: input.name,
    description: input.description,
    requestedCount: wordReferences.length,
    matchedCount: wordReferences.length - missingWords.length,
    missingCount: missingWords.length,
    insertedWordCount: matchingWords.length,
    missingWords,
  };
}

async function getMatchingWordsByReferences(wordReferences: VocabPackWordReference[]) {
  if (wordReferences.length === 0) {
    return [];
  }

  const referenceTuples = sql.join(
    wordReferences.map((ref) => sql`(${ref.simplifiedHanzi}, ${ref.numberedPinyinSearch})`),
    sql`, `,
  );

  return db
    .select({
      id: wordsTable.id,
      simplifiedHanzi: wordsTable.simplifiedHanzi,
      numberedPinyinSearch: wordsTable.numberedPinyinSearch,
      meaning: wordsTable.meaning,
    })
    .from(wordsTable)
    .where(
      and(
        sql`(${wordsTable.simplifiedHanzi}, ${wordsTable.numberedPinyinSearch}) in (${referenceTuples})`,
        sql`lower(trim(${wordsTable.meaning})) not like ${NON_VARIANT_MEANING_LIKE_PATTERN}`,
      ),
    );
}

function dedupeWordReferences(words: VocabPackWordReference[]) {
  const seen = new Set<string>();
  const deduped: VocabPackWordReference[] = [];

  for (const word of words) {
    const key = wordReferenceKey(word);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(word);
  }

  return deduped;
}
