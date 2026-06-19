import { relations } from "drizzle-orm";
import { index, pgTable, primaryKey, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { user } from "./auth";

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull(),
  updatedAt: timestamp({ withTimezone: true }),
};

export const baseTemplatesTable = pgTable("base_templates", {
  id: uuid().primaryKey(),
  name: text().notNull(),
});

export const templatesTable = pgTable(
  "templates",
  {
    id: uuid().primaryKey(),
    userId: uuid()
      .notNull()
      .references(() => user.id),
    name: text().notNull(),
    baseTemplateId: uuid().references(() => baseTemplatesTable.id),
    ...timestamps,
  },
  (table) => [index("templates_user_id_idx").on(table.userId)],
);

export const wordsTable = pgTable(
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

export const templateWordsTable = pgTable(
  "template_words",
  {
    templateId: uuid()
      .notNull()
      .references(() => templatesTable.id),
    wordId: uuid()
      .notNull()
      .references(() => wordsTable.id),
    ...timestamps,
  },
  (table) => [
    primaryKey({ columns: [table.templateId, table.wordId] }),
    index("template_words_word_id_idx").on(table.wordId),
  ],
);

export const notesTable = pgTable(
  "notes",
  {
    id: uuid().primaryKey(),
    deckId: uuid()
      .notNull()
      .references(() => decksTable.id),
    wordId: uuid()
      .notNull()
      .references(() => wordsTable.id),
    ...timestamps,
  },
  (table) => [
    index("notes_deck_id_idx").on(table.deckId),
    index("notes_word_id_idx").on(table.wordId),
    unique("notes_unique_deck_word_idx").on(table.deckId, table.wordId),
  ],
);

export const sentencesTable = pgTable("sentences", {
  id: uuid().primaryKey(),
  simplifiedHanzi: text().notNull(),
  ...timestamps,
});

export const sentenceNotesTable = pgTable("sentence_notes", {
  id: uuid().primaryKey(),
  sentenceId: uuid()
    .notNull()
    .references(() => sentencesTable.id),
  noteId: uuid()
    .notNull()
    .references(() => notesTable.id),
});

export const decksTable = pgTable(
  "decks",
  {
    id: uuid().primaryKey(),
    userId: uuid()
      .notNull()
      .references(() => user.id),
    templateId: uuid()
      .notNull()
      .references(() => templatesTable.id),
    ...timestamps,
  },
  (table) => [
    index("decks_user_id_idx").on(table.userId),
    index("decks_template_id_idx").on(table.templateId),
  ],
);

export const baseTemplateRelations = relations(baseTemplatesTable, ({ many }) => ({
  templates: many(templatesTable),
}));

export const templateRelations = relations(templatesTable, ({ one, many }) => ({
  user: one(user, {
    fields: [templatesTable.userId],
    references: [user.id],
  }),
  baseTemplate: one(baseTemplatesTable, {
    fields: [templatesTable.baseTemplateId],
    references: [baseTemplatesTable.id],
  }),
  templateWords: many(templateWordsTable),
  decks: many(decksTable),
}));

export const wordRelations = relations(wordsTable, ({ many }) => ({
  templateWords: many(templateWordsTable),
  notes: many(notesTable),
}));

export const templateWordRelations = relations(templateWordsTable, ({ one }) => ({
  template: one(templatesTable, {
    fields: [templateWordsTable.templateId],
    references: [templatesTable.id],
  }),
  word: one(wordsTable, {
    fields: [templateWordsTable.wordId],
    references: [wordsTable.id],
  }),
}));

export const noteRelations = relations(notesTable, ({ one }) => ({
  deck: one(decksTable, {
    fields: [notesTable.deckId],
    references: [decksTable.id],
  }),
  word: one(wordsTable, {
    fields: [notesTable.wordId],
    references: [wordsTable.id],
  }),
}));

export const deckRelations = relations(decksTable, ({ one, many }) => ({
  user: one(user, {
    fields: [decksTable.userId],
    references: [user.id],
  }),
  template: one(templatesTable, {
    fields: [decksTable.templateId],
    references: [templatesTable.id],
  }),
  notes: many(notesTable),
}));
