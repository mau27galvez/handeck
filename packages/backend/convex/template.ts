import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { authComponent } from "./auth";
import { templateConfigsSchema, type TemplateConfigs, DEFAULT_CONFIGS } from "./schemas";
import { ensureProfileForAuthUser, getProfileIdForAuthUser } from "./profile";

const DELETE_TEMPLATE_WORDS_BATCH_SIZE = 200;

export const create = mutation({
  args: {
    name: v.string(),
    baseTemplateId: v.optional(v.id("baseTemplates")),
  },
  handler: async (ctx, { name, baseTemplateId }) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser) throw new Error("Not authenticated");

    const trimmed = name.trim();
    if (!trimmed) throw new Error("Name is required");

    let configs: TemplateConfigs = DEFAULT_CONFIGS;
    if (baseTemplateId != null) {
      const base = await ctx.db.get(baseTemplateId);
      if (!base) throw new Error("Base template not found");
      const parsed = templateConfigsSchema.safeParse(base.configs);
      if (!parsed.success) {
        throw new Error(`Invalid configs in base template: ${parsed.error.message}`);
      }
      configs = parsed.data;
    }

    const profileId = await ensureProfileForAuthUser(ctx, authUser);
    const now = Date.now();
    const templateId = await ctx.db.insert("templates", {
      userId: profileId,
      name: trimmed,
      configs: {
        topics: configs.topics,
        sentencesPerWord: configs.sentencesPerWord,
      },
      ...(baseTemplateId ? { baseTemplateId } : {}),
      createdAt: now,
      updatedAt: now,
    });
    return templateId;
  },
});

export const getById = query({
  args: { templateId: v.id("templates") },
  handler: async (ctx, { templateId }) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser) return null;

    const profileId = await getProfileIdForAuthUser(ctx, authUser);
    if (!profileId) return null;

    const template = await ctx.db.get(templateId);
    if (!template || template.userId !== profileId) return null;

    return template;
  },
});

export const listForCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser) return [];

    const profileId = await getProfileIdForAuthUser(ctx, authUser);
    if (!profileId) return [];

    const templates = await ctx.db
      .query("templates")
      .withIndex("by_user", (q) => q.eq("userId", profileId))
      .collect();

    // Sort by updatedAt descending (recent first)
    templates.sort((a, b) => b.updatedAt - a.updatedAt);

    // Batch fetch base template names to avoid N+1
    const baseTemplateIds = [
      ...new Set(
        templates
          .map((t) => t.baseTemplateId)
          .filter((id): id is NonNullable<typeof id> => id !== undefined),
      ),
    ];

    const baseTemplateMap = new Map<string, string>();
    for (const baseId of baseTemplateIds) {
      const base = await ctx.db.get(baseId);
      if (base && "name" in base) {
        baseTemplateMap.set(baseId as string, base.name);
      }
    }

    const wordCountByTemplateId = new Map<string, number>();
    for (const template of templates) {
      wordCountByTemplateId.set(template._id, await getWordCountForTemplate(ctx, template._id));
    }

    return templates.map((template) => ({
      ...template,
      wordCount: wordCountByTemplateId.get(template._id) ?? 0,
      baseTemplate: template.baseTemplateId
        ? baseTemplateMap.get(template.baseTemplateId)
        : undefined,
    }));
  },
});

async function getOwnedTemplate(ctx: MutationCtx, templateId: Id<"templates">) {
  const authUser = await authComponent.safeGetAuthUser(ctx);
  if (!authUser) throw new Error("Not authenticated");

  const profileId = await getProfileIdForAuthUser(ctx, authUser);
  if (!profileId) throw new Error("Not authenticated");

  const template = await ctx.db.get(templateId);
  if (!template || template.userId !== profileId) {
    throw new Error("Template not found");
  }

  return template;
}

async function getWordCountForTemplate(ctx: QueryCtx | MutationCtx, templateId: Id<"templates">) {
  const templateWords = await ctx.db
    .query("templateWords")
    .withIndex("by_template", (q) => q.eq("templateId", templateId))
    .collect();

  return templateWords.length;
}

async function deleteTemplateAndTemplateWordsBatch(ctx: MutationCtx, templateId: Id<"templates">) {
  const batch = await ctx.db
    .query("templateWords")
    .withIndex("by_template", (q) => q.eq("templateId", templateId))
    .take(DELETE_TEMPLATE_WORDS_BATCH_SIZE);

  for (const templateWord of batch) {
    await ctx.db.delete(templateWord._id);
  }

  if (batch.length === DELETE_TEMPLATE_WORDS_BATCH_SIZE) {
    await ctx.scheduler.runAfter(0, internal.template.continueDeleteTemplate, { templateId });
    return;
  }

  await ctx.db.delete(templateId);
}

export const continueDeleteTemplate = internalMutation({
  args: { templateId: v.id("templates") },
  handler: async (ctx, { templateId }) => {
    await deleteTemplateAndTemplateWordsBatch(ctx, templateId);
  },
});

export const remove = mutation({
  args: { templateId: v.id("templates") },
  handler: async (ctx, { templateId }) => {
    await getOwnedTemplate(ctx, templateId);
    await deleteTemplateAndTemplateWordsBatch(ctx, templateId);
  },
});

export const listMembershipForWord = query({
  args: { wordId: v.id("words") },
  handler: async (ctx, { wordId }) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser) return null;

    const profileId = await getProfileIdForAuthUser(ctx, authUser);
    if (!profileId) return null;

    const word = await ctx.db.get(wordId);
    if (!word) return [];

    const templates = await ctx.db
      .query("templates")
      .withIndex("by_user", (q) => q.eq("userId", profileId))
      .collect();

    templates.sort((a, b) => b.createdAt - a.createdAt);

    const membershipRows = await ctx.db
      .query("templateWords")
      .withIndex("by_word", (q) => q.eq("wordId", wordId))
      .collect();

    const includedTemplateIds = new Set(membershipRows.map((row) => row.templateId));

    return templates.map((template) => ({
      templateId: template._id,
      name: template.name,
      included: includedTemplateIds.has(template._id),
    }));
  },
});

export const toggleWordInTemplate = mutation({
  args: {
    templateId: v.id("templates"),
    wordId: v.id("words"),
  },
  handler: async (ctx, { templateId, wordId }) => {
    await getOwnedTemplate(ctx, templateId);
    const word = await ctx.db.get(wordId);
    if (!word) throw new Error("Word not found");

    const existing = await ctx.db
      .query("templateWords")
      .withIndex("by_template_word", (q) => q.eq("templateId", templateId).eq("wordId", wordId))
      .unique();

    const now = Date.now();

    if (existing) {
      await ctx.db.delete(existing._id);
      await ctx.db.patch(templateId, { updatedAt: now });
      return;
    }

    await ctx.db.insert("templateWords", {
      templateId,
      wordId,
      createdAt: now,
    });
    await ctx.db.patch(templateId, { updatedAt: now });
  },
});
