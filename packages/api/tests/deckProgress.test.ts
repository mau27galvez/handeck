import { describe, expect, test } from "vitest";

import { getDeckGenerationProgressRatio } from "../src/modules/decks/deck-progress";

describe("getDeckGenerationProgressRatio", () => {
  test("returns completed progress for decks with no tracked work", () => {
    expect(
      getDeckGenerationProgressRatio({
        status: "completed",
        sentenceBatchTotal: 0,
        sentenceBatchCompleted: 0,
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
        wordAudioTotal: 90,
        wordAudioCompleted: 45,
      }),
    ).toBe(0.5);
  });
});
