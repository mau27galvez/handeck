import { db } from "@handeck/db";
import { decks, notes } from "@handeck/db/schema";
import { env } from "@handeck/env/server";
import { v4 } from "uuid";
import { writeDeckPackageToS3 } from "./deckPackage";
import { OpenRouter } from "@openrouter/sdk";

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

type TemplateWord = {
  id: string;
  simplifiedHanzi: string;
  diacriticPinyin: string;
  meaning: string;
};

const SENTENCE_GENERATION_PROMPT_BATCH_SIZE = 10;
const OPENROUTER_MODEL = "deepseek/deepseek-v4-flash";

const client = new OpenRouter({
  apiKey: env.OPENROUTER_API_KEY,
});

export async function buildDeckFromTemplate({
  deckId,
  templateId,
  userId,
}: {
  deckId: string;
  templateId: string;
  userId: string;
}) {
  const now = new Date();

  return db.transaction(async (tx) => {
    const template = await getTemplateWithWords(tx, templateId);

    if (template.templateWords.length === 0) throw new Error("Add words before generating a deck");

    const notesToInsert = template.templateWords.map((word) => ({
      id: v4(),
      deckId,
      wordId: word.wordId,
      simplifiedHanzi: word.word.simplifiedHanzi,
      diacriticPinyin: word.word.diacriticPinyin,
      meaning: word.word.meaning,
      createdAt: now,
      updatedAt: now,
    }));

    await tx.insert(decks).values({
      id: deckId,
      userId,
      templateId,
      createdAt: now,
      updatedAt: now,
    });

    await tx.insert(notes).values(notesToInsert);

    await writeDeckPackageToS3({
      deckId,
      userId,
      templateName: template.name,
      notes: notesToInsert,
    });
  });
}

async function getTemplateWithWords(tx: DbTx, templateId: string) {
  const template = await tx.query.templates.findFirst({
    where: (template, { eq }) => eq(template.id, templateId),
    with: {
      templateWords: {
        with: {
          word: true,
        },
      },
    },
  });
  if (!template) throw new Error("Template not found");

  return template;
}
