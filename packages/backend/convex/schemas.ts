import { z } from "zod";

export const templateConfigsSchema = z.object({
  topics: z.array(z.string()),
  sentencesPerWord: z.number().int().min(1),
});

export type TemplateConfigs = z.infer<typeof templateConfigsSchema>;

export const DEFAULT_CONFIGS: TemplateConfigs = {
  topics: [],
  sentencesPerWord: 1,
};

export const AVAILABLE_SENTENCE_TOPICS = [
  "Daily conversation",
  "Travel",
  "Work",
  "Food",
  "Family",
] as const;

export type SentenceTopic = (typeof AVAILABLE_SENTENCE_TOPICS)[number];

const allowedTopicSet = new Set<string>(AVAILABLE_SENTENCE_TOPICS);

export function isAllowedSentenceTopic(topic: string): topic is SentenceTopic {
  return allowedTopicSet.has(topic);
}

export function filterAllowedTopics(topics: string[]): SentenceTopic[] {
  return topics.filter(isAllowedSentenceTopic);
}

export function sanitizeTemplateConfigs(configs: TemplateConfigs): TemplateConfigs {
  return {
    sentencesPerWord: configs.sentencesPerWord,
    topics: filterAllowedTopics(configs.topics),
  };
}

export type ReadinessStepId = "words" | "topics" | "sentences";

export type ReadinessStep = {
  id: ReadinessStepId;
  label: string;
  complete: boolean;
  hint?: string;
};

export function hasLegacyTopics(topics: string[]): boolean {
  return topics.some((topic) => !isAllowedSentenceTopic(topic));
}

export function getTemplateReadiness(input: { wordsCount: number; configs: TemplateConfigs }): {
  ready: boolean;
  steps: ReadinessStep[];
  issues: string[];
} {
  const parsed = templateConfigsSchema.safeParse(input.configs);
  const sentencesComplete = parsed.success && parsed.data.sentencesPerWord >= 1;
  const topicsComplete = parsed.success && parsed.data.topics.length >= 1;
  const wordsComplete = input.wordsCount >= 1;

  const steps: ReadinessStep[] = [
    {
      id: "words",
      label: "Words added",
      complete: wordsComplete,
      hint: wordsComplete ? undefined : "Add words in the Words panel",
    },
    {
      id: "topics",
      label: "Sentence topics selected",
      complete: topicsComplete,
      hint: topicsComplete ? undefined : "Select at least one sentence topic",
    },
    {
      id: "sentences",
      label: "Sentences per word set",
      complete: sentencesComplete,
      hint: sentencesComplete ? undefined : "Sentences per word must be at least 1",
    },
  ];

  const issues = steps.flatMap((step) => (step.complete || !step.hint ? [] : [step.hint]));
  const ready = steps.every((step) => step.complete);

  return { ready, steps, issues };
}

export function validateTemplateForGeneration(input: {
  wordsCount: number;
  configs: TemplateConfigs;
}): { valid: boolean; issues: string[] } {
  const { ready, issues } = getTemplateReadiness(input);
  return { valid: ready, issues };
}
