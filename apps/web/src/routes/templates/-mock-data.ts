export type TemplateTableShape = {
  _id: string;
  userId: string;
  name: string;
  words: string[];
  configs: {
    topics: string[];
    sentencesPerWord: number;
  };
};

export type MockTemplateUi = {
  creditCost?: number;
  baseTemplate?: string;
};

export type Template = TemplateTableShape & MockTemplateUi;

function mockWordIds(templateId: string, count: number): string[] {
  return Array.from(
    { length: count },
    (_, i) => `mock_word:${templateId}:${i}`,
  );
}

type Seed = {
  id: string;
  name: string;
  wordCount: number;
  topics: string[];
  sentencesPerWord: number;
  creditCost?: number;
  baseTemplate?: string;
};

const MOCK_SEEDS: Seed[] = [
  {
    id: "mock_template_1",
    name: "HSK 3 - General Vocabulary",
    wordCount: 300,
    topics: ["travel", "food", "daily life"],
    sentencesPerWord: 1,
    creditCost: 54,
    baseTemplate: "HSK 3",
  },
  {
    id: "mock_template_2",
    name: "Business Mandarin Essentials",
    wordCount: 500,
    topics: ["formal", "business", "negotiation"],
    sentencesPerWord: 2,
    creditCost: 72,
    baseTemplate: "HSK 4",
  },
  {
    id: "mock_template_3",
    name: "Sports & Leisure",
    wordCount: 200,
    topics: ["sports", "leisure", "fitness"],
    sentencesPerWord: 1,
    creditCost: 32,
  },
  {
    id: "mock_template_4",
    name: "HSK 2 - Beginner Daily",
    wordCount: 150,
    topics: ["daily life", "greetings", "numbers"],
    sentencesPerWord: 1,
    creditCost: 28,
    baseTemplate: "HSK 2",
  },
  {
    id: "mock_template_5",
    name: "Travel Phrases Pack",
    wordCount: 250,
    topics: ["travel", "transport", "hotels"],
    sentencesPerWord: 1,
    creditCost: 44,
  },
  {
    id: "mock_template_6",
    name: "Advanced Reading Comprehension",
    wordCount: 800,
    topics: ["literature", "formal", "culture"],
    sentencesPerWord: 3,
    creditCost: 96,
    baseTemplate: "HSK 5",
  },
];

export const MOCK_TEMPLATES: Template[] = MOCK_SEEDS.map((s) => ({
  _id: s.id,
  userId: "mock_user_default",
  name: s.name,
  words: mockWordIds(s.id, s.wordCount),
  configs: {
    topics: s.topics,
    sentencesPerWord: s.sentencesPerWord,
  },
  ...(s.creditCost !== undefined && { creditCost: s.creditCost }),
  ...(s.baseTemplate !== undefined && { baseTemplate: s.baseTemplate }),
}));

export const EMPTY_MOCK_TEMPLATES: Template[] = [];
