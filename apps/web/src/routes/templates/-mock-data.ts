export type TemplateTableShape = {
  _id: string;
  userId: string;
  name: string;
  words: string[];
  configs: {
    topics: string[];
    sentences_per_word: number;
  };
};

export type MockTemplateUi = {
  creditCost?: number;
  baseTemplate?: string;
};

export type Template = TemplateTableShape & MockTemplateUi;

function mockWordIds(slug: string, count: number): string[] {
  return Array.from(
    { length: count },
    (_, i) => `mock_word:${slug}:${i}`,
  );
}

type Seed = {
  id: string;
  slug: string;
  name: string;
  wordCount: number;
  topics: string[];
  sentences_per_word: number;
  creditCost?: number;
  baseTemplate?: string;
};

const MOCK_SEEDS: Seed[] = [
  {
    id: "mock_template_1",
    slug: "hsk3-general",
    name: "HSK 3 - General Vocabulary",
    wordCount: 300,
    topics: ["travel", "food", "daily life"],
    sentences_per_word: 1,
    creditCost: 54,
    baseTemplate: "HSK 3",
  },
  {
    id: "mock_template_2",
    slug: "biz-essentials",
    name: "Business Mandarin Essentials",
    wordCount: 500,
    topics: ["formal", "business", "negotiation"],
    sentences_per_word: 2,
    creditCost: 72,
    baseTemplate: "HSK 4",
  },
  {
    id: "mock_template_3",
    slug: "sports-leisure",
    name: "Sports & Leisure",
    wordCount: 200,
    topics: ["sports", "leisure", "fitness"],
    sentences_per_word: 1,
    creditCost: 32,
  },
  {
    id: "mock_template_4",
    slug: "hsk2-daily",
    name: "HSK 2 - Beginner Daily",
    wordCount: 150,
    topics: ["daily life", "greetings", "numbers"],
    sentences_per_word: 1,
    creditCost: 28,
    baseTemplate: "HSK 2",
  },
  {
    id: "mock_template_5",
    slug: "travel-phrases",
    name: "Travel Phrases Pack",
    wordCount: 250,
    topics: ["travel", "transport", "hotels"],
    sentences_per_word: 1,
    creditCost: 44,
  },
  {
    id: "mock_template_6",
    slug: "advanced-reading",
    name: "Advanced Reading Comprehension",
    wordCount: 800,
    topics: ["literature", "formal", "culture"],
    sentences_per_word: 3,
    creditCost: 96,
    baseTemplate: "HSK 5",
  },
];

export const MOCK_TEMPLATES: Template[] = MOCK_SEEDS.map((s) => ({
  _id: s.id,
  userId: "mock_user_default",
  name: s.name,
  words: mockWordIds(s.slug, s.wordCount),
  configs: {
    topics: s.topics,
    sentences_per_word: s.sentences_per_word,
  },
  ...(s.creditCost !== undefined && { creditCost: s.creditCost }),
  ...(s.baseTemplate !== undefined && { baseTemplate: s.baseTemplate }),
}));

export const EMPTY_MOCK_TEMPLATES: Template[] = [];
