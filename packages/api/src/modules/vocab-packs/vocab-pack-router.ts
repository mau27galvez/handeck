import { db } from "@handeck/db";
import { templateWordsTable, templatesTable } from "@handeck/db/schema";
import { eq } from "drizzle-orm";
import z from "zod";
import { protectedProcedure, publicProcedure } from "../../index";
import { getOwnedTemplate } from "../templates/template-use-cases";
import {
  createVocabPack,
  getVocabPackWithWords,
  getVocabPacksWithWords,
  getAllVocabPacks,
} from "./vocab-pack-use-cases";

const MAX_VOCAB_PACK_IMPORT_BATCH_SIZE = 20;

const importVocabPacksInputSchema = z.object({
  templateId: z.uuid(),
  vocabPackIds: z.array(z.uuid()).min(1).max(MAX_VOCAB_PACK_IMPORT_BATCH_SIZE),
});

const createVocabPackInputSchema = z.object({
  importToken: z.string(),
  name: z.string().trim().min(1),
  description: z.string().trim().min(1).optional(),
  words: z
    .array(
      z.object({
        simplifiedHanzi: z.string().trim().min(1),
        numberedPinyinSearch: z.string().trim().min(1),
        matchSelector: z
          .object({
            meaningStartsWith: z.string().trim().min(1).optional(),
            meaningIncludes: z.string().trim().min(1).optional(),
          })
          .optional(),
      }),
    )
    .min(1),
  replaceExisting: z
    .boolean()
    .optional()
    .describe(
      "When true, replaces the existing vocab pack with the same name. Vocab pack names are unique.",
    ),
});

export const vocabPackRouter = {
  list: publicProcedure.handler(async () => getAllVocabPacks()),

  create: publicProcedure.input(createVocabPackInputSchema).handler(async ({ input }) => {
    return createVocabPack(input);
  }),

  getWords: protectedProcedure
    .input(z.object({ vocabPackId: z.uuid() }))
    .handler(async ({ input }) => {
      const pack = await getVocabPackWithWords(input.vocabPackId);
      return pack.vocabPackWords.map((row) => row.word);
    }),

  importToTemplate: protectedProcedure
    .input(importVocabPacksInputSchema)
    .handler(async ({ input, context }) => {
      const uniquePackIds = [...new Set(input.vocabPackIds)];

      await getOwnedTemplate(input.templateId, context.session.user.id);
      const packs = await getVocabPacksWithWords(uniquePackIds);

      const uniqueWordIds = [
        ...new Set(packs.flatMap((pack) => pack.vocabPackWords.map((row) => row.wordId))),
      ];
      const requestedInsertsCount = uniqueWordIds.length;

      if (uniqueWordIds.length === 0) {
        return {
          added: 0,
          skipped: 0,
          requestedInsertsCount: 0,
        };
      }

      const now = new Date();
      const addedRows = await db
        .insert(templateWordsTable)
        .values(
          uniqueWordIds.map((wordId) => ({
            templateId: input.templateId,
            wordId,
            createdAt: now,
          })),
        )
        .onConflictDoNothing()
        .returning({ wordId: templateWordsTable.wordId });

      if (addedRows.length > 0) {
        await db
          .update(templatesTable)
          .set({ updatedAt: now })
          .where(eq(templatesTable.id, input.templateId));
      }

      return {
        added: addedRows.length,
        skipped: requestedInsertsCount - addedRows.length,
        requestedInsertsCount,
      };
    }),
};
