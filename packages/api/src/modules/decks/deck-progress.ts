type DeckGenerationProgressInput = {
  status: "queued" | "generating" | "completed" | "failed";
  sentenceBatchTotal: number;
  sentenceBatchCompleted: number;
  sentenceAudioTotal: number;
  sentenceAudioCompleted: number;
  wordAudioTotal: number;
  wordAudioCompleted: number;
};

type DeckGenerationProgressPayloadInput = DeckGenerationProgressInput & {
  deckId: string;
  error: string | null;
  updatedAt: Date | string | null;
};

type DeckGenerationProgressPayloadOverrides = Partial<
  Pick<DeckGenerationProgressPayloadInput, "status" | "error" | "updatedAt">
>;

export function getDeckGenerationProgressRatio({
  status,
  sentenceBatchTotal,
  sentenceBatchCompleted,
  sentenceAudioTotal,
  sentenceAudioCompleted,
  wordAudioTotal,
  wordAudioCompleted,
}: DeckGenerationProgressInput) {
  const total = sentenceBatchTotal + sentenceAudioTotal + wordAudioTotal;
  if (total === 0) return status === "completed" ? 1 : 0;

  return (sentenceBatchCompleted + sentenceAudioCompleted + wordAudioCompleted) / total;
}

export function toDeckGenerationProgressPayload(
  input: DeckGenerationProgressPayloadInput,
  overrides: DeckGenerationProgressPayloadOverrides = {},
) {
  const payload = {
    ...input,
    ...overrides,
  };

  return {
    deckId: payload.deckId,
    status: payload.status,
    progress: getDeckGenerationProgressRatio(payload),
    sentenceBatchTotal: payload.sentenceBatchTotal,
    sentenceBatchCompleted: payload.sentenceBatchCompleted,
    sentenceAudioTotal: payload.sentenceAudioTotal,
    sentenceAudioCompleted: payload.sentenceAudioCompleted,
    wordAudioTotal: payload.wordAudioTotal,
    wordAudioCompleted: payload.wordAudioCompleted,
    error: payload.error,
    updatedAt: normalizeUpdatedAt(payload.updatedAt),
  };
}

function normalizeUpdatedAt(updatedAt: Date | string | null) {
  if (updatedAt instanceof Date) return updatedAt.toISOString();
  return updatedAt ?? new Date().toISOString();
}

export type DeckGenerationProgressPayload = ReturnType<typeof toDeckGenerationProgressPayload>;
