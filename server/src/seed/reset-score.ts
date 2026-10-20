import { eq } from "drizzle-orm";
import { pathToFileURL } from "node:url";
import { db, schema } from "../db/client.js";

/**
 * Wipe one player's game state so they start fresh from zero: points, exercise
 * progress (so stops re-lock), streak, badges and class attendance. Does NOT
 * touch the user account itself (name, PIN, avatar) or any content.
 */
export function resetScore(name: string) {
  const user = db.select().from(schema.users).where(eq(schema.users.name, name)).get();
  if (!user) { console.log(`reset-score: no user named '${name}'`); return; }

  const ledger = db.delete(schema.pointsLedger).where(eq(schema.pointsLedger.userId, user.id)).run();
  const progress = db.delete(schema.progress).where(eq(schema.progress.userId, user.id)).run();
  const badges = db.delete(schema.userBadges).where(eq(schema.userBadges.userId, user.id)).run();
  const attendance = db.delete(schema.sessionAttendance).where(eq(schema.sessionAttendance.userId, user.id)).run();
  const streak = db.delete(schema.streaks).where(eq(schema.streaks.userId, user.id)).run();

  console.log(`reset-score: ${name} (id ${user.id}) → points:${ledger.changes} progress:${progress.changes} badges:${badges.changes} attendance:${attendance.changes} streak:${streak.changes} rows removed`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const name = process.argv[2] ?? "Fabio";
  resetScore(name);
}
