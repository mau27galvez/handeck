import Mustache from "mustache";

import {
  type JsonValue,
  type ModelField,
  ModelType,
  type ModelTemplate,
  type RequiredFieldRule,
} from "./types";

export type ModelOptions = {
  id: number;
  name: string;
  fields: ModelField[];
  templates: ModelTemplate[];
  css?: string;
  modelType?: ModelType;
  latexPre?: string;
  latexPost?: string;
  sortFieldIndex?: number;
};

export class Model {
  static readonly FrontBack = ModelType.FrontBack;
  static readonly Cloze = ModelType.Cloze;

  static readonly defaultLatexPre =
    "\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n\\usepackage[utf8]{inputenc}\n" +
    "\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0in}\n" +
    "\\begin{document}\n";

  static readonly defaultLatexPost = "\\end{document}";

  readonly id: number;
  readonly name: string;
  readonly fields: ModelField[];
  readonly templates: ModelTemplate[];
  readonly css: string;
  readonly modelType: ModelType;
  readonly latexPre: string;
  readonly latexPost: string;
  readonly sortFieldIndex: number;

  #requiredFields?: RequiredFieldRule[];

  constructor(options: ModelOptions) {
    this.id = options.id;
    this.name = options.name;
    this.fields = options.fields;
    this.templates = options.templates;
    this.css = options.css ?? "";
    this.modelType = options.modelType ?? ModelType.FrontBack;
    this.latexPre = options.latexPre ?? Model.defaultLatexPre;
    this.latexPost = options.latexPost ?? Model.defaultLatexPost;
    this.sortFieldIndex = options.sortFieldIndex ?? 0;
  }

  get requiredFields() {
    this.#requiredFields ??= this.#computeRequiredFields();
    return this.#requiredFields;
  }

  toJson(timestamp: number, deckId: number) {
    const templates = this.templates.map((template, ord) => ({
      ...template,
      ord,
      bafmt: template.bafmt ?? "",
      bqfmt: template.bqfmt ?? "",
      bfont: template.bfont ?? "",
      bsize: template.bsize ?? 0,
      did: template.did ?? null,
    }));

    const fields = this.fields.map((field, ord) => ({
      ...field,
      ord,
      font: field.font ?? "Liberation Sans",
      media: field.media ?? [],
      rtl: field.rtl ?? false,
      size: field.size ?? 20,
      sticky: field.sticky ?? false,
    }));

    return {
      css: this.css,
      did: deckId,
      flds: fields,
      id: String(this.id),
      latexPost: this.latexPost,
      latexPre: this.latexPre,
      latexsvg: false,
      mod: Math.trunc(timestamp),
      name: this.name,
      req: this.requiredFields,
      sortf: this.sortFieldIndex,
      tags: [],
      tmpls: templates,
      type: this.modelType,
      usn: -1,
      vers: [],
    } satisfies Record<string, JsonValue>;
  }

  #computeRequiredFields() {
    const sentinel = "SeNtInEl";
    const fieldNames = this.fields.map((field) => field.name);
    const requiredFields: RequiredFieldRule[] = [];

    for (const [templateOrd, template] of this.templates.entries()) {
      const allRequired: number[] = [];
      const qfmt = normalizeAnkiFieldFilters(template.qfmt, fieldNames);

      for (const [fieldOrd, field] of fieldNames.entries()) {
        const fieldValues = Object.fromEntries(fieldNames.map((name) => [name, sentinel]));
        fieldValues[field] = "";

        const rendered = Mustache.render(qfmt, fieldValues);
        if (!rendered.includes(sentinel)) {
          allRequired.push(fieldOrd);
        }
      }

      if (allRequired.length > 0) {
        requiredFields.push([templateOrd, "all", allRequired]);
        continue;
      }

      const anyRequired: number[] = [];
      for (const [fieldOrd, field] of fieldNames.entries()) {
        const fieldValues = Object.fromEntries(fieldNames.map((name) => [name, ""]));
        fieldValues[field] = sentinel;

        const rendered = Mustache.render(qfmt, fieldValues);
        if (rendered.includes(sentinel)) {
          anyRequired.push(fieldOrd);
        }
      }

      if (anyRequired.length === 0) {
        throw new Error(
          `Could not compute required fields for this template; please check the qfmt: ${JSON.stringify(template)}`,
        );
      }

      requiredFields.push([templateOrd, "any", anyRequired]);
    }

    return requiredFields;
  }
}

function normalizeAnkiFieldFilters(template: string, fieldNames: string[]) {
  let normalized = template;

  for (const fieldName of fieldNames) {
    const escapedFieldName = escapeRegExp(fieldName);
    normalized = normalized.replace(
      new RegExp(`{{\\s*([#/^]?)(?:[\\w-]+:)+${escapedFieldName}\\s*}}`, "g"),
      "{{$1" + fieldName + "}}",
    );
  }

  return normalized;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
