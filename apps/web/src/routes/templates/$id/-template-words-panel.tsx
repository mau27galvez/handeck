import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@handeck/ui/components/card";
import { PLACEHOLDER_WORDS } from "@/lib/template-placeholders";

export default function TemplateWordsPanel() {
  return (
    <Card className="flex min-h-0 flex-col">
      <CardHeader className="shrink-0 border-b pb-4">
        <CardTitle>Words</CardTitle>
        <CardDescription>
          Words included in this template. Real word selection is coming soon.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pt-4">
        <ul className="divide-y rounded-md border">
          {PLACEHOLDER_WORDS.map((word) => (
            <li key={word.simplifiedHanzi} className="flex flex-col gap-0.5 px-3 py-2.5">
              <span className="text-lg font-medium leading-tight">{word.simplifiedHanzi}</span>
              <span className="text-sm text-muted-foreground">{word.pinyin}</span>
              <span className="text-sm">{word.translation}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          Showing {PLACEHOLDER_WORDS.length} placeholder words for now.
        </p>
      </CardContent>
    </Card>
  );
}
