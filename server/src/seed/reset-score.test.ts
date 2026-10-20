import { and, eq } from "drizzle-orm";
import { expect, test } from "vitest";
import { db, schema } from "../db/client.js";
import { award } from "../scoring/service.js";
import { resetScore } from "./reset-score.js";

test("resetScore wipes a player's points and progress but keeps the account", () => {
  const FABIO = 1;
  award(FABIO, "exercise", 9991, 50);
  award(FABIO, "live", 9992, 100);
  db.insert(schema.progress).values({ userId: FABIO, exerciseId: 1, correct: true }).onConflictDoNothing().run();

  const before = db.select().from(schema.pointsLedger).where(eq(schema.pointsLedger.userId, FABIO)).all();
  expect(before.length).toBeGreaterThan(0);

  resetScore("Fabio");

  expect(db.select().from(schema.pointsLedger).where(eq(schema.pointsLedger.userId, FABIO)).all()).toHaveLength(0);
  expect(db.select().from(schema.progress).where(eq(schema.progress.userId, FABIO)).all()).toHaveLength(0);
  // Account itself is untouched.
  expect(db.select().from(schema.users).where(eq(schema.users.id, FABIO)).get()?.name).toBe("Fabio");
  // Other players are unaffected.
  award(2, "exercise", 7777, 30);
  expect(db.select().from(schema.pointsLedger).where(and(eq(schema.pointsLedger.userId, 2))).all().length).toBeGreaterThan(0);
});
