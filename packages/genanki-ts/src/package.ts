import { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { zipSync } from "fflate";

import { APKG_COL } from "./apkg-col";
import { APKG_SCHEMA } from "./apkg-schema";
import { Deck } from "./deck";
import { type ValidationContext, type WritePackageOptions } from "./types";

export type PackageOptions = {
  mediaFiles?: string[];
};

export class Package {
  readonly decks: Deck[];
  mediaFiles: string[];

  constructor(deckOrDecks: Deck | Deck[], options: PackageOptions = {}) {
    this.decks = Array.isArray(deckOrDecks) ? deckOrDecks : [deckOrDecks];
    this.mediaFiles = Array.from(new Set(options.mediaFiles ?? []));
  }

  async writeToFile(file: string, options: WritePackageOptions = {}) {
    const timestamp = options.timestamp ?? Date.now() / 1000;
    const tempDir = join(tmpdir(), `genanki-ts-${randomUUID()}`);
    const dbPath = join(tempDir, "collection.anki2");

    await mkdir(tempDir, { recursive: true });

    try {
      const db = new Database(dbPath, { create: true });
      try {
        this.writeToDb(db, timestamp, count(Math.trunc(timestamp * 1000)), {
          validation: options.validation ?? "warn",
        });
      } finally {
        db.close();
      }

      const entries: Record<string, Uint8Array> = {
        "collection.anki2": await readFile(dbPath),
      };

      const mediaFileIdxToPath = new Map(this.mediaFiles.map((path, idx) => [idx, path] as const));
      const mediaJson = this.#buildMediaJson(mediaFileIdxToPath);
      entries.media = new TextEncoder().encode(JSON.stringify(mediaJson));

      for (const [idx, path] of mediaFileIdxToPath) {
        entries[String(idx)] = await readFile(path);
      }

      await mkdir(dirname(file), { recursive: true });
      await Bun.write(file, zipSync(entries, { level: 0 }));
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  writeToDb(
    db: Database,
    timestamp: number,
    idGen: Iterator<number>,
    validationContext: ValidationContext = { validation: "warn" },
  ) {
    db.exec(APKG_SCHEMA);
    db.exec(APKG_COL);

    const selectDecks = db.query("SELECT decks FROM col");
    const updateDecks = db.query("UPDATE col SET decks = ?");
    const selectModels = db.query("SELECT models FROM col");
    const updateModels = db.query("UPDATE col SET models = ?");
    const insertNote = db.query("INSERT INTO notes VALUES(?,?,?,?,?,?,?,?,?,?,?)");
    const insertCard = db.query("INSERT INTO cards VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");

    for (const deck of this.decks) {
      deck.writeToDb(
        selectDecks,
        updateDecks,
        selectModels,
        updateModels,
        insertNote,
        insertCard,
        timestamp,
        idGen,
        validationContext,
      );
    }
  }

  #buildMediaJson(mediaFileIdxToPath: Map<number, string>) {
    const usedBasenames = new Set<string>();
    const mediaJson: Record<number, string> = {};

    for (const [idx, path] of mediaFileIdxToPath) {
      const filename = basename(path);
      if (usedBasenames.has(filename)) {
        throw new Error(`Media files must have unique filenames. Duplicate filename: ${filename}`);
      }

      usedBasenames.add(filename);
      mediaJson[idx] = filename;
    }

    return mediaJson;
  }
}

function* count(start: number) {
  let current = start;
  while (true) {
    yield current;
    current += 1;
  }
}
