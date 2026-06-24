import { db } from "@handeck/db";
import {
  deckGenerationJobsTable,
  deckGenerationSentenceBatchesTable,
  deckGenerationWordAudiosTable,
  decksTable,
  notesTable,
  sentenceNotesTable,
  sentencesTable,
  wordsTable,
} from "@handeck/db/schema";
import { env } from "@handeck/env/server";
import { v4 } from "uuid";
import { writeDeckPackageToS3 } from "./deckPackage";
import { OpenRouter } from "@openrouter/sdk";
import z from "zod";
import { getOwnedTemplate, getTemplateWithWords } from "./modules/templates/template-use-cases";
import { pcmToWav } from "./utils";
import { segment, OutputFormat, addDict } from "pinyin-pro";
import CompleteDict from "@pinyin-pro/data/complete";
import { GoogleGenAI } from "@google/genai";
import { getWordAudioObjectKey, uploadAudioFile } from "./deckStorage";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { DECK_GENERATE_REQUESTED_EVENT } from "./inngest/events";
import { inngest } from "./inngest/inngest-client";

/**
 * IMPORTANT
 * This must be called before every call to the pinyin-pro library.
 * If we ever use it outside of this file, we have to add this there too.
 * Or centralize the call to addDict and run it before any call to pinyin-pro.
 */
addDict(CompleteDict);

export async function buildDeckFromTemplate({
  deckId,
  templateId,
  userId,
}: {
  deckId: string;
  templateId: string;
  userId: string;
}) {
  await getOwnedTemplate(templateId, userId);
  await prepareDeckGeneration({ deckId, templateId, userId });

  /**
   * IMPORTANT
   *
   * What if the event fails to send?
   * Or what if after `prepareDeckGeneration`, something goes wrong and
   * `inngest.send` never runs?
   *
   * We end up with a deck that is in a "queued" state, but is in no queue.
   *
   * I guess we have the following options:
   * - Put the sending of the event into the transaction (not so sure)
   * - Make the `prepareDeckGeneration` function idempotent
   * - try catch the `send` call and mark the deck as failed or just rollback the transaction (delete all the rows we inserted)
   */

  await inngest.send({
    id: `deck:${deckId}:generate`,
    name: DECK_GENERATE_REQUESTED_EVENT,
    data: {
      deckId,
      templateId,
      userId,
    },
  });
}

export async function prepareDeckGeneration({
  deckId,
  templateId,
  userId,
}: {
  deckId: string;
  templateId: string;
  userId: string;
}) {
  const now = new Date();

  return db.transaction(async (tx) => {
    const template = await getTemplateWithWords(tx, templateId);

    if (template.templateWords.length === 0) throw new Error("Add words before generating a deck");

    const notesToInsert = template.templateWords.map((word) => ({
      id: v4(),
      deckId,
      wordId: word.wordId,
      createdAt: now,
    }));

    await tx.insert(decksTable).values({
      id: deckId,
      userId,
      templateId,
      status: "queued",
      createdAt: now,
    });

    await tx.insert(notesTable).values(notesToInsert);

    const uniqueWordsWithoutAudio = new Map(
      template.templateWords
        .map((templateWord) => templateWord.word)
        .filter((word) => word.audioUrl == null)
        .map((word) => [word.id, word]),
    );

    const sentenceBatchTotal = Math.ceil(
      template.templateWords.length / SENTENCE_GENERATION_PROMPT_BATCH_SIZE,
    );
    const wordAudioTotal = uniqueWordsWithoutAudio.size;

    await tx.insert(deckGenerationJobsTable).values({
      deckId,
      status: "queued",
      sentenceBatchTotal,
      sentenceBatchCompleted: 0,
      wordAudioTotal,
      wordAudioCompleted: 0,
      createdAt: now,
    });

    const sentenceBatchRows = Array.from({ length: sentenceBatchTotal }, (_, batchIndex) => ({
      deckId,
      batchIndex,
      status: "queued" as const,
      createdAt: now,
    }));

    if (sentenceBatchRows.length > 0) {
      await tx.insert(deckGenerationSentenceBatchesTable).values(sentenceBatchRows);
    }

    const wordAudioRows = Array.from(uniqueWordsWithoutAudio.keys()).map((wordId) => ({
      deckId,
      wordId,
      status: "queued" as const,
      createdAt: now,
    }));

    if (wordAudioRows.length > 0) {
      await tx.insert(deckGenerationWordAudiosTable).values(wordAudioRows);
    }
  });
}

export async function getDeckGenerationTotals(deckId: string) {
  const job = await db.query.deckGenerationJobsTable.findFirst({
    where: eq(deckGenerationJobsTable.deckId, deckId),
  });

  if (!job) throw new Error("Deck generation job not found");

  return {
    sentenceBatchTotal: job.sentenceBatchTotal,
    wordAudioTotal: job.wordAudioTotal,
  };
}

export async function markDeckGenerationStarted(deckId: string) {
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(decksTable)
      .set({
        status: "generating",
        startedAt: now,
        updatedAt: now,
      })
      .where(eq(decksTable.id, deckId));

    await tx
      .update(deckGenerationJobsTable)
      .set({
        status: "generating",
        startedAt: now,
        updatedAt: now,
      })
      .where(eq(deckGenerationJobsTable.deckId, deckId));
  });
}

export async function getDeckGenerationProgress(deckId: string) {
  const job = await db.query.deckGenerationJobsTable.findFirst({
    where: eq(deckGenerationJobsTable.deckId, deckId),
  });

  if (!job) throw new Error("Deck generation job not found");

  const [failedSentenceBatchResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(deckGenerationSentenceBatchesTable)
    .where(
      and(
        eq(deckGenerationSentenceBatchesTable.deckId, deckId),
        eq(deckGenerationSentenceBatchesTable.status, "failed"),
      ),
    );
  const [failedWordAudioResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(deckGenerationWordAudiosTable)
    .where(
      and(
        eq(deckGenerationWordAudiosTable.deckId, deckId),
        eq(deckGenerationWordAudiosTable.status, "failed"),
      ),
    );

  return {
    ...job,
    failedSentenceBatches: failedSentenceBatchResult?.count ?? 0,
    failedWordAudios: failedWordAudioResult?.count ?? 0,
  };
}

export async function getSentenceBatchEvents({
  deckId,
  start,
  limit,
}: {
  deckId: string;
  start: number;
  limit: number;
}) {
  const rows = await db
    .select({
      batchIndex: deckGenerationSentenceBatchesTable.batchIndex,
    })
    .from(deckGenerationSentenceBatchesTable)
    .where(eq(deckGenerationSentenceBatchesTable.deckId, deckId))
    .orderBy(asc(deckGenerationSentenceBatchesTable.batchIndex))
    .limit(limit)
    .offset(start);

  return rows;
}

export async function getWordAudioEvents({
  deckId,
  start,
  limit,
}: {
  deckId: string;
  start: number;
  limit: number;
}) {
  const rows = await db
    .select({
      wordId: deckGenerationWordAudiosTable.wordId,
    })
    .from(deckGenerationWordAudiosTable)
    .where(eq(deckGenerationWordAudiosTable.deckId, deckId))
    .orderBy(asc(deckGenerationWordAudiosTable.wordId))
    .limit(limit)
    .offset(start);

  return rows;
}

export async function generateAndPersistSentenceBatch({
  deckId,
  batchIndex,
}: {
  deckId: string;
  batchIndex: number;
}) {
  /**
   * We check this here and again inside the transaction to avoid race conditions.
   * I am not sure if Inngest will allow this function to run multiple times.
   * That's why I'll leave this check here.
   *
   * If it is the case that we have to protect against race conditions,
   * we can implement a claim system with a database table as a better solution.
   */
  const existingBatch = await db.query.deckGenerationSentenceBatchesTable.findFirst({
    where: and(
      eq(deckGenerationSentenceBatchesTable.deckId, deckId),
      eq(deckGenerationSentenceBatchesTable.batchIndex, batchIndex),
    ),
  });

  if (!existingBatch) throw new Error("Sentence batch not found");
  if (existingBatch.status === "completed") return await getDeckGenerationProgress(deckId);

  // This is not polyphonic aware.
  const batchNotes = await getSentenceBatchNotes({ deckId, batchIndex });
  const promptWords = [...new Set(batchNotes.map((note) => note.simplifiedHanzi))];
  const generatedSentences = await generateSentences(promptWords);
  const now = new Date();

  await db.transaction(async (tx) => {
    const latestBatch = await tx.query.deckGenerationSentenceBatchesTable.findFirst({
      where: and(
        eq(deckGenerationSentenceBatchesTable.deckId, deckId),
        eq(deckGenerationSentenceBatchesTable.batchIndex, batchIndex),
      ),
    });

    if (latestBatch?.status === "completed") return;

    // It fells weird doing all this queries. We could just do bulk, right?
    for (const note of batchNotes) {
      const existingSentenceNote = await tx.query.sentenceNotesTable.findFirst({
        where: eq(sentenceNotesTable.noteId, note.noteId),
      });

      if (existingSentenceNote) continue;

      // What if there are polyphonic characters? Shouldn't we use id?
      const sentence = generatedSentences.get(note.simplifiedHanzi);
      if (!sentence) {
        throw new Error(`No sentence generated for ${note.simplifiedHanzi}`);
      }

      const sentenceId = v4();
      await tx.insert(sentencesTable).values({
        id: sentenceId,
        simplifiedHanzi: sentence,
        diacriticPinyin: segment(sentence, {
          format: OutputFormat.PinyinString,
        }),
        createdAt: now,
        updatedAt: now,
      });

      await tx.insert(sentenceNotesTable).values({
        id: v4(),
        sentenceId,
        noteId: note.noteId,
      });
    }

    const completedRows = await tx
      .update(deckGenerationSentenceBatchesTable)
      .set({
        status: "completed",
        error: null,
        updatedAt: now,
      })
      .where(
        and(
          eq(deckGenerationSentenceBatchesTable.deckId, deckId),
          eq(deckGenerationSentenceBatchesTable.batchIndex, batchIndex),
          // This is redundant since we already checked this above.
          // I'll keep it here for defensive purposes, but it could be removed.
          ne(deckGenerationSentenceBatchesTable.status, "completed"),
        ),
      )
      .returning({ batchIndex: deckGenerationSentenceBatchesTable.batchIndex });

    if (completedRows.length > 0) {
      await tx
        .update(deckGenerationJobsTable)
        .set({
          sentenceBatchCompleted: sql`${deckGenerationJobsTable.sentenceBatchCompleted} + 1`,
          updatedAt: now,
        })
        .where(eq(deckGenerationJobsTable.deckId, deckId));
    }
  });

  return await getDeckGenerationProgress(deckId);
}

// Death code
export async function markSentenceBatchFailed({
  deckId,
  batchIndex,
  error,
}: {
  deckId: string;
  batchIndex: number;
  error: unknown;
}) {
  await db
    .update(deckGenerationSentenceBatchesTable)
    .set({
      status: "failed",
      error: errorMessage(error),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(deckGenerationSentenceBatchesTable.deckId, deckId),
        eq(deckGenerationSentenceBatchesTable.batchIndex, batchIndex),
        ne(deckGenerationSentenceBatchesTable.status, "completed"),
      ),
    );
}

export async function ensureAndPersistWordAudio({
  deckId,
  wordId,
}: {
  deckId: string;
  wordId: string;
}) {
  const existingWordAudio = await db.query.deckGenerationWordAudiosTable.findFirst({
    where: and(
      eq(deckGenerationWordAudiosTable.deckId, deckId),
      eq(deckGenerationWordAudiosTable.wordId, wordId),
    ),
  });

  if (!existingWordAudio) throw new Error("Word audio job not found");
  if (existingWordAudio.status === "completed") return await getDeckGenerationProgress(deckId);

  const word = await db.query.wordsTable.findFirst({
    where: eq(wordsTable.id, wordId),
  });

  if (!word) throw new Error("Word not found");

  // Gemini + S3 run before the DB transaction inside one Inngest step. On retry after a
  // successful upload, the whole step re-runs (extra Gemini cost). If retries or transaction
  // errors become frequent, split generate/upload and persist into separate step.run calls so
  // the expensive work is memoized and only the DB step retries (+1 execution per word on success).
  // We are not expecting this to happen often, so we keep one step for now.
  // It is cheaper on the happy path because Inngest bills by step/execution.
  const objectKey =
    word.audioUrl ?? (await generateAndUploadWordAudio(word.simplifiedHanzi, wordId));
  const now = new Date();

  await db.transaction(async (tx) => {
    if (!word.audioUrl) {
      await tx
        .update(wordsTable)
        .set({
          audioUrl: objectKey,
          updatedAt: now,
        })
        .where(eq(wordsTable.id, wordId));
    }

    const completedRows = await tx
      .update(deckGenerationWordAudiosTable)
      .set({
        status: "completed",
        error: null,
        updatedAt: now,
      })
      .where(
        and(
          eq(deckGenerationWordAudiosTable.deckId, deckId),
          eq(deckGenerationWordAudiosTable.wordId, wordId),
          ne(deckGenerationWordAudiosTable.status, "completed"),
        ),
      )
      .returning({ wordId: deckGenerationWordAudiosTable.wordId });

    if (completedRows.length > 0) {
      await tx
        .update(deckGenerationJobsTable)
        .set({
          wordAudioCompleted: sql`${deckGenerationJobsTable.wordAudioCompleted} + 1`,
          updatedAt: now,
        })
        .where(eq(deckGenerationJobsTable.deckId, deckId));
    }
  });

  return await getDeckGenerationProgress(deckId);
}

// Death code
export async function markWordAudioFailed({
  deckId,
  wordId,
  error,
}: {
  deckId: string;
  wordId: string;
  error: unknown;
}) {
  await db
    .update(deckGenerationWordAudiosTable)
    .set({
      status: "failed",
      error: errorMessage(error),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(deckGenerationWordAudiosTable.deckId, deckId),
        eq(deckGenerationWordAudiosTable.wordId, wordId),
        ne(deckGenerationWordAudiosTable.status, "completed"),
      ),
    );
}

export async function finalizeDeckGeneration(deckId: string) {
  const deck = await db.query.decksTable.findFirst({
    where: eq(decksTable.id, deckId),
    with: {
      template: true,
    },
  });

  if (!deck) throw new Error("Deck not found");

  const notes = await getDeckPackageNotes(deckId);
  await writeDeckPackageToS3({
    deckId,
    userId: deck.userId,
    templateName: deck.template.name,
    notes,
  });

  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(decksTable)
      .set({
        status: "completed",
        completedAt: now,
        error: null,
        updatedAt: now,
      })
      .where(eq(decksTable.id, deckId));

    await tx
      .update(deckGenerationJobsTable)
      .set({
        status: "completed",
        completedAt: now,
        error: null,
        updatedAt: now,
      })
      .where(eq(deckGenerationJobsTable.deckId, deckId));
  });
}

export async function markDeckGenerationFailed(deckId: string, error: unknown) {
  const now = new Date();
  const message = errorMessage(error);

  await db.transaction(async (tx) => {
    await tx
      .update(decksTable)
      .set({
        status: "failed",
        error: message,
        failedAt: now,
        updatedAt: now,
      })
      .where(eq(decksTable.id, deckId));

    await tx
      .update(deckGenerationJobsTable)
      .set({
        status: "failed",
        error: message,
        failedAt: now,
        updatedAt: now,
      })
      .where(eq(deckGenerationJobsTable.deckId, deckId));
  });
}

async function getSentenceBatchNotes({
  deckId,
  batchIndex,
}: {
  deckId: string;
  batchIndex: number;
}) {
  const rows = await db
    .select({
      noteId: notesTable.id,
      simplifiedHanzi: wordsTable.simplifiedHanzi,
    })
    .from(notesTable)
    .innerJoin(wordsTable, eq(notesTable.wordId, wordsTable.id))
    .where(eq(notesTable.deckId, deckId))
    .orderBy(asc(wordsTable.simplifiedHanzi), asc(wordsTable.id))
    .limit(SENTENCE_GENERATION_PROMPT_BATCH_SIZE)
    .offset(batchIndex * SENTENCE_GENERATION_PROMPT_BATCH_SIZE);

  if (rows.length === 0) throw new Error("Sentence batch is empty");
  return rows;
}

async function getDeckPackageNotes(deckId: string) {
  const rows = await db
    .select({
      id: notesTable.id,
      simplifiedHanzi: wordsTable.simplifiedHanzi,
      diacriticPinyin: wordsTable.diacriticPinyin,
      meaning: wordsTable.meaning,
      sentence: sentencesTable.simplifiedHanzi,
    })
    .from(notesTable)
    .innerJoin(wordsTable, eq(notesTable.wordId, wordsTable.id))
    .innerJoin(sentenceNotesTable, eq(sentenceNotesTable.noteId, notesTable.id))
    .innerJoin(sentencesTable, eq(sentenceNotesTable.sentenceId, sentencesTable.id))
    .where(eq(notesTable.deckId, deckId))
    .orderBy(asc(wordsTable.simplifiedHanzi), asc(wordsTable.id));

  const [noteCountResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notesTable)
    .where(eq(notesTable.deckId, deckId));
  const noteCount = noteCountResult?.count ?? 0;

  if (rows.length !== noteCount) {
    throw new Error("Deck has incomplete sentence generation");
  }

  return rows;
}

async function generateAndUploadWordAudio(wordHanzi: string, wordId: string) {
  const client = new GoogleGenAI({
    apiKey: env.GEMINI_API_KEY,
  });

  const interaction = await client.interactions.create({
    model: "gemini-3.1-flash-tts-preview",
    input: `
    ## Sample Context:
    Add some space at the beggining and at the end. So the pronunciation can be clearly be ear from start to finish.

    As in xing1

    ## Transcript:
    ${wordHanzi}
    `,
    response_format: { type: "audio" },
    generation_config: {
      speech_config: [{ voice: "Kore" }],
    },
  });

  const audioData = interaction.output_audio?.data;
  if (!audioData) {
    throw new Error("No audio data from Gemini");
  }

  const objectKey = getWordAudioObjectKey(wordId);
  await uploadAudioFile(objectKey, pcmToWav(Buffer.from(audioData, "base64")));

  return objectKey;
}

// Cringe function
function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown deck generation error";
}

const SENTENCE_GENERATION_PROMPT_BATCH_SIZE = 10;
const OPENROUTER_MODEL = "deepseek/deepseek-v4-flash";
const generationResponseSchema = z.object({
  words: z.array(
    z.object({
      word: z.string(),
      sentence: z.string(),
    }),
  ),
});

const client = new OpenRouter({
  apiKey: env.OPENROUTER_API_KEY,
});

async function generateSentences(words: string[]) {
  const response = await client.chat.send({
    chatRequest: {
      model: OPENROUTER_MODEL,
      responseFormat: {
        type: "json_schema",
        jsonSchema: {
          name: "chinese_sentence_batch",
          strict: true,
          schema: generationResponseSchema.toJSONSchema(),
        },
      },
      messages: [
        {
          role: "system",
          content: `
                You generate natural Mandarin Chinese sentences for foreign students learning Chinese. Prefer standard, clear, and slightly formal Chinese over slang, dialect, or overly casual phrasing. Avoid generic textbook sentences and very common facts unless they are the most natural choice. Vary sentence structure, setting, verb choice, and perspective across generations. Every generated Chinese sentence must contain the provided word exactly. Return only JSON matching the provided schema.
                `,
        },
        { role: "user", content: JSON.stringify(words) },
      ],
    },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("No response from OpenRouter");

  const parsed = generationResponseSchema.parse(JSON.parse(content));
  const cleanResponse = new Map(parsed.words.map((word) => [word.word, word.sentence]));

  return cleanResponse;
}
