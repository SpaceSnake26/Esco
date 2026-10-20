import { eq, sql } from "drizzle-orm";
import { db, schema } from "../db/client.js";

/** Paid Pablito calls recorded for a UTC day ('YYYY-MM-DD'). */
export function aiUsageToday(day: string): number {
  return db.select({ count: schema.aiUsage.count }).from(schema.aiUsage)
    .where(eq(schema.aiUsage.day, day)).get()?.count ?? 0;
}

/** Record one paid call for `day` (idempotent upsert increment). */
export function bumpAiUsage(day: string): void {
  db.insert(schema.aiUsage).values({ day, count: 1 })
    .onConflictDoUpdate({ target: schema.aiUsage.day, set: { count: sql`${schema.aiUsage.count} + 1` } })
    .run();
}
