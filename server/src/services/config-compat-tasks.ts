import { desc, eq } from "drizzle-orm";
import type { CacheImpl, DB } from "../core/hono-types";
import { feeds } from "../db/schema";
import { clearFeedCache } from "./feed";
import { contentHasImagesMissingMetadata } from "../utils/image";

export async function buildCompatTasksResponse(db: DB) {
  const items = await db.query.feeds.findMany({
    columns: {
      id: true,
      content: true,
      draft: true,
    },
  });

  return {
    generatedAt: new Date().toISOString(),
    blurhash: {
      eligible: items.filter((item) => contentHasImagesMissingMetadata(item.content)).length,
    },
  };
}

export async function listBlurhashCompatCandidates(db: DB) {
  const items = await db.query.feeds.findMany({
    columns: {
      id: true,
      title: true,
      content: true,
    },
    orderBy: [desc(feeds.updatedAt)],
  });

  return {
    generatedAt: new Date().toISOString(),
    items: items.filter((item) => contentHasImagesMissingMetadata(item.content)),
  };
}

export async function applyBlurhashCompatUpdate(db: DB, cache: CacheImpl, feedId: number, content: string) {
  const feed = await db.query.feeds.findFirst({
    where: eq(feeds.id, feedId),
    columns: {
      id: true,
      alias: true,
      content: true,
    },
  });

  if (!feed) {
    throw new Error("Feed not found");
  }

  if (feed.content === content) {
    return { updated: false };
  }

  await db.update(feeds).set({ content }).where(eq(feeds.id, feed.id));
  await clearFeedCache(cache, feed.id, feed.alias, feed.alias);

  return { updated: true };
}
