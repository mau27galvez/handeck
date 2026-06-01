import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { authComponent } from "./auth";
import { getProfileIdForAuthUser } from "./profile";

export async function getOwnedTemplate(ctx: MutationCtx, templateId: Id<"templates">) {
  const authUser = await authComponent.safeGetAuthUser(ctx);
  if (!authUser) throw new Error("Not authenticated");

  const profileId = await getProfileIdForAuthUser(ctx, authUser);
  if (!profileId) throw new Error("Not authenticated");

  const template = await ctx.db.get(templateId);
  if (!template || template.userId !== profileId) {
    throw new Error("Template not found");
  }

  return { template, profileId };
}

export async function getOwnedTemplateForQuery(ctx: QueryCtx, templateId: Id<"templates">) {
  const authUser = await authComponent.safeGetAuthUser(ctx);
  if (!authUser) return null;

  const profileId = await getProfileIdForAuthUser(ctx, authUser);
  if (!profileId) return null;

  const template = await ctx.db.get(templateId);
  if (!template || template.userId !== profileId) return null;

  return { template, profileId };
}

export async function loadTemplateWordsForGeneration(
  ctx: QueryCtx | MutationCtx,
  templateId: Id<"templates">,
) {
  const templateWords = await ctx.db
    .query("templateWords")
    .withIndex("by_template", (q) => q.eq("templateId", templateId))
    .collect();

  templateWords.sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
    return a.wordId.localeCompare(b.wordId);
  });

  const words: Doc<"words">[] = [];
  for (const templateWord of templateWords) {
    const word = await ctx.db.get(templateWord.wordId);
    if (!word) throw new Error("Word not found for template");
    words.push(word);
  }

  return words;
}
