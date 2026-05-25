import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

export async function findWordForDictionaryEntry(
  ctx: QueryCtx | MutationCtx,
  entry: Pick<Doc<"dictionaryEntry">, "simplifiedHanzi" | "normalizedPinyin">,
) {
  return await ctx.db
    .query("word")
    .withIndex("by_simplifiedHanzi_normalizedPinyin", (q) =>
      q
        .eq("simplifiedHanzi", entry.simplifiedHanzi)
        .eq("normalizedPinyin", entry.normalizedPinyin),
    )
    .first();
}

export async function getOrCreateWordFromDictionaryEntry(
  ctx: MutationCtx,
  dictionaryEntryId: Id<"dictionaryEntry">,
) {
  const entry = await ctx.db.get(dictionaryEntryId);
  if (!entry) throw new Error("Dictionary entry not found");

  const existing = await findWordForDictionaryEntry(ctx, entry);
  if (existing) return existing._id;

  const now = Date.now();
  return await ctx.db.insert("word", {
    simplifiedHanzi: entry.simplifiedHanzi,
    pinyin: entry.diacriticPinyin,
    normalizedPinyin: entry.normalizedPinyin,
    tanslation: entry.meaning,
    audioUrl: null,
    createdAt: now,
    updatedAt: now,
  });
}
