import { z } from "zod";

export const templateConfigsSchema = z.object({
  topics: z.array(z.string()),
  sentences_per_word: z.number(),
});

export type TemplateConfigs = z.infer<typeof templateConfigsSchema>;

export const DEFAULT_CONFIGS: TemplateConfigs = {
  topics: [],
  sentences_per_word: 1,
};
