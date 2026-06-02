import { Model } from "./model";
import { ModelType } from "./types";

const BASIC_CSS = `.card {
  font-family: arial;
  font-size: 20px;
  text-align: center;
  color: black;
  background-color: white;
}
`;

export const BASIC_MODEL = new Model({
  id: 1559383000,
  name: "Basic (genanki)",
  fields: [
    { name: "Front", font: "Arial" },
    { name: "Back", font: "Arial" },
  ],
  templates: [
    {
      name: "Card 1",
      qfmt: "{{Front}}",
      afmt: "{{FrontSide}}\n\n<hr id=answer>\n\n{{Back}}",
    },
  ],
  css: BASIC_CSS,
});

export const BASIC_AND_REVERSED_CARD_MODEL = new Model({
  id: 1485830179,
  name: "Basic (and reversed card) (genanki)",
  fields: [
    { name: "Front", font: "Arial" },
    { name: "Back", font: "Arial" },
  ],
  templates: [
    {
      name: "Card 1",
      qfmt: "{{Front}}",
      afmt: "{{FrontSide}}\n\n<hr id=answer>\n\n{{Back}}",
    },
    {
      name: "Card 2",
      qfmt: "{{Back}}",
      afmt: "{{FrontSide}}\n\n<hr id=answer>\n\n{{Front}}",
    },
  ],
  css: BASIC_CSS,
});

export const BASIC_OPTIONAL_REVERSED_CARD_MODEL = new Model({
  id: 1382232460,
  name: "Basic (optional reversed card) (genanki)",
  fields: [
    { name: "Front", font: "Arial" },
    { name: "Back", font: "Arial" },
    { name: "Add Reverse", font: "Arial" },
  ],
  templates: [
    {
      name: "Card 1",
      qfmt: "{{Front}}",
      afmt: "{{FrontSide}}\n\n<hr id=answer>\n\n{{Back}}",
    },
    {
      name: "Card 2",
      qfmt: "{{#Add Reverse}}{{Back}}{{/Add Reverse}}",
      afmt: "{{FrontSide}}\n\n<hr id=answer>\n\n{{Front}}",
    },
  ],
  css: BASIC_CSS,
});

export const BASIC_TYPE_IN_THE_ANSWER_MODEL = new Model({
  id: 1305534440,
  name: "Basic (type in the answer) (genanki)",
  fields: [
    { name: "Front", font: "Arial" },
    { name: "Back", font: "Arial" },
  ],
  templates: [
    {
      name: "Card 1",
      qfmt: "{{Front}}\n\n{{type:Back}}",
      afmt: "{{Front}}\n\n<hr id=answer>\n\n{{type:Back}}",
    },
  ],
  css: BASIC_CSS,
});

export const CLOZE_MODEL = new Model({
  id: 1550428389,
  name: "Cloze (genanki)",
  modelType: ModelType.Cloze,
  fields: [
    { name: "Text", font: "Arial" },
    { name: "Back Extra", font: "Arial" },
  ],
  templates: [
    {
      name: "Cloze",
      qfmt: "{{cloze:Text}}",
      afmt: "{{cloze:Text}}<br>\n{{Back Extra}}",
    },
  ],
  css:
    `${BASIC_CSS}\n` +
    `.cloze {
 font-weight: bold;
 color: blue;
}
.nightMode .cloze {
 color: lightblue;
}`,
});
