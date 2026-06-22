import { db } from "@handeck/db";

export type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export function chunk<T>(items: T[], size: number) {
  const batches: T[][] = [];

  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }

  return batches;
}

const GEMINI_TTS_SAMPLE_RATE = 24_000;
const GEMINI_TTS_CHANNELS = 1;
const GEMINI_TTS_BIT_DEPTH = 16;

export function pcmToWav(
  pcm: Buffer,
  {
    sampleRate = GEMINI_TTS_SAMPLE_RATE,
    channels = GEMINI_TTS_CHANNELS,
    bitDepth = GEMINI_TTS_BIT_DEPTH,
  } = {},
) {
  const bytesPerSample = bitDepth / 8;
  const blockAlign = channels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const header = Buffer.alloc(44);

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitDepth, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);

  return Buffer.concat([header, pcm]);
}
