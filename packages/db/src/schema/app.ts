import { relations } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull(),
  updatedAt: timestamp({ withTimezone: true }),
};

export const baseTemplates = pgTable("base_templates", {
  id: uuid().primaryKey(),
  name: text().notNull(),
});

export const templates = pgTable(
  "templates",
  {
    id: uuid().primaryKey(),
    userId: uuid()
      .notNull()
      .references(() => user.id),
    name: text().notNull(),
    baseTemplateId: uuid().references(() => baseTemplates.id),
    ...timestamps,
  },
  (table) => [index("templates_user_id_idx").on(table.userId)],
);

export const words = pgTable(
  "words",
  {
    id: uuid().primaryKey(),
    simplifiedHanzi: text().notNull(),
    numberedPinyin: text().notNull(),
    diacriticPinyin: text().notNull(),
    normalizedPinyin: text().notNull(),
    numberedPinyinSearch: text().notNull(),
    pinyinSyllables: text().array().notNull(),
    numberedPinyinSyllables: text().array().notNull(),
    meaning: text().notNull(),
    audioUrl: text(),
    ...timestamps,
  },
  (table) => [
    index("words_normalized_pinyin_idx").on(table.normalizedPinyin),
    index("words_numbered_pinyin_search_idx").on(table.numberedPinyinSearch),
    index("words_simplified_hanzi_idx").on(table.simplifiedHanzi),
    index("words_simplified_hanzi_normalized_pinyin_idx").on(
      table.simplifiedHanzi,
      table.normalizedPinyin,
    ),
  ],
);

export const templateWords = pgTable(
  "template_words",
  {
    templateId: uuid()
      .notNull()
      .references(() => templates.id),
    wordId: uuid()
      .notNull()
      .references(() => words.id),
    ...timestamps,
  },
  (table) => [
    primaryKey({ columns: [table.templateId, table.wordId] }),
    index("template_words_word_id_idx").on(table.wordId),
  ],
);

export const sentences = pgTable("sentences", {
  id: uuid().primaryKey(),
  simplifiedHanzi: text().notNull(),
  translation: text().notNull(),
  audioUrl: text(),
  ...timestamps,
});

export const notes = pgTable(
  "notes",
  {
    id: uuid().primaryKey(),
    wordId: uuid()
      .notNull()
      .references(() => words.id),
    sentenceId: uuid()
      .notNull()
      .references(() => sentences.id),
    ...timestamps,
  },
  (table) => [
    index("notes_word_id_idx").on(table.wordId),
    index("notes_sentence_id_idx").on(table.sentenceId),
    uniqueIndex("notes_word_id_sentence_id_idx").on(table.wordId, table.sentenceId),
  ],
);

export const decks = pgTable(
  "decks",
  {
    id: uuid().primaryKey(),
    userId: uuid()
      .notNull()
      .references(() => user.id),
    templateId: uuid()
      .notNull()
      .references(() => templates.id),
    ...timestamps,
  },
  (table) => [
    index("decks_user_id_idx").on(table.userId),
    index("decks_template_id_idx").on(table.templateId),
  ],
);

export const deckNotes = pgTable(
  "deck_notes",
  {
    deckId: uuid()
      .notNull()
      .references(() => decks.id),
    noteId: uuid()
      .notNull()
      .references(() => notes.id),
    position: integer().notNull(),
    ...timestamps,
  },
  (table) => [
    primaryKey({ columns: [table.deckId, table.noteId] }),
    index("deck_notes_note_id_idx").on(table.noteId),
  ],
);

export const baseTemplateRelations = relations(baseTemplates, ({ many }) => ({
  templates: many(templates),
}));

export const templateRelations = relations(templates, ({ one, many }) => ({
  user: one(user, {
    fields: [templates.userId],
    references: [user.id],
  }),
  baseTemplate: one(baseTemplates, {
    fields: [templates.baseTemplateId],
    references: [baseTemplates.id],
  }),
  templateWords: many(templateWords),
  decks: many(decks),
}));

export const wordRelations = relations(words, ({ many }) => ({
  templateWords: many(templateWords),
  notes: many(notes),
}));

export const templateWordRelations = relations(templateWords, ({ one }) => ({
  template: one(templates, {
    fields: [templateWords.templateId],
    references: [templates.id],
  }),
  word: one(words, {
    fields: [templateWords.wordId],
    references: [words.id],
  }),
}));

export const sentenceRelations = relations(sentences, ({ many }) => ({
  notes: many(notes),
}));

export const noteRelations = relations(notes, ({ one, many }) => ({
  word: one(words, {
    fields: [notes.wordId],
    references: [words.id],
  }),
  sentence: one(sentences, {
    fields: [notes.sentenceId],
    references: [sentences.id],
  }),
  deckNotes: many(deckNotes),
}));

export const deckRelations = relations(decks, ({ one, many }) => ({
  user: one(user, {
    fields: [decks.userId],
    references: [user.id],
  }),
  template: one(templates, {
    fields: [decks.templateId],
    references: [templates.id],
  }),
  deckNotes: many(deckNotes),
}));

export const deckNoteRelations = relations(deckNotes, ({ one }) => ({
  deck: one(decks, {
    fields: [deckNotes.deckId],
    references: [decks.id],
  }),
  note: one(notes, {
    fields: [deckNotes.noteId],
    references: [notes.id],
  }),
}));
