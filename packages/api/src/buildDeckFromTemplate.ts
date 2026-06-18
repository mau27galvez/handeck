import { db } from "@handeck/db";
import { decks, notes, sentenceNotes, sentences as sentencesTable } from "@handeck/db/schema";
import { env } from "@handeck/env/server";
import { v4 } from "uuid";
import { writeDeckPackageToS3 } from "./deckPackage";
import { OpenRouter } from "@openrouter/sdk";
import z from "zod";

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

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

    const notesBySimplifiedHanzi = new Map(
      notesToInsert.map((note) => [note.simplifiedHanzi, note]),
    );
    const notesHanzi = Array.from(notesBySimplifiedHanzi.keys());
    const sentences = new Map<string, string>();

    const sentenceBatches = chunk(notesHanzi, SENTENCE_GENERATION_PROMPT_BATCH_SIZE);

    for (let i = 0; i < sentenceBatches.length; i += MAX_CONCURRENT_SENTENCE_GENERATION_REQUESTS) {
      const concurrentBatches = sentenceBatches.slice(
        i,
        i + MAX_CONCURRENT_SENTENCE_GENERATION_REQUESTS,
      );

      const generations = await Promise.all(
        concurrentBatches.map((batch) => generateSentences(batch)),
      );

      for (const generation of generations) {
        generation.forEach((sentence, word) => {
          sentences.set(word, sentence);
        });
      }
    }

    const sentencesToInsert = sentences
      .values()
      .map((sentence) => ({
        id: v4(),
        simplifiedHanzi: sentence,
        createdAt: now,
      }))
      .toArray();

    await tx.insert(sentencesTable).values(sentencesToInsert);

    const sentenceNotesToInsert = sentencesToInsert.map((sentence) => ({
      id: v4(),
      sentenceId: sentence.id,
      noteId: notesBySimplifiedHanzi.get(sentence.simplifiedHanzi)!.id,
      createdAt: now,
      updatedAt: now,
    }));

    await tx.insert(sentenceNotes).values(sentenceNotesToInsert);

    const notesWithSentences = notesToInsert.map((note) => ({
      ...note,
      sentence: sentences.get(note.simplifiedHanzi),
    }));

    await writeDeckPackageToS3({
      deckId,
      userId,
      templateName: template.name,
      notes: notesWithSentences,
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

const SENTENCE_GENERATION_PROMPT_BATCH_SIZE = 10;
const MAX_CONCURRENT_SENTENCE_GENERATION_REQUESTS = 10;
const OPENROUTER_MODEL = "deepseek/deepseek-v4-flash";
const generationResponseSchema = z.object({
  words: z.array(
    z.object({
      word: z.string(),
      sentence: z.string(),
    }),
  ),
});

const client = new OpenRouter({
  apiKey: env.OPENROUTER_API_KEY,
});

async function generateSentences(words: string[]) {
  const response = await client.chat.send({
    chatRequest: {
      model: OPENROUTER_MODEL,
      responseFormat: {
        type: "json_schema",
        jsonSchema: {
          name: "chinese_sentence_batch",
          strict: true,
          schema: generationResponseSchema.toJSONSchema(),
        },
      },
      messages: [
        {
          role: "system",
          content: `
                You generate natural Mandarin Chinese sentences for foreign students learning Chinese. Prefer standard, clear, and slightly formal Chinese over slang, dialect, or overly casual phrasing. Avoid generic textbook sentences and very common facts unless they are the most natural choice. Vary sentence structure, setting, verb choice, and perspective across generations. Every generated Chinese sentence must contain the provided word exactly. Return only JSON matching the provided schema.
                `,
        },
        { role: "user", content: JSON.stringify(words) },
      ],
    },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("No response from OpenRouter");

  const parsed = generationResponseSchema.parse(JSON.parse(content));
  const cleanResponse = new Map(parsed.words.map((word) => [word.word, word.sentence]));

  return cleanResponse;
}

function chunk<T>(items: T[], size: number) {
  const batches: T[][] = [];

  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }

  return batches;
}
