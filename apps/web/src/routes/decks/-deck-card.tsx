import { orpc } from "@/utils/orpc";
import { Button } from "@handeck/ui/components/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@handeck/ui/components/card";
import { useMutation } from "@tanstack/react-query";
import { BookOpen, Calendar, Download } from "lucide-react";
import { toast } from "sonner";

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
  const getDownloadUrl = useMutation(orpc.deck.getDownloadUrl.mutationOptions());

  async function handleDownload() {
    try {
      const url = await getDownloadUrl.mutateAsync({ deckId: deck.id });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to download deck";
      toast.error(message);
    }
  }

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
        <Button
          size="sm"
          className="gap-1.5"
          type="button"
          disabled={getDownloadUrl.isPending}
          aria-busy={getDownloadUrl.isPending}
          onClick={() => void handleDownload()}
        >
          <Download className="size-3" />
          {getDownloadUrl.isPending ? "Preparing..." : "Download"}
        </Button>
      </CardFooter>
    </Card>
  );
}
