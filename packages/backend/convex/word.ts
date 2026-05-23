import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

export async function findOrCreateFromDictionaryEntry(
  ctx: MutationCtx,
  dictionaryEntryId: Id<"dictionaryEntry">,
): Promise<Id<"word">> {
  const entry = await ctx.db.get(dictionaryEntryId);
  if (!entry) {
    throw new Error("Dictionary entry not found");
  }

  const existing = await ctx.db
    .query("word")
    .withIndex("by_hanzi_and_pinyin", (q) =>
      q.eq("simplifiedHanzi", entry.simplifiedHanzi).eq("normalizedPinyin", entry.normalizedPinyin),
    )
    .unique();

  if (existing) {
    return existing._id;
  }

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
