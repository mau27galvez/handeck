import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@handeck/ui/components/card";
import { Button } from "@handeck/ui/components/button";
import { BookOpen, Calendar, Download } from "lucide-react";

export type DeckListItem = {
  id: string;
  templateId: string;
  templateName: string;
  createdAt: Date;
};

function formatCreatedAt(createdAt: Date) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(createdAt);
}

export default function DeckCard({ deck }: { deck: DeckListItem }) {
  const { templateName, createdAt } = deck;

  return (
    <Card size="sm" className="flex flex-col">
      <CardHeader className="pb-1">
        <CardDescription className="flex items-center gap-1">
          <BookOpen className="size-3 shrink-0" />
          Template
        </CardDescription>
        <CardTitle className="text-sm font-semibold leading-snug">{templateName}</CardTitle>
      </CardHeader>

      <CardContent className="mt-auto pt-0">
        <span className="inline-flex items-center gap-1 rounded-sm bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          <Calendar className="size-3" />
          {formatCreatedAt(createdAt)}
        </span>
      </CardContent>

      <CardFooter className="mt-auto flex flex-row items-center justify-end gap-2 border-t px-3 py-2">
        <Button size="sm" className="gap-1.5" type="button">
          <Download className="size-3" />
          Download
        </Button>
      </CardFooter>
    </Card>
  );
}
