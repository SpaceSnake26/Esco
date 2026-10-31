import type { AttemptResult, LeaderboardRow, RegionDTO } from "@shared/types.js";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "../db/client.js";

// A stop unlocks the next once the player has answered this share of its
// exercises correctly — mastery without demanding a perfect 100%.
export const REGION_UNLOCK_THRESHOLD = 0.6;

/** A region is "complete" (unlocks the next) when ≥ THRESHOLD of its exercises are correct. */
export function regionExerciseIds(regionId: number): number[] {
  const lessons = db.select({ id: schema.lessons.id }).from(schema.lessons)
    .where(eq(schema.lessons.regionId, regionId)).all();
  if (lessons.length === 0) return [];
  return db.select({ id: schema.exercises.id }).from(schema.exercises)
    .where(inArray(schema.exercises.lessonId, lessons.map((l) => l.id))).all().map((e) => e.id);
}

/** A player's homework progress in a stop: correct so far, total, and how many unlock the next. */
export function regionProgress(userId: number, regionId: number): { correct: number; total: number; needed: number } {
  const exIds = regionExerciseIds(regionId);
  if (exIds.length === 0) return { correct: 0, total: 0, needed: 0 };
  const correct = db.select({ id: schema.progress.id }).from(schema.progress)
    .where(and(eq(schema.progress.userId, userId), inArray(schema.progress.exerciseId, exIds),
      eq(schema.progress.correct, true))).all().length;
  return { correct, total: exIds.length, needed: Math.ceil(exIds.length * REGION_UNLOCK_THRESHOLD) };
}

export function isRegionComplete(userId: number, regionId: number): boolean {
  const { correct, total, needed } = regionProgress(userId, regionId);
  // A region with no exercises is never "complete", so it can't unlock the stops after it.
  return total > 0 && correct >= needed;
}

export function regionStatuses(userId: number): RegionDTO[] {
  const regions = db.select().from(schema.regions).orderBy(schema.regions.order).all();
  let prevComplete = true; // first region is always unlocked
  return regions.map((r) => {
    const progress = regionProgress(userId, r.id);
    const complete = progress.total > 0 && progress.correct >= progress.needed;
    const status: "locked" | "current" | "complete" = complete ? "complete" : prevComplete ? "current" : "locked";
    prevComplete = complete;
    return { id: r.id, order: r.order, slug: r.slug, name: r.name, theme: r.theme, status, ...progress };
  });
}

/** Idempotent point award: unique on (user, sourceType, sourceId). Returns points actually added. */
export function award(userId: number, sourceType: "exercise" | "school" | "sidequest" | "live", sourceId: number, points: number): number {
  const res = db.insert(schema.pointsLedger)
    .values({ userId, sourceType, sourceId, points })
    .onConflictDoNothing().run();
  return res.changes > 0 ? points : 0;
}

/** Streak multiplier applied to solo earning (exercise + sidequest). PURE. */
export function streakMultiplier(current: number): number {
  if (current >= 14) return 1.2;
  if (current >= 7) return 1.1;
  if (current >= 3) return 1.05;
  return 1.0;
}

/** The calendar day before `ymd` ('YYYY-MM-DD', UTC). PURE. */
export function yesterday(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Today's date as 'YYYY-MM-DD' in UTC. */
export function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Advance the user's daily streak for `today` ('YYYY-MM-DD').
 * Same day: no change. Consecutive day: current+1. Otherwise: reset to 1.
 * Keeps longest = max(longest, current). Returns the new current. Idempotent per day.
 */
export function touchStreak(userId: number, today: string): number {
  const row = db.select().from(schema.streaks).where(eq(schema.streaks.userId, userId)).get();

  if (!row) {
    db.insert(schema.streaks).values({ userId, current: 1, longest: 1, lastActiveDate: today }).run();
    return 1;
  }

  if (row.lastActiveDate === today) return row.current;

  const current = row.lastActiveDate === yesterday(today) ? row.current + 1 : 1;
  const longest = Math.max(row.longest, current);
  db.update(schema.streaks).set({ current, longest, lastActiveDate: today })
    .where(eq(schema.streaks.userId, userId)).run();
  return current;
}

/**
 * Award solo-earning points with the daily streak multiplier applied.
 * Touches the streak for today, multiplies the base by the tier multiplier,
 * and awards the rounded total idempotently. Returns the points actually added
 * and the multiplier used.
 */
export function awardWithStreak(
  userId: number,
  sourceType: "exercise" | "sidequest",
  sourceId: number,
  basePoints: number,
): { awarded: number; multiplier: number } {
  const current = touchStreak(userId, todayUTC());
  const multiplier = streakMultiplier(current);
  const pts = Math.round(basePoints * multiplier);
  const awarded = award(userId, sourceType, sourceId, pts);
  return { awarded, multiplier };
}

/** The user's streak counters (zeros if they have no row yet). */
export function getStreak(userId: number): { current: number; longest: number } {
  const row = db.select().from(schema.streaks).where(eq(schema.streaks.userId, userId)).get();
  return { current: row?.current ?? 0, longest: row?.longest ?? 0 };
}

/**
 * Speed-weighted live-quiz score (pure). A correct answer earns a 100 base plus up
 * to 100 more the faster it arrives; at/after the time limit it stays exactly 100.
 * A wrong answer earns 0.
 */
export function liveScore(correct: boolean, ms: number, timeLimitMs: number): number {
  return correct ? 100 + Math.round(100 * Math.max(0, 1 - ms / timeLimitMs)) : 0;
}

/** Award live-quiz points via the idempotent ledger under the "live" source type. */
export function awardLive(userId: number, syntheticId: number, points: number): number {
  return award(userId, "live", syntheticId, points);
}

function normalize(s: string): string {
  return s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Grade an exercise answer server-side.
 * Points are awarded only on the FIRST attempt at an exercise, and only if correct.
 * This keeps the game fair: revealing the correct answer after a wrong attempt is
 * harmless because a later correct retry earns nothing (though it still records a
 * correct progress row, so the region can be completed for map-unlock purposes).
 */
export function gradeAttempt(userId: number, exerciseId: number, answer: string): AttemptResult | null {
  const ex = db.select().from(schema.exercises).where(eq(schema.exercises.id, exerciseId)).get();
  if (!ex) return null;

  const prior = db.select({ id: schema.progress.id }).from(schema.progress)
    .where(and(eq(schema.progress.userId, userId), eq(schema.progress.exerciseId, exerciseId))).get();
  const correct = normalize(answer) === normalize(ex.answer);

  db.insert(schema.progress).values({ userId, exerciseId, correct })
    .onConflictDoUpdate({
      target: [schema.progress.userId, schema.progress.exerciseId],
      set: { correct: sql`${schema.progress.correct} OR ${correct ? 1 : 0}` },
    }).run();

  const awarded = !prior && correct ? awardWithStreak(userId, "exercise", exerciseId, ex.points).awarded : 0;
  return { correct, awarded, correctAnswer: ex.answer };
}

export function leaderboard(): LeaderboardRow[] {
  return db.select({
    userId: schema.users.id, name: schema.users.name, avatar: schema.users.avatar,
    points: sql<number>`COALESCE(SUM(${schema.pointsLedger.points}), 0)`,
  }).from(schema.users)
    .leftJoin(schema.pointsLedger, eq(schema.pointsLedger.userId, schema.users.id))
    .groupBy(schema.users.id)
    .orderBy(sql`points DESC`).all();
}
