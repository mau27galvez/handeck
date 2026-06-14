import { db } from "@handeck/db";
import { decks, notes } from "@handeck/db/schema";
import { v4 } from "uuid";
import { writeDeckPackageToVoid } from "./deckPackage";

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

type TemplateWord = {
  id: string;
  simplifiedHanzi: string;
  diacriticPinyin: string;
  meaning: string;
};

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

  const result = await db.transaction(async (tx) => {
    const { template, templateWords } = await getTemplateAndWords(tx, templateId);

    if (templateWords.length === 0) throw new Error("Add words before generating a deck");

    await insertDeck(tx, { deckId, userId, templateId, now });
    await insertNotes(tx, { deckId, templateWords, now });

    return {
      deckId,
      templateName: template.name,
      notes: templateWords,
    };
  });

  await writeDeckPackageToVoid(result);
  return result;
}

async function getTemplateAndWords(tx: DbTx, templateId: string) {
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

  const templateWordsForDeck: TemplateWord[] = template.templateWords.map(({ word }) => word);

  return { template, templateWords: templateWordsForDeck };
}

async function insertDeck(
  tx: DbTx,
  {
    deckId,
    userId,
    templateId,
    now,
  }: {
    deckId: string;
    userId: string;
    templateId: string;
    now: Date;
  },
) {
  await tx.insert(decks).values({
    id: deckId,
    userId,
    templateId,
    createdAt: now,
    updatedAt: now,
  });
}

async function insertNotes(
  tx: DbTx,
  {
    deckId,
    templateWords,
    now,
  }: {
    deckId: string;
    templateWords: TemplateWord[];
    now: Date;
  },
) {
  await tx.insert(notes).values(
    templateWords.map((word) => ({
      id: v4(),
      deckId,
      wordId: word.id,
      createdAt: now,
      updatedAt: now,
    })),
  );
}
