import { describe, expect, test, vi } from "vite-plus/test";

import {
  BASIC_MODEL,
  BASIC_OPTIONAL_REVERSED_CARD_MODEL,
  BASIC_TYPE_IN_THE_ANSWER_MODEL,
  CLOZE_MODEL,
  Deck,
  Model,
  ModelType,
  Note,
  Package,
  guidFor,
} from "../src";

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

const TEST_MODEL_WITH_HINT = new Model({
  id: 456789,
  name: "with hint",
  fields: [{ name: "Question" }, { name: "Hint" }, { name: "Answer" }],
  templates: [
    {
      name: "card1",
      qfmt: "{{Question}}{{#Hint}}<br>Hint: {{Hint}}{{/Hint}}",
      afmt: "{{Answer}}",
    },
  ],
});

describe("Model required fields", () => {
  test("computes all requirements", () => {
    expect(TEST_MODEL.requiredFields).toEqual([[0, "all", [0]]]);
    expect(TEST_CN_MODEL.requiredFields).toEqual([
      [0, "all", [0]],
      [1, "all", [1]],
    ]);
  });

  test("computes any requirements for optional sections", () => {
    expect(TEST_MODEL_WITH_HINT.requiredFields).toEqual([[0, "any", [0, 1]]]);
  });

  test("treats Anki field filters as references to the underlying field", () => {
    expect(BASIC_TYPE_IN_THE_ANSWER_MODEL.requiredFields).toEqual([[0, "any", [0, 1]]]);
    expect(CLOZE_MODEL.toJson(0, 0).type).toBe(ModelType.Cloze);
    expect(CLOZE_MODEL.requiredFields).toEqual([[0, "all", [0]]]);
  });
});

describe("Note cards", () => {
  test("generates front/back cards based on required fields", () => {
    const n1 = new Note({ model: TEST_CN_MODEL, fields: ["中國", "中国", "China"] });
    const n2 = new Note({ model: TEST_CN_MODEL, fields: ["你好", "", "hello"] });

    expect(n1.cards.map((card) => card.ord)).toEqual([0, 1]);
    expect(n2.cards.map((card) => card.ord)).toEqual([0]);
  });

  test("generates optional reversed cards based on section fields", () => {
    const noReverse = new Note({
      model: BASIC_OPTIONAL_REVERSED_CARD_MODEL,
      fields: ["France", "Paris", ""],
    });
    const reverse = new Note({
      model: BASIC_OPTIONAL_REVERSED_CARD_MODEL,
      fields: ["France", "Paris", "y"],
    });

    expect(noReverse.cards.map((card) => card.ord)).toEqual([0]);
    expect(reverse.cards.map((card) => card.ord)).toEqual([0, 1]);
  });

  test("generates cloze cards", () => {
    const note = new Note({
      model: CLOZE_MODEL,
      fields: ["NOTE TWO: {{c1::1st deletion}} {{c2::2nd deletion}} {{c3::3rd deletion}}", ""],
    });

    expect(note.cards.map((card) => card.ord).sort()).toEqual([0, 1, 2]);
  });

  test("generates cloze cards for repeated and multiline deletions", () => {
    const repeated = new Note({
      model: CLOZE_MODEL,
      fields: [
        "NOTE FOUR: {{c1::1st deletion}} foo {{c2::2nd deletion}} bar {{c1::3rd deletion}}",
        "",
      ],
    });
    const multiline = new Note({
      model: CLOZE_MODEL,
      fields: [
        "{{c1::Washington, D.C.}} is the capital of {{c2::the\nUnited States\nof America}}",
        "",
      ],
    });

    expect(repeated.cards.map((card) => card.ord).sort()).toEqual([0, 1]);
    expect(multiline.cards.map((card) => card.ord).sort()).toEqual([0, 1]);
  });

  test("does not require cloze indexes to start at one", () => {
    const note = new Note({
      model: CLOZE_MODEL,
      fields: ["{{c2::Mitochondria}} are the {{c3::powerhouses}} of the cell", ""],
    });

    expect(note.cards.map((card) => card.ord).sort()).toEqual([1, 2]);
  });
});

describe("Note validation", () => {
  test("validates tags", () => {
    expect(
      () => new Note({ model: TEST_MODEL, fields: ["a", "b"], tags: ["foo", "b ar"] }),
    ).toThrow();

    const note = new Note({ model: TEST_MODEL, fields: ["a", "b"], tags: ["foo"] });
    expect(() => note.tags.push("b ar")).toThrow();
    expect(() => {
      note.tags[0] = "b ar";
    }).toThrow();
  });

  test("validates field count on write", async () => {
    const deck = new Deck({ id: 123456, name: "foodeck" });
    deck.addNote(new Note({ model: TEST_MODEL, fields: ["a"] }));

    await expect(new Package(deck).writeToFile("/tmp/genanki-ts-invalid.apkg")).rejects.toThrow(
      "Number of fields in Model does not match number of fields in Note",
    );
  });

  test("requires both cloze fields", async () => {
    const deck = new Deck({ id: 123456, name: "foodeck" });
    deck.addNote(
      new Note({ model: CLOZE_MODEL, fields: ["{{c1::Rome}} is the capital of Italy"] }),
    );

    await expect(
      new Package(deck).writeToFile("/tmp/genanki-ts-invalid-cloze.apkg"),
    ).rejects.toThrow("Number of fields in Model does not match number of fields in Note");
  });

  test("warns on invalid HTML tags by default and throws in strict mode", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    try {
      const warnDeck = new Deck({ id: 123456, name: "foodeck" });
      warnDeck.addNote(
        new Note({ model: TEST_MODEL, fields: ["Capital of <$> Argentina", "Buenos Aires"] }),
      );

      await new Package(warnDeck).writeToFile("/tmp/genanki-ts-warn.apkg");
      expect(warn).toHaveBeenCalledTimes(1);

      const strictDeck = new Deck({ id: 123457, name: "strictdeck" });
      strictDeck.addNote(
        new Note({ model: TEST_MODEL, fields: ["Capital of <$> Argentina", "Buenos Aires"] }),
      );

      await expect(
        new Package(strictDeck).writeToFile("/tmp/genanki-ts-strict.apkg", { validation: "error" }),
      ).rejects.toThrow("Field contained the following invalid HTML tags");
    } finally {
      warn.mockRestore();
    }
  });

  test("does not warn on HTML-like text in guid", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const deck = new Deck({ id: 123456, name: "foodeck" });
    deck.addNote(
      new Note({
        model: BASIC_MODEL,
        fields: ["Capital of Iowa", "Des Moines"],
        guid: "Gt<p8{N2>Z",
      }),
    );

    try {
      await new Package(deck).writeToFile("/tmp/genanki-ts-guid.apkg");
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});

describe("Utilities", () => {
  test("guidFor is stable", () => {
    expect(guidFor("Capital of Argentina", "Buenos Aires")).toBe(
      guidFor("Capital of Argentina", "Buenos Aires"),
    );
    expect(guidFor("Capital of Argentina", "Buenos Aires")).not.toBe(
      guidFor("Capital of Argentina"),
    );
  });

  test("supports callback guid and sortField", () => {
    const note = new Note({
      model: TEST_MODEL,
      fields: ["a", "b"],
      guid: ({ fields }) => guidFor(fields[0]),
      sortField: ({ fields }) => fields[1] ?? "",
    });

    expect(note.guid).toBe(guidFor("a"));
    expect(note.sortField).toBe("b");
  });
});
