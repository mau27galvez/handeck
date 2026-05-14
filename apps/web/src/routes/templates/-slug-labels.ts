/** Display labels for baseTemplate names until the catalog has a label column. */
export const BASE_TEMPLATE_SLUG_LABELS: Record<string, string> = {
  "hsk-1": "HSK 1",
  "hsk-2": "HSK 2",
  "hsk-3": "HSK 3",
  "hsk-4": "HSK 4",
  "hsk-5": "HSK 5",
  "hsk-6": "HSK 6",
};

export function labelForBaseTemplateSlug(slug: string): string {
  return BASE_TEMPLATE_SLUG_LABELS[slug] ?? slug;
}
