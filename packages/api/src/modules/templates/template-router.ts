import { db } from "@handeck/db";
import { templatesTable, templateWordsTable, wordsTable } from "@handeck/db/schema";
import { eq, and, desc, inArray, count } from "drizzle-orm";
import z from "zod";
import { protectedProcedure } from "../../index";
import { getWord, getWordsByIds } from "../words/word-use-cases";
import { getOwnedTemplate } from "./template-use-cases";

const MAX_TEMPLATE_WORD_BATCH_SIZE = 500;

const templateWordIdsInputSchema = z.object({
  templateId: z.uuid(),
  wordIds: z.array(z.uuid()).min(1).max(MAX_TEMPLATE_WORD_BATCH_SIZE),
});

export const templateRouter = {
  create: protectedProcedure
    .input(
      z.object({
        id: z.uuid(),
        name: z.string(),
      }),
    )
    .handler(async ({ input, context }) => {
      const trimmed = input.name.trim();
      if (!trimmed) throw new Error("Name is required");

      const now = new Date();
      await db.insert(templatesTable).values({
        id: input.id,
        userId: context.session.user.id,
        name: trimmed,
        createdAt: now,
        updatedAt: now,
      });
    }),

  getById: protectedProcedure
    .input(z.object({ templateId: z.uuid() }))
    .handler(async ({ input, context }) => {
      const template = await db.query.templatesTable.findFirst({
        where: and(
          eq(templatesTable.id, input.templateId),
          eq(templatesTable.userId, context.session.user.id),
        ),
      });

      return template ?? null;
    }),

  listForCurrentUser: protectedProcedure.handler(async ({ context }) => {
    const rows = await db
      .select({
        id: templatesTable.id,
        name: templatesTable.name,
        updatedAt: templatesTable.updatedAt,
        wordCount: count(templateWordsTable.wordId),
      })
      .from(templatesTable)
      .leftJoin(templateWordsTable, eq(templateWordsTable.templateId, templatesTable.id))
      .where(eq(templatesTable.userId, context.session.user.id))
      .groupBy(templatesTable.id, templatesTable.name, templatesTable.updatedAt)
      .orderBy(desc(templatesTable.updatedAt));

    return rows;
  }),

  remove: protectedProcedure
    .input(z.object({ templateId: z.uuid() }))
    .handler(async ({ input, context }) => {
      await db.transaction(async (tx) => {
        await tx
          .delete(templateWordsTable)
          .where(eq(templateWordsTable.templateId, input.templateId));

        // this ensure that we only delete if the auth user own the template
        await tx
          .delete(templatesTable)
          .where(
            and(
              eq(templatesTable.id, input.templateId),
              eq(templatesTable.userId, context.session.user.id),
            ),
          );
      });
    }),

  getWords: protectedProcedure
    .input(z.object({ templateId: z.uuid() }))
    .handler(async ({ input, context }) => {
      // Throws if template is not owned by user or does not exist
      await getOwnedTemplate(input.templateId, context.session.user.id);

      return (
        await db.query.templateWordsTable.findMany({
          where: eq(templateWordsTable.templateId, input.templateId),
          with: {
            word: true,
          },
        })
      ).map((row) => row.word);
    }),

  listMembershipForWord: protectedProcedure
    .input(z.object({ wordId: z.uuid() }))
    .handler(async ({ input, context }) => {
      const rows = await db
        .select({
          templateId: templatesTable.id,
          name: templatesTable.name,
          includedWordId: templateWordsTable.wordId,
        })
        .from(templatesTable)
        .innerJoin(wordsTable, eq(wordsTable.id, input.wordId))
        .leftJoin(
          templateWordsTable,
          and(
            eq(templateWordsTable.templateId, templatesTable.id),
            eq(templateWordsTable.wordId, wordsTable.id),
          ),
        )
        .where(eq(templatesTable.userId, context.session.user.id))
        .orderBy(desc(templatesTable.createdAt));

      return rows.map((template) => ({
        templateId: template.templateId,
        name: template.name,
        included: template.includedWordId != null,
      }));
    }),

  addWordsToTemplate: protectedProcedure
    .input(templateWordIdsInputSchema)
    .handler(async ({ input, context }) => {
      const uniqueWordIds = [...new Set(input.wordIds)];
      const requestedInsertsCount = uniqueWordIds.length;

      await getOwnedTemplate(input.templateId, context.session.user.id);

      await getWordsByIds(uniqueWordIds);

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

  removeWordsFromTemplate: protectedProcedure
    .input(templateWordIdsInputSchema)
    .handler(async ({ input, context }) => {
      const uniqueWordIds = [...new Set(input.wordIds)];
      const requestedRemovalsCount = uniqueWordIds.length;

      await getOwnedTemplate(input.templateId, context.session.user.id);

      const removedRows = await db
        .delete(templateWordsTable)
        .where(
          and(
            eq(templateWordsTable.templateId, input.templateId),
            inArray(templateWordsTable.wordId, uniqueWordIds),
          ),
        )
        .returning({ wordId: templateWordsTable.wordId });

      const removed = removedRows.length;
      const skipped = requestedRemovalsCount - removed;

      if (removed > 0) {
        await db
          .update(templatesTable)
          .set({ updatedAt: new Date() })
          .where(eq(templatesTable.id, input.templateId));
      }

      return {
        removed,
        skipped,
        requestedRemovalsCount,
      };
    }),

  toggleWordInTemplate: protectedProcedure
    .input(
      z.object({
        templateId: z.uuid(),
        wordId: z.uuid(),
      }),
    )
    .handler(async ({ input, context }) => {
      await getOwnedTemplate(input.templateId, context.session.user.id);
      await getWord(input.wordId);

      const doesExist = await db.query.templateWordsTable.findFirst({
        where: and(
          eq(templateWordsTable.templateId, input.templateId),
          eq(templateWordsTable.wordId, input.wordId),
        ),
      });
      const now = new Date();

      if (doesExist) {
        await db
          .delete(templateWordsTable)
          .where(
            and(
              eq(templateWordsTable.templateId, input.templateId),
              eq(templateWordsTable.wordId, input.wordId),
            ),
          );
      } else {
        await db.insert(templateWordsTable).values({
          templateId: input.templateId,
          wordId: input.wordId,
          createdAt: now,
        });
      }

      await db
        .update(templatesTable)
        .set({ updatedAt: now })
        .where(eq(templatesTable.id, input.templateId));
    }),
};
