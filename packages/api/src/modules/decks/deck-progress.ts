type DeckGenerationProgressInput = {
  status: "queued" | "generating" | "completed" | "failed";
  sentenceBatchTotal: number;
  sentenceBatchCompleted: number;
  wordAudioTotal: number;
  wordAudioCompleted: number;
};

export function getDeckGenerationProgressRatio({
  status,
  sentenceBatchTotal,
  sentenceBatchCompleted,
  wordAudioTotal,
  wordAudioCompleted,
}: DeckGenerationProgressInput) {
  const total = sentenceBatchTotal + wordAudioTotal;
  if (total === 0) return status === "completed" ? 1 : 0;

  return (sentenceBatchCompleted + wordAudioCompleted) / total;
}
