import { db } from "@handeck/db";
import {
  decksTable,
  notesTable,
  sentenceNotesTable,
  sentencesTable,
  wordsTable,
} from "@handeck/db/schema";
import { env } from "@handeck/env/server";
import { v4 } from "uuid";
import { writeDeckPackageToS3 } from "./deckPackage";
import { OpenRouter } from "@openrouter/sdk";
import z from "zod";
import { getTemplateWithWords } from "./modules/templates/template-use-cases";
import { chunk, pcmToWav } from "./utils";
import { segment, OutputFormat, addDict } from "pinyin-pro";
import CompleteDict from "@pinyin-pro/data/complete";
import { GoogleGenAI } from "@google/genai";
import { getWordAudioObjectKey, uploadAudioFile } from "./deckStorage";
import { sql } from "drizzle-orm";

/**
 * IMPORTANT
 * This must be called before every call to the pinyin-pro library.
 * If we ever use it outside of this file, we have to add this there too.
 * Or centralize the call to addDict and run it before any call to pinyin-pro.
 */
addDict(CompleteDict);

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

    await tx.insert(decksTable).values({
      id: deckId,
      userId,
      templateId,
      createdAt: now,
      updatedAt: now,
    });

    await tx.insert(notesTable).values(notesToInsert);

    const wordsWithoutAudio = template.templateWords
      .map((word) => word.word)
      .filter((word) => word.audioUrl == null);

    const client = new GoogleGenAI({
      apiKey: env.GEMINI_API_KEY,
    });

    const wordAudioMap = await Promise.all(
      wordsWithoutAudio.map(async (word) => {
        const interaction = await client.interactions.create({
          model: "gemini-3.1-flash-tts-preview",
          input: `
          ## Sample Context:
          Add some space at the beggining and at the end. So the pronunciation can be clearly be ear from start to finish.

          As in xing1

          ## Transcript:
          行
          `,
          response_format: { type: "audio" },
          generation_config: {
            speech_config: [{ voice: "Kore" }],
          },
        });

        const audioData = interaction.output_audio?.data;
        if (!audioData) {
          throw new Error("No audio data from Gemini");
        }

        return {
          wordId: word.id,
          audioBuffer: Buffer.from(audioData, "base64"),
        };
      }),
    );

    const audioBuffers = new Map(
      wordAudioMap.map((wordAudio) => [wordAudio.wordId, wordAudio.audioBuffer]),
    );

    const audioFiles = new Map(
      audioBuffers.entries().map(([wordId, audioBuffer]) => [wordId, pcmToWav(audioBuffer)]),
    );

    await Promise.all(
      audioFiles
        .entries()
        .map(([wordId, audioBuffer]) =>
          uploadAudioFile(getWordAudioObjectKey(wordId), audioBuffer),
        ),
    );

    if (audioFiles.size > 0) {
      const valueRows = Array.from(audioFiles.keys()).map(
        (wordId) => sql`(${wordId}, ${getWordAudioObjectKey(wordId)})`,
      );

      await tx.execute(sql`
        UPDATE ${wordsTable} AS w
        SET
          audio_url = updates.audio_url,
          updated_at = ${now}
        FROM (
          VALUES ${sql.join(valueRows, sql`, `)}
        ) AS updates(id, audio_url)
        WHERE w.id = updates.id::uuid
      `);
    }

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

    const sentencesToInsert = Array.from(sentences.entries()).map(([wordHanzi, sentence]) => ({
      id: v4(),
      wordHanzi,
      simplifiedHanzi: sentence,
      diacriticPinyin: segment(sentence, {
        format: OutputFormat.PinyinString,
      }),
      createdAt: now,
    }));

    await tx.insert(sentencesTable).values(sentencesToInsert);

    const sentenceNotesToInsert = sentencesToInsert.map((sentence) => ({
      id: v4(),
      sentenceId: sentence.id,
      noteId: notesBySimplifiedHanzi.get(sentence.wordHanzi)!.id,
      createdAt: now,
      updatedAt: now,
    }));

    await tx.insert(sentenceNotesTable).values(sentenceNotesToInsert);

    const notesWithSentences = notesToInsert.map((note) => ({
      ...note,
      sentence: sentences.get(note.simplifiedHanzi)!,
    }));

    await writeDeckPackageToS3({
      deckId,
      userId,
      templateName: template.name,
      notes: notesWithSentences,
    });
  });
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
