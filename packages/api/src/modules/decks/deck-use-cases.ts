import { db } from "@handeck/db";
import { decksTable } from "@handeck/db/schema";
import { and, eq } from "drizzle-orm";

export async function getOwnedDeck(deckId: string, userId: string) {
  const deck = await getOwnedDeckOrNull(deckId, userId);

  if (!deck) throw new Error("Deck not found");
  return deck;
}

export async function getOwnedDeckOrNull(deckId: string, userId: string) {
  const deck = await db.query.decksTable.findFirst({
    where: and(eq(decksTable.id, deckId), eq(decksTable.userId, userId)),
  });

  return deck ?? null;
}

export async function getOwnedDeckWithTemplate(deckId: string, userId: string) {
  const deck = await db.query.decksTable.findFirst({
    where: and(eq(decksTable.id, deckId), eq(decksTable.userId, userId)),
    with: {
      template: true,
    },
  });

  if (!deck) throw new Error("Deck not found");
  return deck;
}
