import { type SQLQueryBindings } from "bun:sqlite";

import { Card } from "./card";
import { Model } from "./model";
import { ModelType, type NoteValueResolver, type ValidationContext } from "./types";
import { guidFor, warnOrThrow } from "./util";

type InsertNoteStatement = {
  run: (...params: SQLQueryBindings[]) => { lastInsertRowid: number | bigint };
};

type InsertCardStatement = {
  run: (...params: SQLQueryBindings[]) => unknown;
};

export type NoteOptions = {
  model: Model;
  fields: string[];
  sortField?: string | NoteValueResolver;
  tags?: string[];
  guid?: string | NoteValueResolver;
  due?: number;
};

export class Note {
  model: Model;
  fields: string[];
  due: number;

  #sortField?: string | NoteValueResolver;
  #tags: string[];
  #guid?: string | NoteValueResolver;
  #cards?: Card[];

  static readonly invalidHtmlTagPattern =
    /<(?!\/?[a-zA-Z0-9]+(?: .*|\/?)>|!--|!\[CDATA\[)(?:.|\n)*?>/g;

  constructor(options: NoteOptions) {
    this.model = options.model;
    this.fields = options.fields;
    this.#sortField = options.sortField;
    this.#guid = options.guid;
    this.#tags = createValidatedTags(options.tags ?? []);
    this.due = options.due ?? 0;
  }

  get sortField(): string {
    const sortField = this.#sortField;
    if (typeof sortField === "function") {
      return sortField({ fields: this.fields, model: this.model });
    }

    return sortField ?? this.fields[this.model.sortFieldIndex] ?? "";
  }

  set sortField(value: string | NoteValueResolver | undefined) {
    this.#sortField = value;
  }

  get tags() {
    return this.#tags;
  }

  set tags(value: string[]) {
    this.#tags = createValidatedTags(value);
  }

  get guid(): string {
    const guid = this.#guid;
    if (typeof guid === "function") {
      return guid({ fields: this.fields, model: this.model });
    }

    return guid ?? guidFor(...this.fields);
  }

  set guid(value: string | NoteValueResolver | undefined) {
    this.#guid = value;
  }

  get cards() {
    this.#cards ??=
      this.model.modelType === ModelType.FrontBack ? this.#frontBackCards() : this.#clozeCards();
    return this.#cards;
  }

  static findInvalidHtmlTagsInField(field: string) {
    return Array.from(field.matchAll(Note.invalidHtmlTagPattern), (match) => match[0]);
  }

  writeToDb(
    insertNote: InsertNoteStatement,
    insertCard: InsertCardStatement,
    timestamp: number,
    deckId: number,
    idGen: Iterator<number>,
    validationContext: ValidationContext,
  ) {
    this.#checkNumberModelFieldsMatchesNumFields();
    this.#checkInvalidHtmlTagsInFields(validationContext);

    const noteIdResult = idGen.next();
    if (noteIdResult.done) {
      throw new Error("ID generator ended unexpectedly.");
    }

    const result = insertNote.run(
      noteIdResult.value,
      this.guid,
      this.model.id,
      Math.trunc(timestamp),
      -1,
      this.#formatTags(),
      this.#formatFields(),
      this.sortField,
      0,
      0,
      "",
    );

    const noteId = Number(result.lastInsertRowid);
    for (const card of this.cards) {
      card.writeToDb(insertCard, timestamp, deckId, noteId, idGen, this.due);
    }
  }

  #clozeCards() {
    const cardOrds = new Set<number>();
    const qfmt = this.model.templates[0]?.qfmt ?? "";
    const clozeReplacements = [
      ...qfmt.matchAll(/{{[^}]*?cloze:(?:[^}]?:)*(.+?)}}/g),
      ...qfmt.matchAll(/<%cloze:(.+?)%>/g),
    ];

    for (const match of clozeReplacements) {
      const fieldName = match[1];
      const fieldIndex = this.model.fields.findIndex((field) => field.name === fieldName);
      const fieldValue = fieldIndex >= 0 ? (this.fields[fieldIndex] ?? "") : "";

      for (const clozeMatch of fieldValue.matchAll(/{{c(\d+)::.+?}}/gs)) {
        const clozeIndex = Number(clozeMatch[1]);
        if (clozeIndex > 0) {
          cardOrds.add(clozeIndex - 1);
        }
      }
    }

    if (cardOrds.size === 0) {
      cardOrds.add(0);
    }

    return Array.from(cardOrds, (ord) => new Card({ ord }));
  }

  #frontBackCards() {
    const cards: Card[] = [];

    for (const [cardOrd, anyOrAll, requiredFieldOrds] of this.model.requiredFields) {
      const hasRequiredFields =
        anyOrAll === "all"
          ? requiredFieldOrds.every((ord) => this.fields[ord])
          : requiredFieldOrds.some((ord) => this.fields[ord]);

      if (hasRequiredFields) {
        cards.push(new Card({ ord: cardOrd }));
      }
    }

    return cards;
  }

  #checkNumberModelFieldsMatchesNumFields() {
    if (this.model.fields.length !== this.fields.length) {
      throw new Error(
        `Number of fields in Model does not match number of fields in Note: model has ${this.model.fields.length} fields, but note has ${this.fields.length} fields.`,
      );
    }
  }

  #checkInvalidHtmlTagsInFields(validationContext: ValidationContext) {
    for (const field of this.fields) {
      const invalidTags = Note.findInvalidHtmlTagsInField(field);
      if (invalidTags.length > 0) {
        warnOrThrow(
          `Field contained the following invalid HTML tags. Make sure your field data is already HTML-encoded: ${invalidTags.join(" ")}`,
          validationContext.validation,
        );
      }
    }
  }

  #formatFields() {
    return this.fields.join("\x1f");
  }

  #formatTags() {
    return ` ${this.tags.join(" ")} `;
  }
}

function createValidatedTags(tags: string[]) {
  for (const tag of tags) {
    validateTag(tag);
  }

  return new Proxy([...tags], {
    set(target, property, value) {
      if (typeof property === "string" && /^\d+$/.test(property)) {
        validateTag(String(value));
      }

      return Reflect.set(target, property, value);
    },
  });
}

function validateTag(tag: string) {
  if (tag.includes(" ")) {
    throw new Error(`Tag "${tag}" contains a space; this is not allowed!`);
  }
}
