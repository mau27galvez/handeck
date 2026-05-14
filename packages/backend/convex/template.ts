import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
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
        sentencesPerWord: configs.sentences_per_word,
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
