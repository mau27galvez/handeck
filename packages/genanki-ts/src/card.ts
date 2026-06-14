import { type SqliteBinding } from "./db";

type StatementRunner = {
  run: (...params: SqliteBinding[]) => unknown;
};

export type CardOptions = {
  ord: number;
  suspend?: boolean;
};

export class Card {
  ord: number;
  suspend: boolean;

  constructor(options: CardOptions) {
    this.ord = options.ord;
    this.suspend = options.suspend ?? false;
  }

  writeToDb(
    insertCard: StatementRunner,
    timestamp: number,
    deckId: number,
    noteId: number,
    idGen: Iterator<number>,
    due = 0,
  ) {
    const queue = this.suspend ? -1 : 0;
    const cardIdResult = idGen.next();
    if (cardIdResult.done) {
      throw new Error("ID generator ended unexpectedly.");
    }

    insertCard.run(
      cardIdResult.value,
      noteId,
      deckId,
      this.ord,
      Math.trunc(timestamp),
      -1,
      0,
      queue,
      due,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      "",
    );
  }
}
