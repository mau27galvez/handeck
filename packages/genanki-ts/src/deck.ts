import { type SqliteBinding } from "./db";
import { Model } from "./model";
import { Note } from "./note";
import { type JsonValue, type ValidationContext } from "./types";

type SelectStringStatement = {
  get: (...params: SqliteBinding[]) => unknown;
};

type UpdateStringStatement = {
  run: (...params: SqliteBinding[]) => unknown;
};

type InsertNoteStatement = {
  run: (...params: SqliteBinding[]) => { lastInsertRowid: number | bigint };
};

type InsertCardStatement = {
  run: (...params: SqliteBinding[]) => unknown;
};

export type DeckOptions = {
  id: number;
  name: string;
  description?: string;
};

export class Deck {
  id: number;
  name: string;
  description: string;
  readonly notes: Note[] = [];
  readonly models = new Map<number, Model>();

  constructor(options: DeckOptions) {
    this.id = options.id;
    this.name = options.name;
    this.description = options.description ?? "";
  }

  addNote(note: Note) {
    this.notes.push(note);
  }

  addModel(model: Model) {
    this.models.set(model.id, model);
  }

  async writeToFile(file: string) {
    const { Package } = await import("./package");
    await new Package(this).writeToFile(file);
  }

  toJson() {
    return {
      collapsed: false,
      conf: 1,
      desc: this.description,
      dyn: 0,
      extendNew: 0,
      extendRev: 50,
      id: this.id,
      lrnToday: [163, 2],
      mod: 1425278051,
      name: this.name,
      newToday: [163, 2],
      revToday: [163, 0],
      timeToday: [163, 23598],
      usn: -1,
    } satisfies Record<string, JsonValue>;
  }

  writeToDb(
    selectDecks: SelectStringStatement,
    updateDecks: UpdateStringStatement,
    selectModels: SelectStringStatement,
    updateModels: UpdateStringStatement,
    insertNote: InsertNoteStatement,
    insertCard: InsertCardStatement,
    timestamp: number,
    idGen: Iterator<number>,
    validationContext: ValidationContext,
  ) {
    if (!Number.isInteger(this.id)) {
      throw new TypeError(`Deck .id must be an integer, not ${this.id}.`);
    }

    if (typeof this.name !== "string") {
      throw new TypeError(`Deck .name must be a string, not ${this.name}.`);
    }

    const decksRow = selectDecks.get() as { decks: string } | undefined;
    const decks = JSON.parse(decksRow?.decks ?? "{}") as Record<string, JsonValue>;
    decks[String(this.id)] = this.toJson();
    updateDecks.run(JSON.stringify(decks));

    const modelsRow = selectModels.get() as { models: string } | undefined;
    const models = JSON.parse(modelsRow?.models ?? "{}") as Record<string, JsonValue>;
    for (const note of this.notes) {
      this.addModel(note.model);
    }

    for (const model of this.models.values()) {
      models[String(model.id)] = model.toJson(timestamp, this.id);
    }
    updateModels.run(JSON.stringify(models));

    for (const note of this.notes) {
      note.writeToDb(insertNote, insertCard, timestamp, this.id, idGen, validationContext);
    }
  }
}
