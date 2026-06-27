import { orpc } from "@/utils/orpc";
import { Badge } from "@handeck/ui/components/badge";
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
  status: "queued" | "generating" | "completed" | "failed";
  error: string | null;
  progress: number;
};

function formatCreatedAt(createdAt: Date) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(createdAt);
}

export default function DeckCard({ deck }: { deck: DeckListItem }) {
  const { templateName, createdAt, status } = deck;
  const getDownloadUrl = useMutation(orpc.deck.getDownloadUrl.mutationOptions());
  const isDownloadable = status === "completed";
  const progressPercent = Math.round(deck.progress * 100);

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
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-sm bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            <Calendar className="size-3" />
            {formatCreatedAt(createdAt)}
          </span>
          <DeckStatusBadge status={status} />
        </div>
        {status === "generating" && (
          <p className="mt-2 text-xs text-muted-foreground">{progressPercent}% complete</p>
        )}
        {status === "failed" && deck.error && (
          <p className="mt-2 line-clamp-2 text-xs text-destructive">{deck.error}</p>
        )}
      </CardContent>

      <CardFooter className="mt-auto flex flex-row items-center justify-end gap-2 border-t px-3 py-2">
        <Button
          size="sm"
          className="gap-1.5"
          type="button"
          disabled={!isDownloadable || getDownloadUrl.isPending}
          aria-busy={getDownloadUrl.isPending}
          onClick={() => void handleDownload()}
        >
          <Download className="size-3" />
          {getDownloadUrl.isPending ? "Preparing..." : isDownloadable ? "Download" : "Not ready"}
        </Button>
      </CardFooter>
    </Card>
  );
}

function DeckStatusBadge({ status }: { status: DeckListItem["status"] }) {
  if (status === "completed") return <Badge variant="secondary">Ready</Badge>;
  if (status === "failed") return <Badge variant="destructive">Failed</Badge>;
  if (status === "queued") return <Badge variant="outline">Queued</Badge>;

  return <Badge variant="outline">Generating</Badge>;
}
