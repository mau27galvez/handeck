import { env } from "@handeck/env/server";
import { z } from "zod";
import {
  ensureAndPersistWordAudio,
  finalizeDeckGeneration,
  generateAndPersistSentenceBatch,
  getDeckGenerationProgress,
  getDeckGenerationTotals,
  getSentenceBatchEvents,
  getWordAudioEvents,
  markDeckGenerationFailed,
  markDeckGenerationStarted,
} from "../buildDeckFromTemplate";
import {
  DECK_GENERATE_REQUESTED_EVENT,
  DECK_SENTENCE_BATCH_GENERATE_EVENT,
  DECK_SENTENCE_BATCHES_COMPLETED_EVENT,
  DECK_WORD_AUDIO_COMPLETED_EVENT,
  DECK_WORD_AUDIO_ENSURE_EVENT,
} from "./events";
import { inngest } from "./inngest-client";

const WINDOW_POLL_INTERVAL = "1m";
const MAX_WINDOW_POLLS = 180;
const generateDeckEventSchema = z.object({
  deckId: z.string(),
  templateId: z.string(),
  userId: z.string(),
});
const sentenceBatchEventSchema = z.object({
  deckId: z.string(),
  batchIndex: z.number(),
});
const wordAudioEventSchema = z.object({
  deckId: z.string(),
  wordId: z.string(),
});

export const generateDeck = inngest.createFunction(
  {
    id: "generate-deck",
    retries: 3,
    triggers: [{ event: DECK_GENERATE_REQUESTED_EVENT }],
  },
  async ({ event, step }) => {
    const { deckId } = generateDeckEventSchema.parse(event.data);

    async function waitForWindowCompletion({
      label,
      targetCompleted,
      completedField,
      failedField,
    }: {
      label: string;
      targetCompleted: number;
      completedField: "sentenceBatchCompleted" | "wordAudioCompleted";
      failedField: "failedSentenceBatches" | "failedWordAudios";
    }) {
      for (let poll = 0; poll < MAX_WINDOW_POLLS; poll++) {
        const progress = await step.run(`${label}-poll-${poll}`, () =>
          getDeckGenerationProgress(deckId),
        );

        if (progress[failedField] > 0) {
          throw new Error(`Deck generation failed during ${label}`);
        }

        if (progress[completedField] >= targetCompleted) {
          return;
        }

        await step.sleep(`${label}-sleep-${poll}`, WINDOW_POLL_INTERVAL);
      }

      throw new Error(`Timed out waiting for ${label}`);
    }

    try {
      await step.run("mark-deck-generation-started", () => markDeckGenerationStarted(deckId));

      const totals = await step.run("load-deck-generation-totals", () =>
        getDeckGenerationTotals(deckId),
      );

      /**
       * Here we capping the generations that I deck can enqueue at a time.
       * We do this to avoid one large deck from delaying smaller decks.
       * All of them have small windows, so they can't hog the queue.
       * Similar to a OS scheduler.
       *
       * This is not perfect round-robin fairness.
       * If Deck A starts much earlier, it still gets the first window.
       * But windowing caps how much queue space one deck can occupy at a time.
       *
       * Smaller windows mean more fairness, but more orchestration overhead.
       * Larger windows mean faster single-deck throughput, but more chance one large deck delays smaller decks.
       */
      for (
        let start = 0;
        start < totals.sentenceBatchTotal;
        start += env.DECK_SENTENCE_BATCH_WINDOW_SIZE
      ) {
        const end = Math.min(
          start + env.DECK_SENTENCE_BATCH_WINDOW_SIZE,
          totals.sentenceBatchTotal,
        );
        const batches = await step.run(`load-sentence-window-${start}-${end}`, () =>
          getSentenceBatchEvents({
            deckId,
            start,
            limit: end - start,
          }),
        );

        await step.sendEvent(
          `send-sentence-window-${start}-${end}`,
          batches.map((batch) => ({
            id: `deck:${deckId}:sentence-batch:${batch.batchIndex}`,
            name: DECK_SENTENCE_BATCH_GENERATE_EVENT,
            data: {
              deckId,
              batchIndex: batch.batchIndex,
            },
          })),
        );

        await waitForWindowCompletion({
          label: `sentence-window-${start}-${end}`,
          targetCompleted: end,
          completedField: "sentenceBatchCompleted",
          failedField: "failedSentenceBatches",
        });
      }

      for (let start = 0; start < totals.wordAudioTotal; start += env.DECK_WORD_AUDIO_WINDOW_SIZE) {
        const end = Math.min(start + env.DECK_WORD_AUDIO_WINDOW_SIZE, totals.wordAudioTotal);
        const wordAudios = await step.run(`load-word-audio-window-${start}-${end}`, () =>
          getWordAudioEvents({
            deckId,
            start,
            limit: end - start,
          }),
        );

        await step.sendEvent(
          `send-word-audio-window-${start}-${end}`,
          wordAudios.map((wordAudio) => ({
            id: `deck:${deckId}:word-audio:${wordAudio.wordId}`,
            name: DECK_WORD_AUDIO_ENSURE_EVENT,
            data: {
              deckId,
              wordId: wordAudio.wordId,
            },
          })),
        );

        await waitForWindowCompletion({
          label: `word-audio-window-${start}-${end}`,
          targetCompleted: end,
          completedField: "wordAudioCompleted",
          failedField: "failedWordAudios",
        });
      }

      await step.run("finalize-deck-package", () => finalizeDeckGeneration(deckId));
    } catch (error) {
      await step.run("mark-deck-generation-failed", () => markDeckGenerationFailed(deckId, error));
      throw error;
    }
  },
);

export const generateSentenceBatch = inngest.createFunction(
  {
    id: "generate-sentence-batch",
    retries: 8,
    throttle: {
      limit: env.OPENROUTER_SENTENCE_BATCH_RPM,
      period: "1m",
    },
    concurrency: {
      limit: env.OPENROUTER_SENTENCE_BATCH_CONCURRENCY,
    },
    triggers: [{ event: DECK_SENTENCE_BATCH_GENERATE_EVENT }],
  },
  async ({ event, step }) => {
    const data = sentenceBatchEventSchema.parse(event.data);
    const progress = await step.run("generate-and-persist-sentence-batch", () =>
      generateAndPersistSentenceBatch(data),
    );

    if (progress.sentenceBatchCompleted >= progress.sentenceBatchTotal) {
      await step.sendEvent("send-sentence-batches-completed", {
        id: `deck:${data.deckId}:sentence-batches-completed`,
        name: DECK_SENTENCE_BATCHES_COMPLETED_EVENT,
        data: {
          deckId: data.deckId,
        },
      });
    }
  },
);

export const ensureWordAudio = inngest.createFunction(
  {
    id: "ensure-word-audio",
    retries: 8,
    throttle: {
      limit: env.GEMINI_WORD_AUDIO_RPM,
      period: "1m",
    },
    concurrency: {
      limit: env.GEMINI_WORD_AUDIO_CONCURRENCY,
    },
    triggers: [{ event: DECK_WORD_AUDIO_ENSURE_EVENT }],
  },
  async ({ event, step }) => {
    const data = wordAudioEventSchema.parse(event.data);
    const progress = await step.run("ensure-and-persist-word-audio", () =>
      ensureAndPersistWordAudio(data),
    );

    if (progress.wordAudioCompleted >= progress.wordAudioTotal) {
      await step.sendEvent("send-word-audio-completed", {
        id: `deck:${data.deckId}:word-audio-completed`,
        name: DECK_WORD_AUDIO_COMPLETED_EVENT,
        data: {
          deckId: data.deckId,
        },
      });
    }
  },
);

export const inngestFunctions = [generateDeck, generateSentenceBatch, ensureWordAudio];
