import { relations } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull(),
  updatedAt: timestamp({ withTimezone: true }),
};

export const deckGenerationStatuses = ["queued", "generating", "completed", "failed"] as const;

export const deckGenerationItemStatuses = ["queued", "completed", "failed"] as const;

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
  diacriticPinyin: text().notNull(),
  audioUrl: text(),
  ...timestamps,
});

/**
 * This whole table is still in "trial" state.
 * If all of the following are true, it should be removed:
 *
 * 1) We don't allow multiple sentences per note.
 * That might be the case if we can not randomly display one of n sentences per note review in Anki.
 *
 * 2) We won't reuse sentences for multiple notes. For the same deck or others.
 */
export const sentenceNotesTable = pgTable(
  "sentence_notes",
  {
    id: uuid().primaryKey(),
    sentenceId: uuid()
      .notNull()
      .references(() => sentencesTable.id),
    noteId: uuid()
      .notNull()
      .references(() => notesTable.id),
  },
  (table) => [
    index("sentence_notes_sentence_id_idx").on(table.sentenceId),
    // This is true, since this is a one-to-one relationship.
    // But it's not true if we allow multiple sentences per note.
    // So this will: 1) likely be removed and 2) not required since there is no code path that could add a duplicate.
    unique("sentence_notes_unique_note_id_idx").on(table.noteId),
  ],
);

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
    status: text({ enum: deckGenerationStatuses }).notNull().default("queued"),
    error: text(),
    startedAt: timestamp({ withTimezone: true }),
    completedAt: timestamp({ withTimezone: true }),
    failedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("decks_user_id_idx").on(table.userId),
    index("decks_template_id_idx").on(table.templateId),
  ],
);

export const deckGenerationJobsTable = pgTable("deck_generation_jobs", {
  deckId: uuid()
    .primaryKey()
    .references(() => decksTable.id),
  status: text({ enum: deckGenerationStatuses }).notNull().default("queued"),
  sentenceBatchTotal: integer().notNull().default(0),
  sentenceBatchCompleted: integer().notNull().default(0),
  sentenceAudioTotal: integer().notNull().default(0),
  sentenceAudioCompleted: integer().notNull().default(0),
  wordAudioTotal: integer().notNull().default(0),
  wordAudioCompleted: integer().notNull().default(0),
  error: text(),
  startedAt: timestamp({ withTimezone: true }),
  completedAt: timestamp({ withTimezone: true }),
  failedAt: timestamp({ withTimezone: true }),
  ...timestamps,
});

export const deckGenerationSentenceBatchesTable = pgTable(
  "deck_generation_sentence_batches",
  {
    deckId: uuid()
      .notNull()
      .references(() => decksTable.id),
    batchIndex: integer().notNull(),
    status: text({ enum: deckGenerationItemStatuses }).notNull().default("queued"),
    error: text(),
    createdAt: timestamp({ withTimezone: true }).notNull(),
    updatedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.deckId, table.batchIndex] }),
    index("deck_generation_sentence_batches_status_idx").on(table.status),
  ],
);

export const deckGenerationSentenceAudiosTable = pgTable(
  "deck_generation_sentence_audios",
  {
    deckId: uuid()
      .notNull()
      .references(() => decksTable.id),
    sentenceId: uuid()
      .notNull()
      .references(() => sentencesTable.id),
    status: text({ enum: deckGenerationItemStatuses }).notNull().default("queued"),
    error: text(),
    createdAt: timestamp({ withTimezone: true }).notNull(),
    updatedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.deckId, table.sentenceId] }),
    index("deck_generation_sentence_audios_status_idx").on(table.status),
  ],
);

export const deckGenerationWordAudiosTable = pgTable(
  "deck_generation_word_audios",
  {
    deckId: uuid()
      .notNull()
      .references(() => decksTable.id),
    wordId: uuid()
      .notNull()
      .references(() => wordsTable.id),
    status: text({ enum: deckGenerationItemStatuses }).notNull().default("queued"),
    error: text(),
    createdAt: timestamp({ withTimezone: true }).notNull(),
    updatedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.deckId, table.wordId] }),
    index("deck_generation_word_audios_status_idx").on(table.status),
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
  sentenceNote: one(sentenceNotesTable, {
    fields: [notesTable.id],
    references: [sentenceNotesTable.noteId],
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
  generationJob: one(deckGenerationJobsTable, {
    fields: [decksTable.id],
    references: [deckGenerationJobsTable.deckId],
  }),
  notes: many(notesTable),
}));

export const sentenceRelations = relations(sentencesTable, ({ many }) => ({
  sentenceNotes: many(sentenceNotesTable),
}));

export const sentenceNoteRelations = relations(sentenceNotesTable, ({ one }) => ({
  sentence: one(sentencesTable, {
    fields: [sentenceNotesTable.sentenceId],
    references: [sentencesTable.id],
  }),
  note: one(notesTable, {
    fields: [sentenceNotesTable.noteId],
    references: [notesTable.id],
  }),
}));

export const deckGenerationJobRelations = relations(deckGenerationJobsTable, ({ one }) => ({
  deck: one(decksTable, {
    fields: [deckGenerationJobsTable.deckId],
    references: [decksTable.id],
  }),
}));
