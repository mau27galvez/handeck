import { db } from "@handeck/db";
import { baseTemplates, templates, templateWords, words } from "@handeck/db/schema";
import { eq, and, desc, inArray, count } from "drizzle-orm";
import z from "zod";
import { protectedProcedure } from "../../index";
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
        baseTemplateId: z.uuid().optional(),
      }),
    )
    .handler(async ({ input, context }) => {
      const trimmed = input.name.trim();
      if (!trimmed) throw new Error("Name is required");

      if (input.baseTemplateId != null) {
        const baseTemplate = await db.query.baseTemplates.findFirst({
          where: eq(baseTemplates.id, input.baseTemplateId),
        });

        if (!baseTemplate) throw new Error("Base template not found");
      }

      const now = new Date();
      await db.insert(templates).values({
        id: input.id,
        userId: context.session.user.id,
        name: trimmed,
        baseTemplateId: input.baseTemplateId,
        createdAt: now,
        updatedAt: now,
      });
    }),

  getById: protectedProcedure
    .input(z.object({ templateId: z.uuid() }))
    .handler(async ({ input, context }) => {
      const template = await db.query.templates.findFirst({
        where: and(
          eq(templates.id, input.templateId),
          eq(templates.userId, context.session.user.id),
        ),
      });

      return template ?? null;
    }),

  listForCurrentUser: protectedProcedure.handler(async ({ context }) => {
    const rows = await db
      .select({
        id: templates.id,
        name: templates.name,
        baseTemplateId: templates.baseTemplateId,
        baseTemplate: baseTemplates.name,
        updatedAt: templates.updatedAt,
        wordCount: count(templateWords.wordId),
      })
      .from(templates)
      .leftJoin(baseTemplates, eq(templates.baseTemplateId, baseTemplates.id))
      .leftJoin(templateWords, eq(templateWords.templateId, templates.id))
      .where(eq(templates.userId, context.session.user.id))
      .groupBy(
        templates.id,
        templates.name,
        templates.baseTemplateId,
        templates.updatedAt,
        baseTemplates.name,
      )
      .orderBy(desc(templates.updatedAt));

    return rows.map((template) => ({
      ...template,
      baseTemplateId: template.baseTemplateId ?? undefined,
      baseTemplate: template.baseTemplate ?? undefined,
    }));
  }),

  remove: protectedProcedure
    .input(z.object({ templateId: z.uuid() }))
    .handler(async ({ input, context }) => {
      await db.transaction(async (tx) => {
        await tx.delete(templateWords).where(eq(templateWords.templateId, input.templateId));

        // this ensure that we only delete if the auth user own the template
        await tx
          .delete(templates)
          .where(
            and(eq(templates.id, input.templateId), eq(templates.userId, context.session.user.id)),
          );
      });
    }),

  getWords: protectedProcedure
    .input(z.object({ templateId: z.uuid() }))
    .handler(async ({ input, context }) => {
      // Throws if template is not owned by user or does not exist
      await getOwnedTemplate(input.templateId, context.session.user.id);

      return (
        await db.query.templateWords.findMany({
          where: eq(templateWords.templateId, input.templateId),
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
          templateId: templates.id,
          name: templates.name,
          includedWordId: templateWords.wordId,
        })
        .from(templates)
        .innerJoin(words, eq(words.id, input.wordId))
        .leftJoin(
          templateWords,
          and(eq(templateWords.templateId, templates.id), eq(templateWords.wordId, words.id)),
        )
        .where(eq(templates.userId, context.session.user.id))
        .orderBy(desc(templates.createdAt));

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

      const existingWords = await db.query.words.findMany({
        where: inArray(words.id, uniqueWordIds),
      });
      if (existingWords.length !== uniqueWordIds.length) {
        throw new Error("Word not found");
      }

      const now = new Date();
      const addedRows = await db
        .insert(templateWords)
        .values(
          uniqueWordIds.map((wordId) => ({
            templateId: input.templateId,
            wordId,
            createdAt: now,
          })),
        )
        .onConflictDoNothing()
        .returning({ wordId: templateWords.wordId });

      if (addedRows.length > 0) {
        await db
          .update(templates)
          .set({ updatedAt: now })
          .where(eq(templates.id, input.templateId));
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
        .delete(templateWords)
        .where(
          and(
            eq(templateWords.templateId, input.templateId),
            inArray(templateWords.wordId, uniqueWordIds),
          ),
        )
        .returning({ wordId: templateWords.wordId });

      const removed = removedRows.length;
      const skipped = requestedRemovalsCount - removed;

      if (removed > 0) {
        await db
          .update(templates)
          .set({ updatedAt: new Date() })
          .where(eq(templates.id, input.templateId));
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
      const word = await db.query.words.findFirst({
        where: eq(words.id, input.wordId),
      });
      if (!word) throw new Error("Word not found");

      const doesExist = await db.query.templateWords.findFirst({
        where: and(
          eq(templateWords.templateId, input.templateId),
          eq(templateWords.wordId, input.wordId),
        ),
      });
      const now = new Date();

      if (doesExist) {
        await db
          .delete(templateWords)
          .where(
            and(
              eq(templateWords.templateId, input.templateId),
              eq(templateWords.wordId, input.wordId),
            ),
          );
      } else {
        await db.insert(templateWords).values({
          templateId: input.templateId,
          wordId: input.wordId,
          createdAt: now,
        });
      }

      await db.update(templates).set({ updatedAt: now }).where(eq(templates.id, input.templateId));
    }),
};
