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
