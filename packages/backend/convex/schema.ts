import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  baseTemplate: defineTable({
    name: v.string(),
    configs: v.object({
      topics: v.array(v.string()),
      sentencesPerWord: v.number(),
    }),
  }),

  profiles: defineTable({
    betterAuthUserId: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    image: v.optional(v.union(v.null(), v.string())),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_betterAuthUserId", ["betterAuthUserId"]),

  template: defineTable({
    userId: v.id("profiles"),
    name: v.string(),
    baseTemplateId: v.optional(v.id("baseTemplate")),
    words: v.optional(v.array(v.id("word"))), // optional until words are seeded
    cardTemplate: v.optional(
      v.object({
        layout: v.string(), // html
        styles: v.string(), // css
      }),
    ),
    configs: v.object({
      topics: v.array(v.string()),
      sentencesPerWord: v.number(),
    }),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  word: defineTable({
    simplifiedHanzi: v.string(),
    pinyin: v.string(),
    normalizedPinyin: v.string(),
    tanslation: v.string(),
    audioUrl: v.union(v.string(), v.null()), // temporarily nullable
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_hanzi_and_pinyin", ["simplifiedHanzi", "normalizedPinyin"]),

  dictionaryEntry: defineTable({
    simplifiedHanzi: v.string(),
    numberedPinyin: v.string(),
    diacriticPinyin: v.string(),
    normalizedPinyin: v.string(),
    numberedPinyinSearch: v.string(),
    pinyinSyllables: v.array(v.string()),
    numberedPinyinSyllables: v.array(v.string()),
    meaning: v.string(),
  })
    .index("by_normalizedPinyin", ["normalizedPinyin"])
    .index("by_numberedPinyinSearch", ["numberedPinyinSearch"])
    .index("by_simplifiedHanzi", ["simplifiedHanzi"])
    .searchIndex("search_meaning", {
      searchField: "meaning",
    }),

  sentence: defineTable({
    simplifiedHanzi: v.string(),
    translation: v.string(),
    audioUrl: v.union(v.string(), v.null()), // temporarily nullable
    createdAt: v.number(),
    updatedAt: v.number(),
  }), // not directly related to words

  note: defineTable({
    wordId: v.id("word"),
    sentenceId: v.id("sentence"),
    createdAt: v.number(),
    updatedAt: v.number(),
  }),

  deck: defineTable({
    userId: v.id("profiles"),
    templateId: v.id("template"),
    noteIds: v.array(v.id("note")),
    createdAt: v.number(),
    updatedAt: v.number(),
  }),
});
