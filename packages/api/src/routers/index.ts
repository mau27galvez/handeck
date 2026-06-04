import { randomUUID } from "node:crypto";

import { db } from "@handeck/db";
import { baseTemplates, templateWords, templates, words } from "@handeck/db/schema";
import { env } from "@handeck/env/server";
import type { RouterClient } from "@orpc/server";
import { and, desc, eq, gte, ilike, inArray, lt } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure, publicProcedure } from "../index";
import type { MixedSearchToken, PinyinSearch } from "../dictionarySearch";
import { parseDictionarySearchQuery } from "../dictionarySearch";

const MAX_IMPORT_BATCH_SIZE = 500;
const MAX_SEARCH_RESULTS = 50;
const MAX_MIXED_SEARCH_CANDIDATES = 250;

const uuidSchema = z.uuid();

const wordFieldsSchema = z.object({
  simplifiedHanzi: z.string(),
  numberedPinyin: z.string(),
  diacriticPinyin: z.string(),
  normalizedPinyin: z.string(),
  numberedPinyinSearch: z.string(),
  pinyinSyllables: z.array(z.string()),
  numberedPinyinSyllables: z.array(z.string()),
  meaning: z.string(),
});

type Word = typeof words.$inferSelect;
type WordSearchResult = Word & {
  searchMatchType: "english" | "mixed" | "pinyin" | "simplified";
};

export const appRouter = {
  healthCheck: publicProcedure.handler(() => {
    return "OK";
  }),

  privateData: protectedProcedure.handler(({ context }) => {
    return {
      message: "This is private",
      user: context.session.user,
    };
  }),

  auth: {
    getSession: publicProcedure.handler(({ context }) => {
      return context.session;
    }),

    getCurrentUser: protectedProcedure.handler(({ context }) => {
      return context.session.user;
    }),
  },

  baseTemplate: {
    list: publicProcedure.handler(async () => {
      return await db.select().from(baseTemplates);
    }),
  },

  word: {
    search: publicProcedure
      .input(
        z.object({
          query: z.string(),
          limit: z.number().optional(),
        }),
      )
      .handler(async ({ input }) => {
        const limit = Math.min(
          Math.max(Math.trunc(input.limit ?? MAX_SEARCH_RESULTS), 1),
          MAX_SEARCH_RESULTS,
        );
        const parsedQuery = parseDictionarySearchQuery(input.query);

        switch (parsedQuery.kind) {
          case "unsupported":
            return [];
          case "simplified":
            return await searchSimplified(parsedQuery.value, limit);
          case "latin":
            return await searchLatin(parsedQuery.pinyin, parsedQuery.englishQuery, limit);
          case "mixed":
            return await searchMixed(parsedQuery.tokens, limit);
        }
      }),

    insertBatch: publicProcedure
      .input(
        z.object({
          importToken: z.string(),
          entries: z.array(wordFieldsSchema),
        }),
      )
      .handler(async ({ input }) => {
        validateImportToken(input.importToken);

        if (input.entries.length > MAX_IMPORT_BATCH_SIZE) {
          throw new Error(
            `Import batches cannot contain more than ${MAX_IMPORT_BATCH_SIZE} entries.`,
          );
        }

        const now = new Date();
        await db.insert(words).values(
          input.entries.map((entry) => ({
            id: randomUUID(),
            ...entry,
            audioUrl: null,
            createdAt: now,
            updatedAt: now,
          })),
        );

        return { inserted: input.entries.length };
      }),

    clearBatch: publicProcedure
      .input(
        z.object({
          importToken: z.string(),
          limit: z.number().optional(),
        }),
      )
      .handler(async ({ input }) => {
        validateImportToken(input.importToken);

        const limit = Math.min(Math.max(Math.trunc(input.limit ?? 200), 1), MAX_IMPORT_BATCH_SIZE);
        const existingEntries = await db.select({ id: words.id }).from(words).limit(limit);
        if (existingEntries.length > 0) {
          await db.delete(words).where(
            inArray(
              words.id,
              existingEntries.map((entry) => entry.id),
            ),
          );
        }

        return {
          deleted: existingEntries.length,
          isDone: existingEntries.length < limit,
        };
      }),
  },

  template: {
    create: protectedProcedure
      .input(
        z.object({
          name: z.string(),
          baseTemplateId: uuidSchema.optional(),
        }),
      )
      .handler(async ({ input, context }) => {
        const trimmed = input.name.trim();
        if (!trimmed) throw new Error("Name is required");

        if (input.baseTemplateId != null) {
          const [base] = await db
            .select()
            .from(baseTemplates)
            .where(eq(baseTemplates.id, input.baseTemplateId))
            .limit(1);
          if (!base) throw new Error("Base template not found");
        }

        const now = new Date();
        const [template] = await db
          .insert(templates)
          .values({
            id: randomUUID(),
            userId: context.session.user.id,
            name: trimmed,
            baseTemplateId: input.baseTemplateId,
            createdAt: now,
            updatedAt: now,
          })
          .returning({ id: templates.id });

        return template?.id;
      }),

    getById: protectedProcedure
      .input(z.object({ templateId: uuidSchema }))
      .handler(async ({ input, context }) => {
        const [template] = await db
          .select()
          .from(templates)
          .where(
            and(eq(templates.id, input.templateId), eq(templates.userId, context.session.user.id)),
          )
          .limit(1);

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
        })
        .from(templates)
        .leftJoin(baseTemplates, eq(templates.baseTemplateId, baseTemplates.id))
        .where(eq(templates.userId, context.session.user.id))
        .orderBy(desc(templates.updatedAt));

      const counts = await Promise.all(
        rows.map(async (template) => {
          const wordRows = await db
            .select({ wordId: templateWords.wordId })
            .from(templateWords)
            .where(eq(templateWords.templateId, template.id));
          return [template.id, wordRows.length] as const;
        }),
      );
      const wordCountByTemplateId = new Map(counts);

      return rows.map((template) => ({
        ...template,
        wordCount: wordCountByTemplateId.get(template.id) ?? 0,
        baseTemplate: template.baseTemplate ?? undefined,
      }));
    }),

    remove: protectedProcedure
      .input(z.object({ templateId: uuidSchema }))
      .handler(async ({ input, context }) => {
        await getOwnedTemplate(input.templateId, context.session.user.id);
        await db.delete(templateWords).where(eq(templateWords.templateId, input.templateId));
        await db.delete(templates).where(eq(templates.id, input.templateId));
      }),

    getWords: protectedProcedure
      .input(z.object({ templateId: uuidSchema }))
      .handler(async ({ input, context }) => {
        const template = await getOwnedTemplateOrNull(input.templateId, context.session.user.id);
        if (!template) return null;

        const rows = await db
          .select({ word: words })
          .from(templateWords)
          .innerJoin(words, eq(templateWords.wordId, words.id))
          .where(eq(templateWords.templateId, input.templateId));

        return rows.map((row) => row.word);
      }),

    listMembershipForWord: protectedProcedure
      .input(z.object({ wordId: uuidSchema }))
      .handler(async ({ input, context }) => {
        const [word] = await db.select().from(words).where(eq(words.id, input.wordId)).limit(1);
        if (!word) return [];

        const userTemplates = await db
          .select({ id: templates.id, name: templates.name })
          .from(templates)
          .where(eq(templates.userId, context.session.user.id))
          .orderBy(desc(templates.createdAt));

        const membershipRows = await db
          .select({ templateId: templateWords.templateId })
          .from(templateWords)
          .where(eq(templateWords.wordId, input.wordId));
        const includedTemplateIds = new Set(membershipRows.map((row) => row.templateId));

        return userTemplates.map((template) => ({
          templateId: template.id,
          name: template.name,
          included: includedTemplateIds.has(template.id),
        }));
      }),

    toggleWordInTemplate: protectedProcedure
      .input(
        z.object({
          templateId: uuidSchema,
          wordId: uuidSchema,
        }),
      )
      .handler(async ({ input, context }) => {
        await getOwnedTemplate(input.templateId, context.session.user.id);
        const [word] = await db.select().from(words).where(eq(words.id, input.wordId)).limit(1);
        if (!word) throw new Error("Word not found");

        const [existing] = await db
          .select()
          .from(templateWords)
          .where(
            and(
              eq(templateWords.templateId, input.templateId),
              eq(templateWords.wordId, input.wordId),
            ),
          )
          .limit(1);
        const now = new Date();

        if (existing) {
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

        await db
          .update(templates)
          .set({ updatedAt: now })
          .where(eq(templates.id, input.templateId));
      }),
  },
};

async function getOwnedTemplate(templateId: string, userId: string) {
  const template = await getOwnedTemplateOrNull(templateId, userId);
  if (!template) throw new Error("Template not found");
  return template;
}

async function getOwnedTemplateOrNull(templateId: string, userId: string) {
  const [template] = await db
    .select()
    .from(templates)
    .where(and(eq(templates.id, templateId), eq(templates.userId, userId)))
    .limit(1);

  return template ?? null;
}

async function searchSimplified(simplifiedPrefix: string, limit: number) {
  return withSearchMatch(await querySimplifiedPrefix(simplifiedPrefix, limit), "simplified");
}

async function querySimplifiedPrefix(simplifiedPrefix: string, limit: number) {
  return await db
    .select()
    .from(words)
    .where(
      and(
        gte(words.simplifiedHanzi, simplifiedPrefix),
        lt(words.simplifiedHanzi, `${simplifiedPrefix}\uffff`),
      ),
    )
    .limit(limit);
}

async function searchLatin(pinyin: PinyinSearch | null, englishQuery: string, limit: number) {
  const results: WordSearchResult[] = [];

  if (pinyin) {
    appendUnique(results, withSearchMatch(await queryPinyinPrefix(pinyin, limit), "pinyin"), limit);
  }

  if (results.length < limit) {
    const englishResults = await db
      .select()
      .from(words)
      .where(ilike(words.meaning, `%${englishQuery}%`))
      .limit(limit);
    appendUnique(results, withSearchMatch(englishResults, "english"), limit);
  }

  return results;
}

async function queryPinyinPrefix(pinyin: PinyinSearch, limit: number) {
  if (pinyin.hasToneNumbers) {
    return await db
      .select()
      .from(words)
      .where(
        and(
          gte(words.numberedPinyinSearch, pinyin.numberedPinyinSearch),
          lt(words.numberedPinyinSearch, `${pinyin.numberedPinyinSearch}\uffff`),
        ),
      )
      .limit(limit);
  }

  return await db
    .select()
    .from(words)
    .where(
      and(
        gte(words.normalizedPinyin, pinyin.normalizedPinyin),
        lt(words.normalizedPinyin, `${pinyin.normalizedPinyin}\uffff`),
      ),
    )
    .limit(limit);
}

async function searchMixed(tokens: MixedSearchToken[], limit: number) {
  const firstToken = tokens[0];
  if (!firstToken) {
    return [];
  }

  const candidates =
    firstToken.kind === "han"
      ? await querySimplifiedPrefix(firstHanPrefix(tokens), MAX_MIXED_SEARCH_CANDIDATES)
      : await queryPinyinPrefix(firstToken.value, MAX_MIXED_SEARCH_CANDIDATES);

  return withSearchMatch(
    candidates.filter((entry) => matchesMixedSearch(entry, tokens)).slice(0, limit),
    "mixed",
  );
}

function firstHanPrefix(tokens: MixedSearchToken[]) {
  const firstNonHanIndex = tokens.findIndex((token) => token.kind !== "han");
  const endIndex = firstNonHanIndex === -1 ? tokens.length : firstNonHanIndex;
  return tokens
    .slice(0, endIndex)
    .filter((token): token is Extract<MixedSearchToken, { kind: "han" }> => token.kind === "han")
    .map((token) => token.value)
    .join("");
}

function matchesMixedSearch(entry: Word, tokens: MixedSearchToken[]) {
  const hanzi = [...entry.simplifiedHanzi];
  return matchesMixedSearchFrom(entry, tokens, hanzi, 0, 0);
}

function matchesMixedSearchFrom(
  entry: Word,
  tokens: MixedSearchToken[],
  hanzi: string[],
  tokenIndex: number,
  syllableIndex: number,
): boolean {
  const token = tokens[tokenIndex];
  if (!token) {
    return true;
  }

  if (token.kind === "han") {
    return (
      hanzi[syllableIndex] === token.value &&
      matchesMixedSearchFrom(entry, tokens, hanzi, tokenIndex + 1, syllableIndex + 1)
    );
  }

  const syllables = token.value.hasToneNumbers
    ? entry.numberedPinyinSyllables
    : entry.pinyinSyllables;
  for (let endIndex = syllableIndex + 1; endIndex <= syllables.length; endIndex += 1) {
    const segment = syllables.slice(syllableIndex, endIndex).join("");
    if (
      segment.startsWith(
        token.value.hasToneNumbers
          ? token.value.numberedPinyinSearch
          : token.value.normalizedPinyin,
      ) &&
      matchesMixedSearchFrom(entry, tokens, hanzi, tokenIndex + 1, endIndex)
    ) {
      return true;
    }
  }

  return false;
}

function appendUnique(results: WordSearchResult[], additions: WordSearchResult[], limit: number) {
  const seen = new Set(results.map((entry) => entry.id));
  for (const entry of additions) {
    if (seen.has(entry.id)) {
      continue;
    }
    results.push(entry);
    seen.add(entry.id);
    if (results.length >= limit) {
      return;
    }
  }
}

function withSearchMatch(entries: Word[], searchMatchType: WordSearchResult["searchMatchType"]) {
  return entries.map((entry) => ({ ...entry, searchMatchType }));
}

function validateImportToken(importToken: string) {
  const expectedToken = env.CEDICT_IMPORT_TOKEN;

  if (!expectedToken) {
    throw new Error("Set CEDICT_IMPORT_TOKEN before importing CEDICT.");
  }

  if (importToken !== expectedToken) {
    throw new Error("Invalid CEDICT import token.");
  }
}

export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
