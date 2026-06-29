type DeckGenerationProgressInput = {
  status: "queued" | "generating" | "completed" | "failed";
  sentenceBatchTotal: number;
  sentenceBatchCompleted: number;
  sentenceAudioTotal: number;
  sentenceAudioCompleted: number;
  wordAudioTotal: number;
  wordAudioCompleted: number;
};

export function getDeckGenerationProgressRatio({
  status,
  sentenceBatchTotal,
  sentenceBatchCompleted,
  sentenceAudioTotal,
  sentenceAudioCompleted,
  wordAudioTotal,
  wordAudioCompleted,
}: DeckGenerationProgressInput) {
  const total = sentenceBatchTotal + sentenceAudioTotal + wordAudioTotal;
  if (total === 0) return status === "completed" ? 1 : 0;

  return (sentenceBatchCompleted + sentenceAudioCompleted + wordAudioCompleted) / total;
}
