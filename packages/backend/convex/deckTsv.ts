import type { Id } from "./_generated/dataModel";

/** TSV format version stored on deck rows and in the first header column. */
export const DECK_TSV_VERSION = "1";

export const DECK_TSV_COLUMNS = [
  "tsvVersion",
  "noteId",
  "hanzi",
  "diacriticPinyin",
  "meaning",
  "sentenceHanzi",
  "sentenceTranslation",
] as const;

export type DeckTsvRow = {
  noteId: Id<"notes">;
  hanzi: string;
  diacriticPinyin: string;
  meaning: string;
};

/** Filename convention for worker logs (blob is keyed by storage id in Convex). */
export function deckTsvFilename(deckId: Id<"decks">) {
  return `handeck-deck-${deckId}-v${DECK_TSV_VERSION}.tsv`;
}

function escapeTsvField(value: string) {
  return value.replaceAll("\t", " ").replaceAll("\r", " ").replaceAll("\n", " ");
}

function formatTsvRow(fields: string[]) {
  return fields.map(escapeTsvField).join("\t");
}

export function buildDeckTsvContent(rows: DeckTsvRow[]) {
  const lines = [
    formatTsvRow([...DECK_TSV_COLUMNS]),
    ...rows.map((row) =>
      formatTsvRow([
        DECK_TSV_VERSION,
        row.noteId,
        row.hanzi,
        row.diacriticPinyin,
        row.meaning,
        "",
        "",
      ]),
    ),
  ];
  return lines.join("\n") + "\n";
}
