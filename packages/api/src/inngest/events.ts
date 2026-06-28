export const DECK_GENERATE_REQUESTED_EVENT = "deck/generate.requested";
export const DECK_SENTENCE_BATCH_GENERATE_EVENT = "deck/sentence-batch.generate";
export const DECK_SENTENCE_WINDOW_SETTLED_EVENT = "deck/sentence-window.settled";
export const DECK_SENTENCE_AUDIO_ENSURE_EVENT = "deck/sentence-audio.ensure";
export const DECK_SENTENCE_AUDIO_WINDOW_SETTLED_EVENT = "deck/sentence-audio-window.settled";
export const DECK_WORD_AUDIO_ENSURE_EVENT = "deck/word-audio.ensure";
export const DECK_WORD_AUDIO_WINDOW_SETTLED_EVENT = "deck/word-audio-window.settled";

export type DeckGenerateRequestedEvent = {
  name: typeof DECK_GENERATE_REQUESTED_EVENT;
  data: {
    deckId: string;
    templateId: string;
    userId: string;
  };
};

export type DeckSentenceWindowSettledEvent = {
  name: typeof DECK_SENTENCE_WINDOW_SETTLED_EVENT;
  data: {
    deckId: string;
    windowStart: number;
    windowEnd: number;
    status: "completed" | "failed";
  };
};

export type DeckSentenceAudioWindowSettledEvent = {
  name: typeof DECK_SENTENCE_AUDIO_WINDOW_SETTLED_EVENT;
  data: {
    deckId: string;
    windowStart: number;
    windowEnd: number;
    status: "completed" | "failed";
  };
};

export type DeckWordAudioWindowSettledEvent = {
  name: typeof DECK_WORD_AUDIO_WINDOW_SETTLED_EVENT;
  data: {
    deckId: string;
    windowStart: number;
    windowEnd: number;
    status: "completed" | "failed";
  };
};
