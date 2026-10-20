import type { BadgeDTO, EarnedBadge } from "@shared/types.js";
import { and, eq } from "drizzle-orm";
import { db, schema } from "../db/client.js";
import { getStreak, isRegionComplete } from "../scoring/service.js";

/**
 * A badge rule: whether the user currently qualifies for the badge `code`.
 * Rules are pure DB/scoring reads — no inserts. Earning (persisting) happens in
 * evaluateBadges so the engine stays idempotent and side-effect-free here.
 *
 * NOTE: this module imports from scoring/service — scoring MUST NOT import badges
 * (that would be a cycle). evaluateBadges is therefore called from the ROUTE layer.
 */
interface BadgeRule { code: string; earned(userId: number): boolean; }

function medellinRegionId(): number | null {
  const r = db.select({ id: schema.regions.id }).from(schema.regions)
    .where(eq(schema.regions.slug, "medellin")).get();
  return r?.id ?? null;
}

const RULES: BadgeRule[] = [
  {
    code: "primera_tarea",
    earned: (userId) => !!db.select({ id: schema.progress.id }).from(schema.progress)
      .where(and(eq(schema.progress.userId, userId), eq(schema.progress.correct, true))).get(),
  },
  { code: "racha_3", earned: (userId) => getStreak(userId).longest >= 3 },
  { code: "racha_7", earned: (userId) => getStreak(userId).longest >= 7 },
  {
    code: "medellin_completo",
    earned: (userId) => {
      const id = medellinRegionId();
      return id !== null && isRegionComplete(userId, id);
    },
  },
  {
    code: "primera_clase",
    earned: (userId) => !!db.select({ id: schema.sessionAttendance.id }).from(schema.sessionAttendance)
      .where(eq(schema.sessionAttendance.userId, userId)).get(),
  },
  {
    code: "retador",
    earned: (userId) => !!db.select({ id: schema.pointsLedger.id }).from(schema.pointsLedger)
      .where(and(eq(schema.pointsLedger.userId, userId), eq(schema.pointsLedger.sourceType, "live"))).get(),
  },
];

/**
 * Evaluate every rule and persist newly-earned badges for the user. Idempotent:
 * the unique(userId, code) index + onConflictDoNothing means a badge is granted
 * at most once. Returns only the badges earned on THIS call (empty on a re-run).
 */
export function evaluateBadges(userId: number): EarnedBadge[] {
  const already = new Set(
    db.select({ code: schema.userBadges.code }).from(schema.userBadges)
      .where(eq(schema.userBadges.userId, userId)).all().map((r) => r.code),
  );

  const newly: EarnedBadge[] = [];
  for (const rule of RULES) {
    if (already.has(rule.code)) continue;
    // A throwing rule must never fail the caller (e.g. an already-graded attempt).
    try {
      if (!rule.earned(userId)) continue;
      const res = db.insert(schema.userBadges).values({ userId, code: rule.code })
        .onConflictDoNothing().run();
      if (res.changes === 0) continue; // raced / already present
      const b = db.select().from(schema.badges).where(eq(schema.badges.code, rule.code)).get();
      if (b) newly.push({ code: b.code, name: b.name, emoji: b.emoji, description: b.description });
    } catch (err) {
      console.error(`badge rule '${rule.code}' failed for user ${userId}:`, err);
    }
  }
  return newly;
}

/**
 * The full badge shelf for a user: every seeded badge with the user's earned flag.
 * Re-evaluates first so the shelf is always current.
 */
export function listBadges(userId: number): BadgeDTO[] {
  evaluateBadges(userId);
  const all = db.select().from(schema.badges).all();
  const earned = new Map(
    db.select().from(schema.userBadges).where(eq(schema.userBadges.userId, userId)).all()
      .map((r) => [r.code, r.earnedAt] as const),
  );
  return all.map((b) => {
    const at = earned.get(b.code);
    return {
      code: b.code, name: b.name, emoji: b.emoji, description: b.description,
      earned: at !== undefined,
      earnedAt: at ? at.getTime() : null,
    };
  });
}
