import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { authComponent } from "./auth";
import {
  templateConfigsSchema,
  type TemplateConfigs,
  DEFAULT_CONFIGS,
} from "./schemas";
import { ensureProfileForAuthUser, getProfileIdForAuthUser } from "./profile";

function slugify(name: string) {
  return name.trim().toLowerCase().replace(/ /g, "-");
}

export const create = mutation({
  args: {
    name: v.string(),
    base_template_id: v.optional(v.id("base_template")),
  },
  handler: async (ctx, { name, base_template_id }) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser) throw new Error("Not authenticated");

    const trimmed = name.trim();
    if (!trimmed) throw new Error("Name is required");

    let configs: TemplateConfigs = DEFAULT_CONFIGS;
    if (base_template_id != null) {
      const base = await ctx.db.get(base_template_id);
      if (!base) throw new Error("Base template not found");
      const parsed = templateConfigsSchema.safeParse(base.configs);
      if (!parsed.success) {
        throw new Error(
          `Invalid configs in base template: ${parsed.error.message}`
        );
      }
      configs = parsed.data;
    }

    const slug = slugify(trimmed);
    const profileId = await ensureProfileForAuthUser(ctx, authUser);
    const now = Date.now();
    await ctx.db.insert("template", {
      userId: profileId,
      name: trimmed,
      slug: slug,
      configs: {
        topics: configs.topics,
        sentencesPerWord: configs.sentences_per_word,
      },
      ...(base_template_id ? { baseTemplateId: base_template_id } : {}),
      createdAt: now,
      updatedAt: now,
    });
    return slug;
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser) return null;

    const profileId = await getProfileIdForAuthUser(ctx, authUser);
    if (!profileId) return null;

    const template = await ctx.db
      .query("template")
      .withIndex("by_user", (q) => q.eq("userId", profileId))
      .filter((q) => q.eq(q.field("slug"), slug))
      .unique();

    return template ?? null;
  },
});