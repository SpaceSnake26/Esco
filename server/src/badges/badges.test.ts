import { eq } from "drizzle-orm";
import { expect, test } from "vitest";
import { buildApp } from "../app.js";
import { db, schema } from "../db/client.js";
import { regionExerciseIds } from "../scoring/service.js";
import { gradeAttempt, todayUTC, touchStreak, yesterday } from "../scoring/service.js";
import { evaluateBadges, listBadges } from "./service.js";

function medellinId(): number {
  return db.select().from(schema.regions).where(eq(schema.regions.slug, "medellin")).get()!.id;
}

function correctAll(userId: number, regionId: number) {
  for (const exId of regionExerciseIds(regionId)) {
    const ex = db.select().from(schema.exercises).where(eq(schema.exercises.id, exId)).get()!;
    gradeAttempt(userId, exId, ex.answer);
  }
}

// --- primera_tarea: granted after a first correct homework exercise ----------
test("evaluateBadges grants primera_tarea after a correct attempt and is idempotent", () => {
  const u = 1; // Fabio
  const exId = regionExerciseIds(medellinId())[0];
  const ex = db.select().from(schema.exercises).where(eq(schema.exercises.id, exId)).get()!;
  gradeAttempt(u, exId, ex.answer);

  const first = evaluateBadges(u);
  expect(first.map((b) => b.code)).toContain("primera_tarea");

  // Second call re-evaluates but grants nothing new.
  expect(evaluateBadges(u)).toEqual([]);
});

// --- racha_7: granted once the longest streak reaches 7 ----------------------
test("evaluateBadges grants racha_7 after a 7-day streak", () => {
  const u = 2; // Aleks
  const dates: string[] = [];
  let d = todayUTC();
  for (let i = 0; i < 7; i++) { dates.unshift(d); d = yesterday(d); }
  for (const day of dates) touchStreak(u, day);

  const codes = evaluateBadges(u).map((b) => b.code);
  expect(codes).toContain("racha_3");
  expect(codes).toContain("racha_7");
});

// --- medellin_completo: granted after every Medellín exercise is correct -----
test("evaluateBadges grants medellin_completo after all Medellín exercises correct", () => {
  const u = 3; // Igor
  const region = medellinId();
  correctAll(u, region);

  const codes = evaluateBadges(u).map((b) => b.code);
  expect(codes).toContain("medellin_completo");
});

// --- HTTP: auth required -----------------------------------------------------
test("GET /api/badges requires auth", async () => {
  const app = buildApp();
  const res = await app.inject({ method: "GET", url: "/api/badges" });
  expect(res.statusCode).toBe(401);
});

// --- HTTP: shelf returns all badges with earned flags ------------------------
test("GET /api/badges returns the shelf with earned flags", async () => {
  const app: any = buildApp();
  const token = (await app.inject({ method: "POST", url: "/api/auth/login", payload: { userId: 1, pin: "111111" } }))
    .cookies.find((c: any) => c.name === "token").value;

  // Earn primera_tarea for Fabio.
  const exId = regionExerciseIds(medellinId())[0];
  const ex = db.select().from(schema.exercises).where(eq(schema.exercises.id, exId)).get()!;
  gradeAttempt(1, exId, ex.answer);

  const res = await app.inject({ method: "GET", url: "/api/badges", cookies: { token } });
  expect(res.statusCode).toBe(200);
  const shelf = res.json() as { code: string; earned: boolean }[];
  expect(shelf).toHaveLength(6);
  expect(shelf.find((b) => b.code === "primera_tarea")!.earned).toBe(true);
  expect(shelf.find((b) => b.code === "racha_7")!.earned).toBe(false);
});

// --- listBadges re-evaluates so the shelf is current -------------------------
test("listBadges reflects a freshly-earned badge without an explicit evaluate", () => {
  const u = 2;
  const exId = regionExerciseIds(medellinId())[0];
  const ex = db.select().from(schema.exercises).where(eq(schema.exercises.id, exId)).get()!;
  gradeAttempt(u, exId, ex.answer);
  const shelf = listBadges(u);
  expect(shelf.find((b) => b.code === "primera_tarea")!.earned).toBe(true);
});
