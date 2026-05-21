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
