import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  baseTemplates: defineTable({
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

  templates: defineTable({
    userId: v.id("profiles"),
    name: v.string(),
    baseTemplateId: v.optional(v.id("baseTemplates")),
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

  // Join table: at most one row per (templateId, wordId). Mutations use
  // by_template_word with .unique(); duplicates indicate a bug and should be repaired.
  templateWords: defineTable({
    templateId: v.id("templates"),
    wordId: v.id("words"),
    createdAt: v.number(),
  })
    .index("by_template", ["templateId"])
    .index("by_word", ["wordId"])
    .index("by_template_word", ["templateId", "wordId"]),

  words: defineTable({
    simplifiedHanzi: v.string(),
    numberedPinyin: v.string(),
    diacriticPinyin: v.string(),
    normalizedPinyin: v.string(),
    numberedPinyinSearch: v.string(),
    pinyinSyllables: v.array(v.string()),
    numberedPinyinSyllables: v.array(v.string()),
    meaning: v.string(),
    audioUrl: v.union(v.string(), v.null()), // temporarily nullable
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_normalizedPinyin", ["normalizedPinyin"])
    .index("by_numberedPinyinSearch", ["numberedPinyinSearch"])
    .index("by_simplifiedHanzi", ["simplifiedHanzi"])
    .index("by_simplifiedHanzi_normalizedPinyin", ["simplifiedHanzi", "normalizedPinyin"])
    .searchIndex("search_meaning", {
      searchField: "meaning",
    }),

  sentences: defineTable({
    simplifiedHanzi: v.string(),
    translation: v.string(),
    audioUrl: v.union(v.string(), v.null()), // temporarily nullable
    createdAt: v.number(),
    updatedAt: v.number(),
  }), // not directly related to words

  notes: defineTable({
    wordId: v.id("words"),
    sentenceId: v.id("sentences"),
    createdAt: v.number(),
    updatedAt: v.number(),
  }),

  decks: defineTable({
    userId: v.id("profiles"),
    templateId: v.id("templates"),
    noteIds: v.array(v.id("notes")),
    createdAt: v.number(),
    updatedAt: v.number(),
  }),
});
