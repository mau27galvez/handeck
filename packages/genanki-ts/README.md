# @handeck/genanki-ts

`@handeck/genanki-ts` is an internal TypeScript package for generating Anki deck packages (`.apkg`) from code.

It is a TypeScript port of the core ideas from Python's `genanki` library. The package is meant to be used by server-side or worker code that can do file system, SQLite, and ZIP work.

## What Is Anki?

Anki is a flashcard app. It stores flashcards in decks, and users import/export decks as `.apkg` files.

The important concepts are:

- A `Deck` is a named collection of study material.
- A `Note` is the source data you want to study, such as `["Capital of Argentina", "Buenos Aires"]`.
- A `Model` describes the shape of a note: which fields it has and how cards should be created from those fields.
- A `Card` is what the user reviews. One note can create one or more cards.
- A `Package` writes one or more decks to an `.apkg` file that Anki can import.

For example, one note with fields `Front` and `Back` usually creates one card. A note model with forward and reverse templates can create two cards from the same note.

## Basic Usage

```ts
import { Deck, Model, Note, Package } from "@handeck/genanki-ts";

const model = new Model({
  id: 1607392319,
  name: "Simple Model",
  fields: [{ name: "Question" }, { name: "Answer" }],
  templates: [
    {
      name: "Card 1",
      qfmt: "{{Question}}",
      afmt: '{{FrontSide}}<hr id="answer">{{Answer}}',
    },
  ],
});

const deck = new Deck({
  id: 2059400110,
  name: "Country Capitals",
});

deck.addNote(
  new Note({
    model,
    fields: ["Capital of Argentina", "Buenos Aires"],
  }),
);

await new Package(deck).writeToFile("country-capitals.apkg");
```

The output file can be imported into Anki.

## IDs

Anki uses numeric IDs to recognize decks and models across imports. Pick stable IDs once and keep them in code.

```ts
const deck = new Deck({
  id: 2059400110,
  name: "Country Capitals",
});

const model = new Model({
  id: 1607392319,
  name: "Simple Model",
  fields: [{ name: "Question" }, { name: "Answer" }],
  templates: [
    {
      name: "Card 1",
      qfmt: "{{Question}}",
      afmt: "{{Answer}}",
    },
  ],
});
```

Changing a deck or model ID can make Anki treat it as a different deck or note type.

## Notes And GUIDs

Every note has a GUID, which is a stable text identifier. Anki uses it to decide whether an imported note is new or whether it should update an existing note.

By default, `Note` creates the GUID from all field values:

```ts
new Note({
  model,
  fields: ["Capital of Argentina", "Buenos Aires"],
});
```

If only some fields identify the note, provide a custom GUID:

```ts
import { guidFor, Note } from "@handeck/genanki-ts";

new Note({
  model,
  fields: ["你好", "ni hao", "hello", "example sentence that may change later"],
  guid: ({ fields }) => guidFor(fields[0], fields[1]),
});
```

This is useful when some fields are editable content but should not create duplicate notes on re-import.

## Card Templates

Templates use Anki-style placeholders:

```ts
{
  name: "Card 1",
  qfmt: "{{Question}}",
  afmt: '{{FrontSide}}<hr id="answer">{{Answer}}',
}
```

- `qfmt` is the front of the card.
- `afmt` is the back of the card.
- `{{Question}}` inserts the note field named `Question`.
- `{{FrontSide}}` inserts the rendered front side into the answer side.

This package does not render the final cards for display. Anki does that after import. The package only stores the model and template data in the `.apkg` file.

## Built-In Models

The package exports five ready-made models that cover the most common flashcard patterns. Use them when you do not need a custom layout:

```ts
import {
  BASIC_AND_REVERSED_CARD_MODEL,
  BASIC_MODEL,
  BASIC_OPTIONAL_REVERSED_CARD_MODEL,
  BASIC_TYPE_IN_THE_ANSWER_MODEL,
  CLOZE_MODEL,
} from "@handeck/genanki-ts";
```

Each model name ends with **(genanki)** — for example, `"Basic (genanki)"` instead of `"Basic"`. That suffix helps Anki treat imported decks as separate note types rather than merging them with its own built-in types.

### Comparison

| Model                                | Fields                   | Cards per note     | Pick when…                                   |
| ------------------------------------ | ------------------------ | ------------------ | -------------------------------------------- |
| `BASIC_MODEL`                        | Front, Back              | 1                  | You only need question → answer study        |
| `BASIC_AND_REVERSED_CARD_MODEL`      | Front, Back              | 2 (always)         | You always want forward and reverse cards    |
| `BASIC_OPTIONAL_REVERSED_CARD_MODEL` | Front, Back, Add Reverse | 1 or 2             | Reverse cards only for some notes            |
| `BASIC_TYPE_IN_THE_ANSWER_MODEL`     | Front, Back              | 1                  | The learner types the answer before flipping |
| `CLOZE_MODEL`                        | Text, Back Extra         | 1 per cloze marker | You hide blanks inside a sentence or passage |

### `BASIC_MODEL`

**Fields:** `Front`, `Back`
**Cards:** 1 — shows `Front` on the question side and `Back` on the answer side.

The simplest model. One note becomes one card: you see the front, flip, and see the back.

**Use it for:** vocabulary (word → definition), facts (question → answer), or any one-way prompt.

```ts
deck.addNote(
  new Note({
    model: BASIC_MODEL,
    fields: ["Capital of Taiwan", "Taipei"],
  }),
);
```

### `BASIC_AND_REVERSED_CARD_MODEL`

**Fields:** `Front`, `Back`
**Cards:** 2 — always. Card 1 is Front → Back; card 2 is Back → Front.

Every note produces both directions. Studying `"你好"` → `"hello"` also schedules `"hello"` → `"你好"`.

**Use it for:** language pairs, symbols, or any content where recall should work both ways for every item.

```ts
deck.addNote(
  new Note({
    model: BASIC_AND_REVERSED_CARD_MODEL,
    fields: ["你好", "hello"],
  }),
);
```

### `BASIC_OPTIONAL_REVERSED_CARD_MODEL`

**Fields:** `Front`, `Back`, `Add Reverse`
**Cards:** 1 by default; 2 when `Add Reverse` is non-empty.

Same forward card as `BASIC_MODEL`. A second reverse card is created only when the third field has any text (for example `"y"`). Leave it as `""` for a single card.

**Use it for:** mixed decks where some items need reverse study (e.g. core vocabulary) and others do not (e.g. one-off trivia).

```ts
// One card: Front → Back only
deck.addNote(
  new Note({
    model: BASIC_OPTIONAL_REVERSED_CARD_MODEL,
    fields: ["Capital of France", "Paris", ""],
  }),
);

// Two cards: Front → Back and Back → Front
deck.addNote(
  new Note({
    model: BASIC_OPTIONAL_REVERSED_CARD_MODEL,
    fields: ["你好", "hello", "y"],
  }),
);
```

### `BASIC_TYPE_IN_THE_ANSWER_MODEL`

**Fields:** `Front`, `Back`
**Cards:** 1 — the front side includes a text box; the learner types what goes in `Back` before revealing the answer.

Anki checks the typed text against `Back` (with some tolerance for spacing and casing). The back side shows what was typed alongside the correct answer.

**Use it for:** spelling, production practice, or anything where actively writing the answer matters more than passive recognition.

```ts
deck.addNote(
  new Note({
    model: BASIC_TYPE_IN_THE_ANSWER_MODEL,
    fields: ["Capital of Japan", "Tokyo"],
  }),
);
```

### `CLOZE_MODEL`

**Fields:** `Text`, `Back Extra` (both required — use `""` for `Back Extra` when unused)
**Cards:** one card per cloze marker in `Text`.

Cloze cards hide part of a sentence. Mark blanks with `{{c1::hidden text}}`, `{{c2::another blank}}`, and so on. Each number (`c1`, `c2`, …) becomes its own card with that span hidden. Optional extra content on the answer side goes in `Back Extra`.

**Use it for:** fill-in-the-blank sentences, grammar in context, or recalling details inside a longer passage.

```ts
deck.addNote(
  new Note({
    model: CLOZE_MODEL,
    fields: ["{{c1::Ottawa}} is the capital of {{c2::Canada}}", ""],
  }),
);
```

This note creates two cards: one hiding `Ottawa`, one hiding `Canada`.

## Media Files

Media files are images, audio, or other files referenced from note fields.

```ts
const deck = new Deck({ id: 1234567890, name: "Media Deck" });

deck.addNote(
  new Note({
    model,
    fields: ["Listen: [sound:hello.mp3]", 'Image: <img src="hello.jpg">'],
  }),
);

await new Package(deck, {
  mediaFiles: ["./assets/hello.mp3", "./assets/hello.jpg"],
}).writeToFile("media-deck.apkg");
```

In note fields, reference media by filename only:

```ts
"[sound:hello.mp3]";
'<img src="hello.jpg">';
```

Do not include directories in the note field. The package copies files into the `.apkg` archive and writes Anki's media index for them.

Media filenames must be unique. For example, `audio/hello.mp3` and `backup/hello.mp3` cannot both be included because Anki only sees the basename `hello.mp3`.

## Tags

Tags can be attached to notes:

```ts
new Note({
  model,
  fields: ["Question", "Answer"],
  tags: ["geography", "capitals"],
});
```

Anki tags cannot contain spaces. Use underscores or hyphens instead:

```ts
tags: ["country_capitals"];
```

## Due Order And Suspended Cards

The `due` option sets the initial review order for new cards:

```ts
new Note({
  model,
  fields: ["Capital of Oregon", "Salem"],
  due: 1,
});
```

Cards can also be suspended before packaging:

```ts
const note = new Note({
  model,
  fields: ["Front", "Back"],
});

note.cards[0]!.suspend = true;
```

Suspended cards are imported into Anki but are not immediately scheduled for review.

## Validation

By default, non-fatal validation issues are logged with `console.warn`.

```ts
await new Package(deck).writeToFile("deck.apkg");
```

Use strict validation to turn those warnings into errors:

```ts
await new Package(deck).writeToFile("deck.apkg", {
  validation: "error",
});
```

This is useful in workers or CI jobs where bad input should fail the generation task.

One validation check looks for suspicious HTML-like text in fields. Anki field content is HTML, so raw `<`, `>`, or `&` characters should usually be escaped before packaging.

## Deterministic Output

`writeToFile` accepts a timestamp option. This is mainly useful in tests because note and card IDs are based on the timestamp.

```ts
await new Package(deck).writeToFile("deck.apkg", {
  timestamp: 0,
});
```

For normal app usage, omit `timestamp`.

## How It Works

An `.apkg` file is a ZIP archive with a specific structure that Anki understands.

This package writes:

- `collection.anki2`: a SQLite database containing decks, models, notes, and cards.
- `media`: a JSON map from numeric archive entries to media filenames.
- `0`, `1`, `2`, etc.: media file contents, when media files are included.

Internally:

1. `Package.writeToFile()` creates a temporary SQLite database.
2. It writes Anki's expected tables and default collection metadata.
3. Each `Deck` writes its deck metadata.
4. Each `Model` writes field and template definitions.
5. Each `Note` writes note fields and generates its cards.
6. The SQLite database and media files are zipped into the final `.apkg`.

The implementation uses:

- `better-sqlite3` for `collection.anki2`.
- `fflate` for ZIP creation.
- `mustache` only to approximate Anki's template rules when deciding whether a note should generate a card for a template.

Anki remains responsible for rendering cards during study.

## Differences From Python genanki

This package intentionally does not port every Python `genanki` feature.

- YAML model/template definitions are not supported. Use typed arrays.
- Anki add-on APIs are not supported. This package only writes `.apkg` files.
- Python subclass customization is replaced with constructor options and callbacks.
- `CLOZE_MODEL` requires both fields. The old single-field compatibility shim is not included.

## Example Script

Generate a sample deck you can import into Anki:

```bash
bun run --filter @handeck/genanki-ts example
```

This writes `packages/genanki-ts/examples/example.apkg` with three basic geography/math cards.

To choose a different output path:

```bash
bun run --filter @handeck/genanki-ts example -- /tmp/my-deck.apkg
```

## Testing

From the repository root:

```bash
bun run --filter @handeck/genanki-ts test
```

Or run the package script:

```bash
bun run test
```

The tests inspect generated ZIP archives and SQLite contents directly. They do not currently import packages into a real Anki runtime.
