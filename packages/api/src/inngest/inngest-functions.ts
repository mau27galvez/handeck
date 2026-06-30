import { env } from "@handeck/env/server";
import { NonRetriableError } from "inngest";
import { z } from "zod";
import {
  ensureAndPersistSentenceAudio,
  ensureAndPersistWordAudio,
  finalizeDeckGeneration,
  generateAndPersistSentenceBatch,
  getDeckGenerationProgress,
  getDeckStatus,
  getNextDeckGenerationAction,
  getSentenceAudioEvents,
  getSentenceAudioWindowSettlement,
  getSentenceBatchEvents,
  getSentenceWindowSettlement,
  getWordAudioEvents,
  getWordAudioWindowSettlement,
  markDeckGenerationFailed,
  markSentenceAudioFailed,
  markDeckGenerationStarted,
  markSentenceBatchFailed,
  markWordAudioFailed,
} from "../buildDeckFromTemplate";
import { toDeckGenerationProgressPayload } from "../modules/decks/deck-progress";
import { deckGenerationChannel } from "./channels";
import {
  DECK_GENERATE_REQUESTED_EVENT,
  DECK_SENTENCE_AUDIO_ENSURE_EVENT,
  DECK_SENTENCE_AUDIO_WINDOW_SETTLED_EVENT,
  DECK_SENTENCE_BATCH_GENERATE_EVENT,
  DECK_SENTENCE_WINDOW_SETTLED_EVENT,
  DECK_WORD_AUDIO_ENSURE_EVENT,
  DECK_WORD_AUDIO_WINDOW_SETTLED_EVENT,
} from "./events";
import { inngest } from "./inngest-client";

const deckCoordinatorEventSchema = z.object({
  deckId: z.string(),
});
const sentenceBatchEventSchema = z.object({
  deckId: z.string(),
  batchIndex: z.number(),
  windowStart: z.number(),
  windowEnd: z.number(),
});
const sentenceAudioEventSchema = z.object({
  deckId: z.string(),
  sentenceId: z.string(),
  windowStart: z.number(),
  windowEnd: z.number(),
});
const wordAudioEventSchema = z.object({
  deckId: z.string(),
  wordId: z.string(),
  windowStart: z.number(),
  windowEnd: z.number(),
});

type DeckGenerationProgress = Parameters<typeof toDeckGenerationProgressPayload>[0];
type DeckGenerationProgressOverrides = Parameters<typeof toDeckGenerationProgressPayload>[1];

const GEMINI_AUDIO_FLOW_CONTROL_KEY = `"gemini-audio"`;
const GEMINI_AUDIO_PER_DECK_CONCURRENCY = Math.max(1, Math.ceil(env.GEMINI_AUDIO_CONCURRENCY / 2));

/**
 * Word and sentence audio share one Gemini API key. Env-scoped concurrency with
 * a shared key makes both functions consume the same provider quota while keeping
 * per-deck concurrency below the full shared pool.
 *
 * Throttle does not support env/account scope, so each function gets half the
 * shared RPM budget to approximate the combined limit across both workers.
 */
const GEMINI_AUDIO_FLOW_CONTROL = {
  throttle: {
    limit: Math.ceil(env.GEMINI_AUDIO_RPM / 2),
    period: "1m" as const,
    key: GEMINI_AUDIO_FLOW_CONTROL_KEY,
  },
  concurrency: [
    {
      scope: "env" as const,
      key: GEMINI_AUDIO_FLOW_CONTROL_KEY,
      limit: env.GEMINI_AUDIO_CONCURRENCY,
    },
    {
      key: "event.data.deckId",
      limit: GEMINI_AUDIO_PER_DECK_CONCURRENCY,
    },
  ] as [
    {
      scope: "env";
      key: string;
      limit: number;
    },
    {
      key: string;
      limit: number;
    },
  ],
};

export const generateDeck = inngest.createFunction(
  {
    id: "generate-deck",
    retries: 3,
    triggers: [
      { event: DECK_GENERATE_REQUESTED_EVENT },
      { event: DECK_SENTENCE_WINDOW_SETTLED_EVENT },
      { event: DECK_SENTENCE_AUDIO_WINDOW_SETTLED_EVENT },
      { event: DECK_WORD_AUDIO_WINDOW_SETTLED_EVENT },
    ],
    onFailure: async ({ error, event, step }) => {
      const { deckId } = deckCoordinatorEventSchema.parse(event.data.event.data);
      await step.run("mark-deck-generation-failed", () => markDeckGenerationFailed(deckId, error));
      const progress = await step.run("load-failed-deck-generation-progress", () =>
        getDeckGenerationProgress(deckId),
      );
      await step.realtime.publish(
        "publish-failed-deck-generation-progress",
        deckGenerationChannel(deckId).progress,
        deckGenerationProgressPayload(progress),
      );
    },
  },
  async ({ event, step }) => {
    const { deckId } = deckCoordinatorEventSchema.parse(event.data);

    const status = await step.run("load-deck-status", () => getDeckStatus(deckId));
    if (status === "completed" || status === "failed") {
      return;
    }

    if (status === "queued") {
      await step.run("mark-deck-generation-started", () => markDeckGenerationStarted(deckId));
      const progress = await step.run("load-started-deck-generation-progress", () =>
        getDeckGenerationProgress(deckId),
      );
      await step.realtime.publish(
        "publish-started-deck-generation-progress",
        deckGenerationChannel(deckId).progress,
        deckGenerationProgressPayload(progress),
      );
    }

    const action = await step.run("load-next-deck-generation-action", () =>
      getNextDeckGenerationAction(deckId),
    );

    if (action.type === "fail") {
      throw new NonRetriableError("Deck generation failed");
    }

    if (action.type === "finalize") {
      await step.run("finalize-deck-package", () => finalizeDeckGeneration(deckId));
      const progress = await step.run("load-completed-deck-generation-progress", () =>
        getDeckGenerationProgress(deckId),
      );
      await step.realtime.publish(
        "publish-completed-deck-generation-progress",
        deckGenerationChannel(deckId).progress,
        deckGenerationProgressPayload(progress),
      );
      return;
    }

    /**
     * Here we capping the generations that 1 deck can enqueue at a time.
     * We do this to avoid one large deck from delaying smaller decks.
     * All of them have small windows, so they can't hog the queue.
     * Similar to an OS scheduler.
     *
     * This is not perfect round-robin fairness.
     * If Deck A starts much earlier, it still gets the first window.
     * But windowing caps how much queue space one deck can occupy at a time.
     *
     * Smaller windows mean more fairness, but more orchestration overhead.
     * Larger windows mean faster single-deck throughput, but more chance one large deck delays smaller decks.
     */
    if (action.type === "dispatch-sentence-window") {
      const batches = await step.run(
        `load-sentence-window-${action.windowStart}-${action.windowEnd}`,
        () =>
          getSentenceBatchEvents({
            deckId,
            start: action.windowStart,
            limit: action.windowEnd - action.windowStart,
          }),
      );

      await step.sendEvent(
        `send-sentence-window-${action.windowStart}-${action.windowEnd}`,
        batches.map((batch) => ({
          id: `deck:${deckId}:sentence-batch:${batch.batchIndex}`,
          name: DECK_SENTENCE_BATCH_GENERATE_EVENT,
          data: {
            deckId,
            batchIndex: batch.batchIndex,
            windowStart: action.windowStart,
            windowEnd: action.windowEnd,
          },
        })),
      );

      return;
    }

    if (action.type === "dispatch-sentence-audio-window") {
      const sentenceAudios = await step.run(
        `load-sentence-audio-window-${action.windowStart}-${action.windowEnd}`,
        () =>
          getSentenceAudioEvents({
            deckId,
            start: action.windowStart,
            limit: action.windowEnd - action.windowStart,
          }),
      );

      await step.sendEvent(
        `send-sentence-audio-window-${action.windowStart}-${action.windowEnd}`,
        sentenceAudios.map((sentenceAudio) => ({
          id: `deck:${deckId}:sentence-audio:${sentenceAudio.sentenceId}`,
          name: DECK_SENTENCE_AUDIO_ENSURE_EVENT,
          data: {
            deckId,
            sentenceId: sentenceAudio.sentenceId,
            windowStart: action.windowStart,
            windowEnd: action.windowEnd,
          },
        })),
      );

      return;
    }

    if (action.type === "dispatch-word-audio-window") {
      const wordAudios = await step.run(
        `load-word-audio-window-${action.windowStart}-${action.windowEnd}`,
        () =>
          getWordAudioEvents({
            deckId,
            start: action.windowStart,
            limit: action.windowEnd - action.windowStart,
          }),
      );

      await step.sendEvent(
        `send-word-audio-window-${action.windowStart}-${action.windowEnd}`,
        wordAudios.map((wordAudio) => ({
          id: `deck:${deckId}:word-audio:${wordAudio.wordId}`,
          name: DECK_WORD_AUDIO_ENSURE_EVENT,
          data: {
            deckId,
            wordId: wordAudio.wordId,
            windowStart: action.windowStart,
            windowEnd: action.windowEnd,
          },
        })),
      );

      return;
    }
  },
);

export const generateSentenceBatch = inngest.createFunction(
  {
    id: "generate-sentence-batch",
    retries: 8,
    /**
     * This throttle config limits the global provider/resource cap:
     * only OPENROUTER_SENTENCE_BATCH_CONCURRENCY sentence batch runs can execute at once across all decks.
     */
    throttle: {
      limit: env.OPENROUTER_SENTENCE_BATCH_RPM,
      period: "1m",
    },
    /**
     * This concurrency config limits the noisy-neighbor problem:
     * each deckId can use up to about half of OPENROUTER_SENTENCE_BATCH_CONCURRENCY active slots.
     * So if Deck A has a large window queued, it cannot occupy all global
     * sentence-generation slots by itself. Other decks can still get scheduled
     * into the remaining global capacity.
     *
     * Example with global concurrency 5:
     * Before: Deck A could use all 5 active sentence slots.
     * After: Deck A can use up to 3 slots, leaving room for other decks.
     *
     * So this favors fairness over single-deck throughput.
     * A large deck may finish slower, but it is much less likely to monopolize
     * the shared AI generation capacity.
     */
    concurrency: [
      {
        limit: env.OPENROUTER_SENTENCE_BATCH_CONCURRENCY,
      },
      {
        key: "event.data.deckId",
        limit: Math.max(1, Math.ceil(env.OPENROUTER_SENTENCE_BATCH_CONCURRENCY / 2)),
      },
    ],
    triggers: [{ event: DECK_SENTENCE_BATCH_GENERATE_EVENT }],
    onFailure: async ({ error, event, step }) => {
      const data = sentenceBatchEventSchema.parse(event.data.event.data);
      await step.run("mark-sentence-batch-failed", () =>
        markSentenceBatchFailed({
          deckId: data.deckId,
          batchIndex: data.batchIndex,
          error,
        }),
      );
      const progress = await step.run("load-failed-sentence-batch-progress", () =>
        getDeckGenerationProgress(data.deckId),
      );
      await step.realtime.publish(
        `publish-failed-sentence-batch-progress-${data.batchIndex}`,
        deckGenerationChannel(data.deckId).progress,
        deckGenerationProgressPayload(progress, {
          status: "failed",
          error: errorMessage(error),
        }),
      );

      await step.sendEvent("send-sentence-window-failed", {
        id: sentenceWindowSettledEventId(data),
        name: DECK_SENTENCE_WINDOW_SETTLED_EVENT,
        data: {
          deckId: data.deckId,
          windowStart: data.windowStart,
          windowEnd: data.windowEnd,
          status: "failed",
        },
      });
    },
  },
  async ({ event, step }) => {
    const data = sentenceBatchEventSchema.parse(event.data);
    const result = await step.run("generate-and-persist-sentence-batch", async () => {
      const progress = await generateAndPersistSentenceBatch(data);
      const settlement = await getSentenceWindowSettlement(
        data.deckId,
        data.windowStart,
        data.windowEnd,
      );

      return { progress, settlement };
    });
    await step.realtime.publish(
      `publish-sentence-batch-progress-${data.batchIndex}`,
      deckGenerationChannel(data.deckId).progress,
      deckGenerationProgressPayload(result.progress),
    );

    if (result.settlement.settled && !result.settlement.failed) {
      await step.sendEvent("send-sentence-window-completed", {
        id: sentenceWindowSettledEventId(data),
        name: DECK_SENTENCE_WINDOW_SETTLED_EVENT,
        data: {
          deckId: data.deckId,
          windowStart: data.windowStart,
          windowEnd: data.windowEnd,
          status: "completed",
        },
      });
    }
  },
);

export const ensureSentenceAudio = inngest.createFunction(
  {
    id: "ensure-sentence-audio",
    retries: 8,
    ...GEMINI_AUDIO_FLOW_CONTROL,
    triggers: [{ event: DECK_SENTENCE_AUDIO_ENSURE_EVENT }],
    onFailure: async ({ error, event, step }) => {
      const data = sentenceAudioEventSchema.parse(event.data.event.data);
      await step.run("mark-sentence-audio-failed", () =>
        markSentenceAudioFailed({
          deckId: data.deckId,
          sentenceId: data.sentenceId,
          error,
        }),
      );
      const progress = await step.run("load-failed-sentence-audio-progress", () =>
        getDeckGenerationProgress(data.deckId),
      );
      await step.realtime.publish(
        `publish-failed-sentence-audio-progress-${data.sentenceId}`,
        deckGenerationChannel(data.deckId).progress,
        deckGenerationProgressPayload(progress, {
          status: "failed",
          error: errorMessage(error),
        }),
      );

      await step.sendEvent("send-sentence-audio-window-failed", {
        id: sentenceAudioWindowSettledEventId(data),
        name: DECK_SENTENCE_AUDIO_WINDOW_SETTLED_EVENT,
        data: {
          deckId: data.deckId,
          windowStart: data.windowStart,
          windowEnd: data.windowEnd,
          status: "failed",
        },
      });
    },
  },
  async ({ event, step }) => {
    const data = sentenceAudioEventSchema.parse(event.data);
    const result = await step.run("ensure-and-persist-sentence-audio", async () => {
      const progress = await ensureAndPersistSentenceAudio(data);
      const settlement = await getSentenceAudioWindowSettlement(
        data.deckId,
        data.windowStart,
        data.windowEnd,
      );

      return { progress, settlement };
    });
    await step.realtime.publish(
      `publish-sentence-audio-progress-${data.sentenceId}`,
      deckGenerationChannel(data.deckId).progress,
      deckGenerationProgressPayload(result.progress),
    );

    if (result.settlement.settled && !result.settlement.failed) {
      await step.sendEvent("send-sentence-audio-window-completed", {
        id: sentenceAudioWindowSettledEventId(data),
        name: DECK_SENTENCE_AUDIO_WINDOW_SETTLED_EVENT,
        data: {
          deckId: data.deckId,
          windowStart: data.windowStart,
          windowEnd: data.windowEnd,
          status: "completed",
        },
      });
    }
  },
);

export const ensureWordAudio = inngest.createFunction(
  {
    id: "ensure-word-audio",
    retries: 8,
    ...GEMINI_AUDIO_FLOW_CONTROL,
    triggers: [{ event: DECK_WORD_AUDIO_ENSURE_EVENT }],
    onFailure: async ({ error, event, step }) => {
      const data = wordAudioEventSchema.parse(event.data.event.data);
      await step.run("mark-word-audio-failed", () =>
        markWordAudioFailed({
          deckId: data.deckId,
          wordId: data.wordId,
          error,
        }),
      );
      const progress = await step.run("load-failed-word-audio-progress", () =>
        getDeckGenerationProgress(data.deckId),
      );
      await step.realtime.publish(
        `publish-failed-word-audio-progress-${data.wordId}`,
        deckGenerationChannel(data.deckId).progress,
        deckGenerationProgressPayload(progress, {
          status: "failed",
          error: errorMessage(error),
        }),
      );

      await step.sendEvent("send-word-audio-window-failed", {
        id: wordAudioWindowSettledEventId(data),
        name: DECK_WORD_AUDIO_WINDOW_SETTLED_EVENT,
        data: {
          deckId: data.deckId,
          windowStart: data.windowStart,
          windowEnd: data.windowEnd,
          status: "failed",
        },
      });
    },
  },
  async ({ event, step }) => {
    const data = wordAudioEventSchema.parse(event.data);
    const result = await step.run("ensure-and-persist-word-audio", async () => {
      const progress = await ensureAndPersistWordAudio(data);
      const settlement = await getWordAudioWindowSettlement(
        data.deckId,
        data.windowStart,
        data.windowEnd,
      );

      return { progress, settlement };
    });
    await step.realtime.publish(
      `publish-word-audio-progress-${data.wordId}`,
      deckGenerationChannel(data.deckId).progress,
      deckGenerationProgressPayload(result.progress),
    );

    if (result.settlement.settled && !result.settlement.failed) {
      await step.sendEvent("send-word-audio-window-completed", {
        id: wordAudioWindowSettledEventId(data),
        name: DECK_WORD_AUDIO_WINDOW_SETTLED_EVENT,
        data: {
          deckId: data.deckId,
          windowStart: data.windowStart,
          windowEnd: data.windowEnd,
          status: "completed",
        },
      });
    }
  },
);

export const inngestFunctions = [
  generateDeck,
  generateSentenceBatch,
  ensureSentenceAudio,
  ensureWordAudio,
];

function sentenceWindowSettledEventId({
  deckId,
  windowStart,
  windowEnd,
}: {
  deckId: string;
  windowStart: number;
  windowEnd: number;
}) {
  return `deck:${deckId}:sentence-window:${windowStart}:${windowEnd}:settled`;
}

function wordAudioWindowSettledEventId({
  deckId,
  windowStart,
  windowEnd,
}: {
  deckId: string;
  windowStart: number;
  windowEnd: number;
}) {
  return `deck:${deckId}:word-audio-window:${windowStart}:${windowEnd}:settled`;
}

function sentenceAudioWindowSettledEventId({
  deckId,
  windowStart,
  windowEnd,
}: {
  deckId: string;
  windowStart: number;
  windowEnd: number;
}) {
  return `deck:${deckId}:sentence-audio-window:${windowStart}:${windowEnd}:settled`;
}

function deckGenerationProgressPayload(
  progress: DeckGenerationProgress,
  overrides?: DeckGenerationProgressOverrides,
) {
  return toDeckGenerationProgressPayload(progress, overrides);
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Deck generation failed";
}
