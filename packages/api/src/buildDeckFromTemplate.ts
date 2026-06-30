import { db } from "@handeck/db";
import {
  deckGenerationJobsTable,
  deckGenerationSentenceAudiosTable,
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
import { getSentenceAudioObjectKey, getWordAudioObjectKey, uploadAudioFile } from "./deckStorage";
import { and, asc, eq, gte, lt, ne, sql } from "drizzle-orm";
import { DECK_GENERATE_REQUESTED_EVENT } from "./inngest/events";
import { inngest } from "./inngest/inngest-client";
import { debitKuais } from "./modules/billing/billing-use-cases";

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
  userEmail,
  userName,
}: {
  deckId: string;
  templateId: string;
  userId: string;
  userEmail: string;
  userName: string;
}) {
  await getOwnedTemplate(templateId, userId);
  const cost = await calculateDeckGenerationCost(templateId);
  await debitKuais({
    amount: cost.total,
    idempotencyKey: `deck:${deckId}:generation`,
    reason: `Deck generation (${cost.wordAudioCount} word audios, ${cost.sentenceCount} sentences, ${cost.sentenceAudioCount} sentence audios)`,
    userEmail,
    userName,
  });
  await prepareDeckGeneration({ deckId, templateId, userId });

  try {
    await inngest.send({
      id: `deck:${deckId}:generate`,
      name: DECK_GENERATE_REQUESTED_EVENT,
      data: {
        deckId,
        templateId,
        userId,
      },
    });
  } catch (error) {
    await abortDeckGeneration(deckId);
    throw error;
  }
}

export async function calculateDeckGenerationCost(templateId: string) {
  const template = await db.transaction((tx) => getTemplateWithWords(tx, templateId));
  if (template.templateWords.length === 0) throw new Error("Add words before generating a deck");

  const uniqueWordsWithoutAudio = new Map(
    template.templateWords
      .map((templateWord) => templateWord.word)
      .filter((word) => word.audioUrl == null)
      .map((word) => [word.id, word]),
  );
  const sentenceCount = template.templateWords.length;
  const sentenceAudioCount = sentenceCount;
  const wordAudioCount = uniqueWordsWithoutAudio.size;

  return {
    sentenceCount,
    sentenceAudioCount,
    wordAudioCount,
    total: sentenceCount + sentenceAudioCount + wordAudioCount,
  };
}

async function abortDeckGeneration(deckId: string) {
  await db.transaction(async (tx) => {
    await tx
      .delete(deckGenerationSentenceBatchesTable)
      .where(eq(deckGenerationSentenceBatchesTable.deckId, deckId));
    await tx
      .delete(deckGenerationSentenceAudiosTable)
      .where(eq(deckGenerationSentenceAudiosTable.deckId, deckId));
    await tx
      .delete(deckGenerationWordAudiosTable)
      .where(eq(deckGenerationWordAudiosTable.deckId, deckId));
    await tx.delete(deckGenerationJobsTable).where(eq(deckGenerationJobsTable.deckId, deckId));
    await tx.delete(notesTable).where(eq(notesTable.deckId, deckId));
    await tx.delete(decksTable).where(eq(decksTable.id, deckId));
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
    sentenceAudioTotal: job.sentenceAudioTotal,
    wordAudioTotal: job.wordAudioTotal,
  };
}

export async function getDeckStatus(deckId: string) {
  const deck = await db.query.decksTable.findFirst({
    where: eq(decksTable.id, deckId),
    columns: { status: true },
  });

  if (!deck) throw new Error("Deck not found");

  return deck.status;
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
  const [failedSentenceAudioResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(deckGenerationSentenceAudiosTable)
    .where(
      and(
        eq(deckGenerationSentenceAudiosTable.deckId, deckId),
        eq(deckGenerationSentenceAudiosTable.status, "failed"),
      ),
    );

  return {
    ...job,
    failedSentenceBatches: failedSentenceBatchResult?.count ?? 0,
    failedSentenceAudios: failedSentenceAudioResult?.count ?? 0,
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

export async function getSentenceAudioEvents({
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
      sentenceId: deckGenerationSentenceAudiosTable.sentenceId,
    })
    .from(deckGenerationSentenceAudiosTable)
    .where(eq(deckGenerationSentenceAudiosTable.deckId, deckId))
    .orderBy(asc(deckGenerationSentenceAudiosTable.sentenceId))
    .limit(limit)
    .offset(start);

  return rows;
}

export async function getSentenceWindowSettlement(
  deckId: string,
  windowStart: number,
  windowEnd: number,
) {
  const [result] = await db
    .select({
      total: sql<number>`count(*)::int`,
      completedCount: sql<number>`count(*) filter (where ${deckGenerationSentenceBatchesTable.status} = 'completed')::int`,
      failedCount: sql<number>`count(*) filter (where ${deckGenerationSentenceBatchesTable.status} = 'failed')::int`,
    })
    .from(deckGenerationSentenceBatchesTable)
    .where(
      and(
        eq(deckGenerationSentenceBatchesTable.deckId, deckId),
        gte(deckGenerationSentenceBatchesTable.batchIndex, windowStart),
        lt(deckGenerationSentenceBatchesTable.batchIndex, windowEnd),
      ),
    );

  return windowSettlement(result);
}

export async function getSentenceAudioWindowSettlement(
  deckId: string,
  windowStart: number,
  windowEnd: number,
) {
  const windowSentenceAudios = db
    .select({
      status: deckGenerationSentenceAudiosTable.status,
    })
    .from(deckGenerationSentenceAudiosTable)
    .where(eq(deckGenerationSentenceAudiosTable.deckId, deckId))
    .orderBy(asc(deckGenerationSentenceAudiosTable.sentenceId))
    .limit(windowEnd - windowStart)
    .offset(windowStart)
    .as("window_sentence_audios");

  const [result] = await db
    .select({
      total: sql<number>`count(*)::int`,
      completedCount: sql<number>`count(*) filter (where ${windowSentenceAudios.status} = 'completed')::int`,
      failedCount: sql<number>`count(*) filter (where ${windowSentenceAudios.status} = 'failed')::int`,
    })
    .from(windowSentenceAudios);

  return windowSettlement(result);
}

export async function getWordAudioWindowSettlement(
  deckId: string,
  windowStart: number,
  windowEnd: number,
) {
  const windowWordAudios = db
    .select({
      status: deckGenerationWordAudiosTable.status,
    })
    .from(deckGenerationWordAudiosTable)
    .where(eq(deckGenerationWordAudiosTable.deckId, deckId))
    .orderBy(asc(deckGenerationWordAudiosTable.wordId))
    .limit(windowEnd - windowStart)
    .offset(windowStart)
    .as("window_word_audios");

  const [result] = await db
    .select({
      total: sql<number>`count(*)::int`,
      completedCount: sql<number>`count(*) filter (where ${windowWordAudios.status} = 'completed')::int`,
      failedCount: sql<number>`count(*) filter (where ${windowWordAudios.status} = 'failed')::int`,
    })
    .from(windowWordAudios);

  return windowSettlement(result);
}

export async function getNextDeckGenerationAction(deckId: string) {
  const status = await getDeckStatus(deckId);
  if (status === "completed" || status === "failed") {
    return { type: "noop" as const };
  }

  const progress = await getDeckGenerationProgress(deckId);
  if (
    progress.failedSentenceBatches > 0 ||
    progress.failedSentenceAudios > 0 ||
    progress.failedWordAudios > 0
  ) {
    return { type: "fail" as const };
  }

  if (progress.sentenceBatchCompleted < progress.sentenceBatchTotal) {
    const windowStart =
      Math.floor(progress.sentenceBatchCompleted / env.DECK_SENTENCE_BATCH_WINDOW_SIZE) *
      env.DECK_SENTENCE_BATCH_WINDOW_SIZE;
    const windowEnd = Math.min(
      windowStart + env.DECK_SENTENCE_BATCH_WINDOW_SIZE,
      progress.sentenceBatchTotal,
    );
    const settlement = await getSentenceWindowSettlement(deckId, windowStart, windowEnd);

    if (settlement.failed) return { type: "fail" as const };
    if (settlement.completedCount > 0 && !settlement.settled) {
      return { type: "wait" as const };
    }

    return {
      type: "dispatch-sentence-window" as const,
      windowStart,
      windowEnd,
    };
  }

  if (progress.sentenceAudioCompleted < progress.sentenceAudioTotal) {
    const windowStart =
      Math.floor(progress.sentenceAudioCompleted / env.DECK_SENTENCE_AUDIO_WINDOW_SIZE) *
      env.DECK_SENTENCE_AUDIO_WINDOW_SIZE;
    const windowEnd = Math.min(
      windowStart + env.DECK_SENTENCE_AUDIO_WINDOW_SIZE,
      progress.sentenceAudioTotal,
    );
    const settlement = await getSentenceAudioWindowSettlement(deckId, windowStart, windowEnd);

    if (settlement.failed) return { type: "fail" as const };
    if (settlement.completedCount > 0 && !settlement.settled) {
      return { type: "wait" as const };
    }

    return {
      type: "dispatch-sentence-audio-window" as const,
      windowStart,
      windowEnd,
    };
  }

  if (progress.wordAudioCompleted < progress.wordAudioTotal) {
    const windowStart =
      Math.floor(progress.wordAudioCompleted / env.DECK_WORD_AUDIO_WINDOW_SIZE) *
      env.DECK_WORD_AUDIO_WINDOW_SIZE;
    const windowEnd = Math.min(
      windowStart + env.DECK_WORD_AUDIO_WINDOW_SIZE,
      progress.wordAudioTotal,
    );
    const settlement = await getWordAudioWindowSettlement(deckId, windowStart, windowEnd);

    if (settlement.failed) return { type: "fail" as const };
    if (settlement.completedCount > 0 && !settlement.settled) {
      return { type: "wait" as const };
    }

    return {
      type: "dispatch-word-audio-window" as const,
      windowStart,
      windowEnd,
    };
  }

  return { type: "finalize" as const };
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
    let createdSentenceAudioJobs = 0;
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
      await tx.insert(deckGenerationSentenceAudiosTable).values({
        deckId,
        sentenceId,
        status: "queued",
        createdAt: now,
      });
      createdSentenceAudioJobs += 1;
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
          sentenceAudioTotal: sql`${deckGenerationJobsTable.sentenceAudioTotal} + ${createdSentenceAudioJobs}`,
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

export async function ensureAndPersistSentenceAudio({
  deckId,
  sentenceId,
}: {
  deckId: string;
  sentenceId: string;
}) {
  const existingSentenceAudio = await db.query.deckGenerationSentenceAudiosTable.findFirst({
    where: and(
      eq(deckGenerationSentenceAudiosTable.deckId, deckId),
      eq(deckGenerationSentenceAudiosTable.sentenceId, sentenceId),
    ),
  });

  if (!existingSentenceAudio) throw new Error("Sentence audio job not found");
  if (existingSentenceAudio.status === "completed") return await getDeckGenerationProgress(deckId);

  const sentence = await db.query.sentencesTable.findFirst({
    where: eq(sentencesTable.id, sentenceId),
  });

  if (!sentence) throw new Error("Sentence not found");

  const objectKey =
    sentence.audioUrl ??
    (await generateAndUploadSentenceAudio(sentence.simplifiedHanzi, sentenceId));
  const now = new Date();

  await db.transaction(async (tx) => {
    if (!sentence.audioUrl) {
      await tx
        .update(sentencesTable)
        .set({
          audioUrl: objectKey,
          updatedAt: now,
        })
        .where(eq(sentencesTable.id, sentenceId));
    }

    const completedRows = await tx
      .update(deckGenerationSentenceAudiosTable)
      .set({
        status: "completed",
        error: null,
        updatedAt: now,
      })
      .where(
        and(
          eq(deckGenerationSentenceAudiosTable.deckId, deckId),
          eq(deckGenerationSentenceAudiosTable.sentenceId, sentenceId),
          ne(deckGenerationSentenceAudiosTable.status, "completed"),
        ),
      )
      .returning({ sentenceId: deckGenerationSentenceAudiosTable.sentenceId });

    if (completedRows.length > 0) {
      await tx
        .update(deckGenerationJobsTable)
        .set({
          sentenceAudioCompleted: sql`${deckGenerationJobsTable.sentenceAudioCompleted} + 1`,
          updatedAt: now,
        })
        .where(eq(deckGenerationJobsTable.deckId, deckId));
    }
  });

  return await getDeckGenerationProgress(deckId);
}

// Death code
export async function markSentenceAudioFailed({
  deckId,
  sentenceId,
  error,
}: {
  deckId: string;
  sentenceId: string;
  error: unknown;
}) {
  await db
    .update(deckGenerationSentenceAudiosTable)
    .set({
      status: "failed",
      error: errorMessage(error),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(deckGenerationSentenceAudiosTable.deckId, deckId),
        eq(deckGenerationSentenceAudiosTable.sentenceId, sentenceId),
        ne(deckGenerationSentenceAudiosTable.status, "completed"),
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

  /**
   * Gemini + S3 run before the DB transaction inside one Inngest step.
   * On retry after a successful upload, the whole step re-runs (extra Gemini cost).
   *
   * If retries or transaction errors become frequent, split generate/upload and persist into separate step.run calls
   * so the expensive work is memoized and only the DB step retries (+1 execution per word on success).
   *
   * We are not expecting this to happen often, so we keep one step for now.
   * It is cheaper on the happy path because Inngest bills by step/execution.
   */
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
      .where(and(eq(decksTable.id, deckId), ne(decksTable.status, "completed")));

    await tx
      .update(deckGenerationJobsTable)
      .set({
        status: "failed",
        error: message,
        failedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(deckGenerationJobsTable.deckId, deckId),
          ne(deckGenerationJobsTable.status, "completed"),
        ),
      );
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
      sentenceAudioUrl: sentencesTable.audioUrl,
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
  if (rows.some((row) => row.sentenceAudioUrl == null)) {
    throw new Error("Deck has incomplete sentence audio generation");
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

async function generateAndUploadSentenceAudio(sentenceHanzi: string, sentenceId: string) {
  const client = new GoogleGenAI({
    apiKey: env.GEMINI_API_KEY,
  });

  const interaction = await client.interactions.create({
    model: "gemini-3.1-flash-tts-preview",
    input: `
    ## Sample Context:
    Add a short pause at the beginning and end so the sentence pronunciation is clear.
    Read the full Mandarin sentence naturally and evenly for a language learner.

    ## Transcript:
    ${sentenceHanzi}
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

  const objectKey = getSentenceAudioObjectKey(sentenceId);
  await uploadAudioFile(objectKey, pcmToWav(Buffer.from(audioData, "base64")));

  return objectKey;
}

// Cringe function
function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown deck generation error";
}

function windowSettlement(
  result:
    | {
        completedCount: number;
        failedCount: number;
        total: number;
      }
    | undefined,
) {
  const completedCount = result?.completedCount ?? 0;
  const failedCount = result?.failedCount ?? 0;
  const total = result?.total ?? 0;
  const failed = failedCount > 0;

  return {
    completedCount,
    failedCount,
    total,
    failed,
    settled: total === 0 || failed || completedCount === total,
  };
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
