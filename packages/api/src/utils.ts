import { db } from "@handeck/db";

export type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export function chunk<T>(items: T[], size: number) {
  const batches: T[][] = [];

  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }

  return batches;
}
