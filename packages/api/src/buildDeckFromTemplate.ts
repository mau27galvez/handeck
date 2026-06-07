import { db } from "@handeck/db";
import { deckNotes, decks, notes, templateWords, templates, words } from "@handeck/db/schema";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { v4 } from "uuid";

import { writeDeckPackageToVoid } from "./deckPackage";

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function buildDeckFromTemplate({
  templateId,
  userId,
}: {
  templateId: string;
  userId: string;
}) {
  const now = new Date();
  const deckId = v4();

  const result = await db.transaction(async (tx) => {
    const { template, wordRows } = await loadTemplateAndWords(tx, templateId, userId);
    const noteByWordId = await ensureWordNotes(tx, wordRows, now);
    await insertDeck(tx, { deckId, userId, templateId, now });
    await linkDeckNotes(tx, { deckId, wordRows, noteByWordId, now });

    return {
      deckId,
      templateName: template.name,
      words: wordRows.map((row) => row.word),
      wordCount: wordRows.length,
      noteCount: wordRows.length,
    };
  });

  await writeDeckPackageToVoid(result);
  return result;
}

async function loadTemplateAndWords(tx: DbTx, templateId: string, userId: string) {
  const [template] = await tx
    .select()
    .from(templates)
    .where(and(eq(templates.id, templateId), eq(templates.userId, userId)))
    .limit(1);
  if (!template) throw new Error("Template not found");

  const wordRows = await tx
    .select({ word: words })
    .from(templateWords)
    .innerJoin(words, eq(templateWords.wordId, words.id))
    .where(eq(templateWords.templateId, templateId))
    .orderBy(asc(templateWords.createdAt), asc(templateWords.wordId));
  if (wordRows.length === 0) throw new Error("Add words before generating a deck");

  return { template, wordRows };
}

async function ensureWordNotes(
  tx: DbTx,
  wordRows: Awaited<ReturnType<typeof loadTemplateAndWords>>["wordRows"],
  now: Date,
) {
  const wordIds = wordRows.map((row) => row.word.id);
  const existingWordNotes = await tx
    .select({ id: notes.id, wordId: notes.wordId })
    .from(notes)
    .where(and(inArray(notes.wordId, wordIds), isNull(notes.sentenceId)));
  const noteByWordId = new Map(existingWordNotes.map((note) => [note.wordId, note.id] as const));
  const missingWordIds = wordIds.filter((wordId) => !noteByWordId.has(wordId));

  if (missingWordIds.length > 0) {
    const insertedNotes = await tx
      .insert(notes)
      .values(
        missingWordIds.map((wordId) => ({
          id: v4(),
          wordId,
          sentenceId: null,
          createdAt: now,
          updatedAt: now,
        })),
      )
      .returning({ id: notes.id, wordId: notes.wordId });

    for (const note of insertedNotes) {
      noteByWordId.set(note.wordId, note.id);
    }
  }

  return noteByWordId;
}

async function insertDeck(
  tx: DbTx,
  {
    deckId,
    userId,
    templateId,
    now,
  }: {
    deckId: string;
    userId: string;
    templateId: string;
    now: Date;
  },
) {
  await tx.insert(decks).values({
    id: deckId,
    userId,
    templateId,
    createdAt: now,
    updatedAt: now,
  });
}

async function linkDeckNotes(
  tx: DbTx,
  {
    deckId,
    wordRows,
    noteByWordId,
    now,
  }: {
    deckId: string;
    wordRows: Awaited<ReturnType<typeof loadTemplateAndWords>>["wordRows"];
    noteByWordId: Map<string, string>;
    now: Date;
  },
) {
  await tx.insert(deckNotes).values(
    wordRows.map((row, position) => {
      const noteId = noteByWordId.get(row.word.id);
      if (!noteId) throw new Error("Failed to create deck note");

      return {
        deckId,
        noteId,
        position,
        createdAt: now,
        updatedAt: now,
      };
    }),
  );
}
