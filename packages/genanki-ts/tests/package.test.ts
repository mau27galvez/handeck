import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { unzipSync } from "fflate";

import { Deck, Model, Note, Package } from "../src";

const TEST_MODEL = new Model({
  id: 234567,
  name: "foomodel",
  fields: [{ name: "AField" }, { name: "BField" }],
  templates: [
    {
      name: "card1",
      qfmt: "{{AField}}",
      afmt: '{{FrontSide}}<hr id="answer">{{BField}}',
    },
  ],
});

const TEST_CN_MODEL = new Model({
  id: 345678,
  name: "Chinese",
  fields: [{ name: "Traditional" }, { name: "Simplified" }, { name: "English" }],
  templates: [
    {
      name: "Traditional",
      qfmt: "{{Traditional}}",
      afmt: '{{FrontSide}}<hr id="answer">{{English}}',
    },
    {
      name: "Simplified",
      qfmt: "{{Simplified}}",
      afmt: '{{FrontSide}}<hr id="answer">{{English}}',
    },
  ],
});

test("writes a structurally valid apkg archive", async () => {
  const tempDir = join(tmpdir(), `genanki-ts-package-${randomUUID()}`);
  await mkdir(tempDir, { recursive: true });

  try {
    const outputPath = join(tempDir, "output.apkg");
    const deck = new Deck({ id: 123456, name: "foodeck", description: "This is my great deck." });
    deck.addNote(new Note({ model: TEST_MODEL, fields: ["a", "b"] }));

    await new Package(deck).writeToFile(outputPath, { timestamp: 0 });

    const archive = unzipSync(await readFile(outputPath));
    expect(Object.keys(archive).sort()).toEqual(["collection.anki2", "media"]);
    expect(JSON.parse(new TextDecoder().decode(archive.media!))).toEqual({});

    const dbPath = join(tempDir, "collection.anki2");
    await writeFile(dbPath, archive["collection.anki2"]!);

    const db = new Database(dbPath);
    try {
      const deckRow = db.query("SELECT decks FROM col").get() as { decks: string };
      const decks = JSON.parse(deckRow.decks);
      expect(decks["123456"].name).toBe("foodeck");
      expect(decks["123456"].desc).toBe("This is my great deck.");

      const modelRow = db.query("SELECT models FROM col").get() as { models: string };
      const models = JSON.parse(modelRow.models);
      expect(models["234567"].name).toBe("foomodel");
      expect(models["234567"].sortf).toBe(0);

      const notes = db.query("SELECT id, guid, mid, flds, sfld, tags FROM notes").all() as Array<{
        id: number;
        guid: string;
        mid: number;
        flds: string;
        sfld: string;
        tags: string;
      }>;
      expect(notes).toHaveLength(1);
      expect(notes[0]).toMatchObject({
        id: 0,
        mid: 234567,
        flds: "a\x1fb",
        sfld: "a",
        tags: "  ",
      });

      const cards = db.query("SELECT id, nid, did, ord, due, queue FROM cards").all() as Array<{
        id: number;
        nid: number;
        did: number;
        ord: number;
        due: number;
        queue: number;
      }>;
      expect(cards).toEqual([{ id: 1, nid: 0, did: 123456, ord: 0, due: 0, queue: 0 }]);
    } finally {
      db.close();
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("writes valid cards for multi-template notes", async () => {
  const tempDir = join(tmpdir(), `genanki-ts-cards-${randomUUID()}`);
  await mkdir(tempDir, { recursive: true });

  try {
    const outputPath = join(tempDir, "output.apkg");
    const deck = new Deck({ id: 123456, name: "foodeck" });
    deck.addNote(new Note({ model: TEST_CN_MODEL, fields: ["中國", "中国", "China"] }));
    deck.addNote(new Note({ model: TEST_CN_MODEL, fields: ["你好", "", "hello"] }));

    await new Package(deck).writeToFile(outputPath, { timestamp: 0 });

    const archive = unzipSync(await readFile(outputPath));
    const dbPath = join(tempDir, "collection.anki2");
    await writeFile(dbPath, archive["collection.anki2"]!);

    const db = new Database(dbPath);
    try {
      const cards = db.query("SELECT nid, ord FROM cards ORDER BY id").all();
      expect(cards).toEqual([
        { nid: 0, ord: 0 },
        { nid: 0, ord: 1 },
        { nid: 3, ord: 0 },
      ]);
    } finally {
      db.close();
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("writes suspended cards and due values", async () => {
  const tempDir = join(tmpdir(), `genanki-ts-suspended-${randomUUID()}`);
  await mkdir(tempDir, { recursive: true });

  try {
    const outputPath = join(tempDir, "output.apkg");
    const deck = new Deck({ id: 123456, name: "foodeck" });
    const note = new Note({ model: TEST_CN_MODEL, fields: ["中國", "中国", "China"], due: 7 });
    note.cards[1]!.suspend = true;
    deck.addNote(note);

    await new Package(deck).writeToFile(outputPath, { timestamp: 0 });

    const archive = unzipSync(await readFile(outputPath));
    const dbPath = join(tempDir, "collection.anki2");
    await writeFile(dbPath, archive["collection.anki2"]!);

    const db = new Database(dbPath);
    try {
      const cards = db.query("SELECT ord, due, queue FROM cards ORDER BY id").all();
      expect(cards).toEqual([
        { ord: 0, due: 7, queue: 0 },
        { ord: 1, due: 7, queue: -1 },
      ]);
    } finally {
      db.close();
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("writes media files using Anki media indexes", async () => {
  const tempDir = join(tmpdir(), `genanki-ts-media-${randomUUID()}`);
  await mkdir(tempDir, { recursive: true });

  try {
    const outputPath = join(tempDir, "output.apkg");
    const mp3Path = join(tempDir, "present.mp3");
    const jpgPath = join(tempDir, "present.jpg");
    await writeFile(mp3Path, new Uint8Array([1, 2, 3]));
    await writeFile(jpgPath, new Uint8Array([4, 5, 6]));

    const deck = new Deck({ id: 123456, name: "foodeck" });
    deck.addNote(
      new Note({
        model: TEST_MODEL,
        fields: ["question [sound:present.mp3]", 'answer <img src="present.jpg">'],
      }),
    );

    await new Package(deck, { mediaFiles: [mp3Path, jpgPath] }).writeToFile(outputPath, {
      timestamp: 0,
    });

    const archive = unzipSync(await readFile(outputPath));
    expect(JSON.parse(new TextDecoder().decode(archive.media!))).toEqual({
      0: "present.mp3",
      1: "present.jpg",
    });
    expect(Array.from(archive["0"]!)).toEqual([1, 2, 3]);
    expect(Array.from(archive["1"]!)).toEqual([4, 5, 6]);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("rejects duplicate media basenames", async () => {
  const tempDir = join(tmpdir(), `genanki-ts-media-dupes-${randomUUID()}`);
  await mkdir(join(tempDir, "a"), { recursive: true });
  await mkdir(join(tempDir, "b"), { recursive: true });

  try {
    const outputPath = join(tempDir, "output.apkg");
    const firstPath = join(tempDir, "a", "present.jpg");
    const secondPath = join(tempDir, "b", "present.jpg");
    await writeFile(firstPath, new Uint8Array([1]));
    await writeFile(secondPath, new Uint8Array([2]));

    const deck = new Deck({ id: 123456, name: "foodeck" });
    deck.addNote(new Note({ model: TEST_MODEL, fields: ["a", "b"] }));

    await expect(
      new Package(deck, { mediaFiles: [firstPath, secondPath] }).writeToFile(outputPath),
    ).rejects.toThrow("Media files must have unique filenames");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
