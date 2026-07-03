import { Button } from "@handeck/ui/components/button";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import DeckCard, { type DeckListItem } from "./-deck-card";
import { DeckProgressSubscription } from "./-deck-progress-subscription";
import { requireAuth } from "@/lib/route-auth";

export const Route = createFileRoute("/decks/")({
  beforeLoad: requireAuth,
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(context.orpc.deck.listForCurrentUser.queryOptions());
  },
  component: Decks,
});

function DecksPageHeader() {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold md:text-3xl lg:text-4xl">Decks</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Download flashcard decks generated from your templates.
      </p>
    </div>
  );
}

function EmptyDecksCTA() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <p className="text-lg font-semibold text-foreground sm:text-xl">No decks yet</p>
      <p className="max-w-md text-sm text-muted-foreground">
        Open a template, add words, and generate a deck to see it here.
      </p>
      <Button className="text-base" size="lg" asChild>
        <Link to="/templates">Go to templates</Link>
      </Button>
    </div>
  );
}

function Decks() {
  const { orpc } = Route.useRouteContext();
  const { data } = useSuspenseQuery({
    ...orpc.deck.listForCurrentUser.queryOptions(),
    refetchInterval: 5_000,
  });
  const decks: DeckListItem[] = data;
  const hasDecks = decks.length > 0;
  const activeDecks = decks.filter(
    (deck) => deck.status === "queued" || deck.status === "generating",
  );

  return (
    <div className="px-4 pb-12 pt-4 md:px-12 lg:px-24 xl:px-32">
      <DecksPageHeader />
      {activeDecks.map((deck) => (
        <DeckProgressSubscription key={deck.id} deckId={deck.id} />
      ))}
      {hasDecks ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {decks.map((deck) => (
            <DeckCard key={deck.id} deck={deck} />
          ))}
        </div>
      ) : (
        <EmptyDecksCTA />
      )}
    </div>
  );
}
