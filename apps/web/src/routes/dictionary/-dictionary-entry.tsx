import type { Doc } from "@handeck/backend/convex/_generated/dataModel";
import type { ReactNode } from "react";

export type DictionaryEntry = Doc<"dictionaryEntry">;

function highlightMatches(text: string, rawQuery: string) {
  const query = rawQuery.trim();
  if (!query) {
    return text;
  }

  const lower = text.toLowerCase();
  const qLower = query.toLowerCase();
  const nodes: ReactNode[] = [];
  let start = 0;
  let markIndex = 0;
  let idx = lower.indexOf(qLower, start);

  while (idx !== -1) {
    if (idx > start) {
      nodes.push(text.slice(start, idx));
    }
    const slice = text.slice(idx, idx + query.length);
    const markKey = `${idx}-${markIndex}`;
    markIndex += 1;
    nodes.push(
      <mark
        key={markKey}
        className="rounded-sm bg-sky-200/90 px-0.5 text-foreground dark:bg-sky-500/35"
      >
        {slice}
      </mark>,
    );
    start = idx + query.length;
    idx = lower.indexOf(qLower, start);
  }

  if (start < text.length) {
    nodes.push(text.slice(start));
  }

  return nodes.length > 0 ? <>{nodes}</> : text;
}

export function DictionaryEntryRow({
  entry,
  searchQuery,
}: {
  entry: DictionaryEntry;
  searchQuery: string;
}) {
  return (
    <article className="border-b border-border py-4 sm:py-5 last:border-b-0">
      <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-3 sm:gap-y-1">
        <span className="font-serif text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
          {entry.simplifiedHanzi}
        </span>
        <span className="text-base text-muted-foreground sm:text-lg">{entry.diacriticPinyin}</span>
      </div>
      <p className="mt-2 line-clamp-4 text-sm leading-relaxed text-foreground sm:text-base">
        {highlightMatches(entry.meaning, searchQuery)}
      </p>
    </article>
  );
}
