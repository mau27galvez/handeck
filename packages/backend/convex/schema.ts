import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    base_template: defineTable({
        name: v.string(),
        slug: v.string(), // stable key; owner adds label/metadata later
        configs: v.object({
            topics: v.array(v.string()),
            sentences_per_word: v.number(),
        }),
    }).index("by_slug", ["slug"]),

    profiles: defineTable({
        betterAuthUserId: v.string(),
        email: v.optional(v.string()),
        name: v.optional(v.string()),
        image: v.optional(v.union(v.null(), v.string())),
        created_at: v.number(),
        updated_at: v.number(),
    }).index("by_betterAuthUserId", ["betterAuthUserId"]),

    template: defineTable({
        userId: v.id("profiles"),
        name: v.string(),
        slug: v.string(),
        base_template_id: v.optional(v.id("base_template")),
        words: v.optional(v.array(v.id("word"))), // optional until words are seeded
        card_template: v.optional(
            v.object({
                layout: v.string(), // html
                styles: v.string(), // css
            }),
        ),
        configs: v.object({
            topics: v.array(v.string()),
            sentences_per_word: v.number(),
        }),
        created_at: v.number(),
        updated_at: v.number(),
    }).index("by_user", ["userId"]).index("by_slug", ["slug"]),

    word: defineTable({
        simplified_hanzi: v.string(),
        traditional_hanzi: v.string(),
        pinyin: v.string(),
        normalized_pinyin: v.string(),
        tanslation: v.string(),
        audio_url: v.union(v.string(), v.null()), // temporarily nullable
        created_at: v.number(),
        updated_at: v.number(),
    }),

    sentence: defineTable({
        simplified_hanzi: v.string(),
        traditional_hanzi: v.string(),
        translation: v.string(),
        audio_url: v.union(v.string(), v.null()), // temporarily nullable
        created_at: v.number(),
        updated_at: v.number(),
    }), // not directly related to words

    note: defineTable({
        wordId: v.id("word"),
        sentenceId: v.id("sentence"),
        created_at: v.number(),
        updated_at: v.number(),
    }),

    deck: defineTable({
        userId: v.id("profiles"),
        templateId: v.id("template"),
        noteIds: v.array(v.id("note")),
        created_at: v.number(),
        updated_at: v.number(),
    }),
});
