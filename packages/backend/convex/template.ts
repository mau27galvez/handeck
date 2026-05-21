import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { authComponent } from "./auth";
import { templateConfigsSchema, type TemplateConfigs, DEFAULT_CONFIGS } from "./schemas";
import { ensureProfileForAuthUser, getProfileIdForAuthUser } from "./profile";

export const create = mutation({
  args: {
    name: v.string(),
    baseTemplateId: v.optional(v.id("baseTemplate")),
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
    const templateId = await ctx.db.insert("template", {
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
  args: { templateId: v.id("template") },
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
      .query("template")
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

    return templates.map((template) => ({
      ...template,
      baseTemplate: template.baseTemplateId
        ? baseTemplateMap.get(template.baseTemplateId)
        : undefined,
    }));
  },
});

async function getOwnedTemplate(ctx: MutationCtx, templateId: Id<"template">) {
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

export const remove = mutation({
  args: { templateId: v.id("template") },
  handler: async (ctx, { templateId }) => {
    await getOwnedTemplate(ctx, templateId);
    await ctx.db.delete(templateId);
  },
});
