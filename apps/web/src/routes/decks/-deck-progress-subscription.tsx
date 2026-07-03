import { client, orpc } from "@/utils/orpc";
import { deckGenerationChannel } from "@handeck/api/inngest/channels";
import type { DeckGenerationProgressPayload } from "@handeck/api/modules/decks/deck-progress";
import { useQueryClient } from "@tanstack/react-query";
import { useRealtime } from "inngest/react";
import { useEffect } from "react";

import type { DeckListItem } from "./-deck-card";

type DeckProgressSubscriptionProps = {
  deckId: string;
};

export function DeckProgressSubscription({ deckId }: DeckProgressSubscriptionProps) {
  const queryClient = useQueryClient();
  const { messages, error } = useRealtime({
    channel: deckGenerationChannel(deckId),
    topics: ["progress"] as const,
    token: () => client.deck.getProgressSubscriptionToken({ deckId }),
    historyLimit: 10,
  });
  const latestProgress = messages.last?.data as DeckGenerationProgressPayload | undefined;

  useEffect(() => {
    if (error) {
      void queryClient.invalidateQueries(orpc.deck.listForCurrentUser.queryOptions());
      return;
    }
    if (!latestProgress) return;

    const progress = latestProgress;
    const queryOptions = orpc.deck.listForCurrentUser.queryOptions();
    const isTerminalStatus = progress.status === "completed" || progress.status === "failed";

    queryClient.setQueryData<DeckListItem[]>(queryOptions.queryKey, (decks) => {
      if (!decks) return decks;

      return decks.map((deck) => {
        if (deck.id !== progress.deckId) return deck;

        return {
          ...deck,
          status: progress.status,
          error: progress.error,
          progress: progress.progress,
        };
      });
    });

    if (isTerminalStatus) {
      void queryClient.invalidateQueries(queryOptions);
    }
  }, [error, latestProgress, queryClient]);

  return null;
}
