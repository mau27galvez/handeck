import { describe, expect, test } from "vitest";

import {
  getDeckGenerationProgressRatio,
  toDeckGenerationProgressPayload,
} from "../src/modules/decks/deck-progress";

describe("getDeckGenerationProgressRatio", () => {
  test("returns completed progress for decks with no tracked work", () => {
    expect(
      getDeckGenerationProgressRatio({
        status: "completed",
        sentenceBatchTotal: 0,
        sentenceBatchCompleted: 0,
        sentenceAudioTotal: 0,
        sentenceAudioCompleted: 0,
        wordAudioTotal: 0,
        wordAudioCompleted: 0,
      }),
    ).toBe(1);
  });

  test("returns zero for queued decks with no tracked work", () => {
    expect(
      getDeckGenerationProgressRatio({
        status: "queued",
        sentenceBatchTotal: 0,
        sentenceBatchCompleted: 0,
        sentenceAudioTotal: 0,
        sentenceAudioCompleted: 0,
        wordAudioTotal: 0,
        wordAudioCompleted: 0,
      }),
    ).toBe(0);
  });

  test("combines sentence and audio progress", () => {
    expect(
      getDeckGenerationProgressRatio({
        status: "generating",
        sentenceBatchTotal: 10,
        sentenceBatchCompleted: 5,
        sentenceAudioTotal: 20,
        sentenceAudioCompleted: 10,
        wordAudioTotal: 90,
        wordAudioCompleted: 45,
      }),
    ).toBe(0.5);
  });
});

describe("toDeckGenerationProgressPayload", () => {
  test("normalizes persisted progress into a realtime-safe payload", () => {
    expect(
      toDeckGenerationProgressPayload({
        deckId: "deck-1",
        status: "generating",
        sentenceBatchTotal: 2,
        sentenceBatchCompleted: 1,
        sentenceAudioTotal: 3,
        sentenceAudioCompleted: 1,
        wordAudioTotal: 5,
        wordAudioCompleted: 3,
        error: null,
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
    ).toEqual({
      deckId: "deck-1",
      status: "generating",
      progress: 0.5,
      sentenceBatchTotal: 2,
      sentenceBatchCompleted: 1,
      sentenceAudioTotal: 3,
      sentenceAudioCompleted: 1,
      wordAudioTotal: 5,
      wordAudioCompleted: 3,
      error: null,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
  });

  test("applies terminal failure overrides without changing counters", () => {
    expect(
      toDeckGenerationProgressPayload(
        {
          deckId: "deck-1",
          status: "generating",
          sentenceBatchTotal: 1,
          sentenceBatchCompleted: 0,
          sentenceAudioTotal: 0,
          sentenceAudioCompleted: 0,
          wordAudioTotal: 0,
          wordAudioCompleted: 0,
          error: null,
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
        {
          status: "failed",
          error: "Generation failed",
        },
      ),
    ).toMatchObject({
      deckId: "deck-1",
      status: "failed",
      progress: 0,
      error: "Generation failed",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
  });
});
