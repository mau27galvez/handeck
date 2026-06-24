export const DECK_GENERATE_REQUESTED_EVENT = "deck/generate.requested";
export const DECK_SENTENCE_BATCH_GENERATE_EVENT = "deck/sentence-batch.generate";
export const DECK_SENTENCE_BATCHES_COMPLETED_EVENT = "deck/sentence-batches.completed";
export const DECK_WORD_AUDIO_ENSURE_EVENT = "deck/word-audio.ensure";
export const DECK_WORD_AUDIO_COMPLETED_EVENT = "deck/word-audio.completed";

export type DeckGenerateRequestedEvent = {
  name: typeof DECK_GENERATE_REQUESTED_EVENT;
  data: {
    deckId: string;
    templateId: string;
    userId: string;
  };
};
