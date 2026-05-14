import { authComponent } from "./auth";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

type AuthUser = NonNullable<Awaited<ReturnType<typeof authComponent.safeGetAuthUser>>>;

export async function getProfileIdForAuthUser(
  ctx: QueryCtx,
  authUser: AuthUser,
): Promise<Id<"profiles"> | null> {
  const betterAuthUserId = authUser._id as string;
  const existing = await ctx.db
    .query("profiles")
    .withIndex("by_betterAuthUserId", (q) => q.eq("betterAuthUserId", betterAuthUserId))
    .unique();
  return existing ? existing._id : null;
}

export async function ensureProfileForAuthUser(
  ctx: MutationCtx,
  authUser: AuthUser,
): Promise<Id<"profiles">> {
  const betterAuthUserId = authUser._id as string;
  const existing = await ctx.db
    .query("profiles")
    .withIndex("by_betterAuthUserId", (q) => q.eq("betterAuthUserId", betterAuthUserId))
    .unique();

  const now = Date.now();
  if (existing) {
    await ctx.db.patch(existing._id, {
      email: authUser.email,
      name: authUser.name,
      image: authUser.image,
      updatedAt: now,
    });
    return existing._id;
  }

  return await ctx.db.insert("profiles", {
    betterAuthUserId,
    email: authUser.email,
    name: authUser.name,
    image: authUser.image,
    createdAt: now,
    updatedAt: now,
  });
}
