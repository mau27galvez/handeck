export const ModelType = {
  FrontBack: 0,
  Cloze: 1,
} as const;

export type ModelType = (typeof ModelType)[keyof typeof ModelType];

export type ModelField = {
  name: string;
  ord?: number;
  font?: string;
  media?: string[];
  rtl?: boolean;
  size?: number;
  sticky?: boolean;
};

export type ModelTemplate = {
  name: string;
  qfmt: string;
  afmt: string;
  ord?: number;
  bafmt?: string;
  bqfmt?: string;
  bfont?: string;
  bsize?: number;
  did?: number | null;
};

export type RequiredFieldRule = [
  templateOrd: number,
  requirement: "all" | "any",
  fieldOrds: number[],
];

export type ValidationMode = "warn" | "error";

export type WritePackageOptions = {
  timestamp?: number;
  validation?: ValidationMode;
};

export type ValidationContext = {
  validation: ValidationMode;
};

export type NoteValueResolver = (note: { fields: string[]; model: unknown }) => string;

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };
