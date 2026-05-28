import type { Id } from "./_generated/dataModel";

export type GenerationBundle = {
  profileId: Id<"profiles">;
  templateId: Id<"templates">;
  noteIds: Id<"notes">[];
  tsvContent: string;
  useCache: boolean;
  configSnapshot: {
    topics: string[];
    sentencesPerWord: number;
  };
};

export type FinalizeDeckResult = {
  deckId: Id<"decks">;
  noteCount: number;
};

export type CreateDeckResult = {
  deckId: Id<"decks">;
  tsvStorageId: Id<"_storage">;
  noteCount: number;
};
