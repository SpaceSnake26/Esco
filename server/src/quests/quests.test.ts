import { and, eq, inArray } from "drizzle-orm";
import { expect, test } from "vitest";
import { buildApp } from "../app.js";
import { db, schema } from "../db/client.js";
import { ensureTodayQuests, getTodayQuests } from "./service.js";

function medellinId(): number {
  return db.select().from(schema.regions).where(eq(schema.regions.slug, "medellin")).get()!.id;
}

async function login(userId: number, pin: string): Promise<string> {
  const app: any = buildApp();
  const res = await app.inject({ method: "POST", url: "/api/auth/login", payload: { userId, pin } });
  return res.cookies.find((c: any) => c.name === "token").value;
}

// Pull the stored answerIndexes straight from the DB for a quest (test-only peek).
function storedAnswers(questId: number): number[] {
  const q = db.select().from(schema.sideQuests).where(eq(schema.sideQuests.id, questId)).get()!;
  return (q.payloadJson as { questions: { answerIndex: number }[] }).questions.map((x) => x.answerIndex);
}

// --- generator idempotency ---------------------------------------------------
test("ensureTodayQuests is idempotent per day (one of each type)", () => {
  const region = medellinId();
  ensureTodayQuests(region, "2026-10-09");
  ensureTodayQuests(region, "2026-10-09");

  const rows = db.select().from(schema.sideQuests)
    .where(and(eq(schema.sideQuests.date, "2026-10-09"), eq(schema.sideQuests.regionId, region))).all();
  expect(rows).toHaveLength(3);
  expect(rows.filter((r) => r.type === "vocab_blast")).toHaveLength(1);
  expect(rows.filter((r) => r.type === "word_of_day")).toHaveLength(1);
  expect(rows.filter((r) => r.type === "roleplay")).toHaveLength(1);
});

// --- a different day generates fresh quests ----------------------------------
test("a different today generates fresh quests", () => {
  const region = medellinId();
  ensureTodayQuests(region, "2026-01-01");
  ensureTodayQuests(region, "2026-01-02");
  const d1 = db.select().from(schema.sideQuests)
    .where(and(eq(schema.sideQuests.date, "2026-01-01"), eq(schema.sideQuests.regionId, region))).all();
  const d2 = db.select().from(schema.sideQuests)
    .where(and(eq(schema.sideQuests.date, "2026-01-02"), eq(schema.sideQuests.regionId, region))).all();
  expect(d1).toHaveLength(3);
  expect(d2).toHaveLength(3);
  expect(d1.map((r) => r.id).sort()).not.toEqual(d2.map((r) => r.id).sort());
});

// --- GET /api/quests/today leaks no answerIndex, done:false ------------------
test("GET /api/quests/today returns quests with no answerIndex and done:false", async () => {
  const token = await login(1, "111111");
  const app: any = buildApp();
  const res = await app.inject({ method: "GET", url: "/api/quests/today", cookies: { token } });
  expect(res.statusCode).toBe(200);

  const quests = res.json();
  expect(quests).toHaveLength(3);
  const blast = quests.find((q: any) => q.type === "vocab_blast");
  const word = quests.find((q: any) => q.type === "word_of_day");
  const roleplay = quests.find((q: any) => q.type === "roleplay");
  expect(blast.done).toBe(false);
  expect(word.done).toBe(false);
  expect(roleplay.done).toBe(false);
  expect(roleplay.payload.title).toBeTruthy();
  expect(roleplay.payload.scenario).toBeTruthy();
  expect(blast.payload.questions).toHaveLength(5);

  // answerIndex must never appear in the serialized response.
  expect(JSON.stringify(res.json())).not.toContain("answerIndex");
  for (const q of blast.payload.questions) {
    expect(q).not.toHaveProperty("answerIndex");
    expect(q.options.length).toBeGreaterThanOrEqual(1);
  }
});

// --- vocab_blast: streak-multiplied award, once; re-completion guarded -------
test("completing a vocab_blast awards round(40*fraction) streak-multiplied once; second completion is a no-op", async () => {
  const token = await login(1, "111111");
  const app: any = buildApp();

  const today = getTodayQuests(1).find((q) => q.type === "vocab_blast")!;
  const answers = storedAnswers(today.id); // all correct

  const streakBefore = (await app.inject({ method: "GET", url: "/api/streak", cookies: { token } })).json();

  const first = await app.inject({
    method: "POST", url: `/api/quests/${today.id}/complete`,
    payload: { answers }, cookies: { token },
  });
  expect(first.statusCode).toBe(200);
  const body = first.json();
  // All 5 correct → base 40 → multiplied by the fresh-streak tier (current becomes 1 ⇒ x1.0).
  expect(body.awarded).toBe(40);
  expect(body.alreadyDone).toBeUndefined();
  // results reveal the correct answers AFTER completion.
  expect(body.results).toHaveLength(5);
  expect(body.results.every((r: any) => r.correct)).toBe(true);

  const streakAfterFirst = (await app.inject({ method: "GET", url: "/api/streak", cookies: { token } })).json();
  expect(streakAfterFirst.current).toBe(streakBefore.current + 1);

  // Second completion: alreadyDone, awards nothing, streak unchanged.
  const second = await app.inject({
    method: "POST", url: `/api/quests/${today.id}/complete`,
    payload: { answers }, cookies: { token },
  });
  expect(second.json().alreadyDone).toBe(true);
  expect(second.json().awarded).toBe(0);

  const streakAfterSecond = (await app.inject({ method: "GET", url: "/api/streak", cookies: { token } })).json();
  expect(streakAfterSecond.current).toBe(streakAfterFirst.current);

  // And it now reads as done.
  expect(getTodayQuests(1).find((q) => q.type === "vocab_blast")!.done).toBe(true);
});

// --- partial grade: round(40 * correct/total) --------------------------------
test("vocab_blast partial score awards round(40 * correct/total)", async () => {
  const token = await login(2, "222222");
  const app: any = buildApp();
  const quest = getTodayQuests(2).find((q) => q.type === "vocab_blast")!;
  const correctAnswers = storedAnswers(quest.id);
  // Answer only the first 3 correctly, rest wrong.
  const answers = correctAnswers.map((a, i) => (i < 3 ? a : (a + 1) % 4));

  const res = await app.inject({
    method: "POST", url: `/api/quests/${quest.id}/complete`,
    payload: { answers }, cookies: { token },
  });
  // 3/5 correct → 40 * 3/5 = 24, fresh streak x1.0.
  expect(res.json().awarded).toBe(24);
});

// --- word_of_day completes for 15 -------------------------------------------
test("word_of_day completes for 15 points", async () => {
  const token = await login(3, "333333");
  const app: any = buildApp();
  const quest = getTodayQuests(3).find((q) => q.type === "word_of_day")!;

  const res = await app.inject({
    method: "POST", url: `/api/quests/${quest.id}/complete`,
    payload: {}, cookies: { token },
  });
  expect(res.statusCode).toBe(200);
  expect(res.json().awarded).toBe(15);
  expect(res.json().results).toBeUndefined();
});

// --- roleplay: no grading, awards 30 once -----------------------------------
test("roleplay completes for 30 points once; re-completion is a no-op", async () => {
  const token = await login(3, "333333");
  const app: any = buildApp();
  const quest = getTodayQuests(3).find((q) => q.type === "roleplay")!;
  expect(quest.points).toBe(30);

  const first = await app.inject({
    method: "POST", url: `/api/quests/${quest.id}/complete`,
    payload: {}, cookies: { token },
  });
  expect(first.statusCode).toBe(200);
  expect(first.json().awarded).toBe(30); // no grading, fresh streak x1.0
  expect(first.json().results).toBeUndefined();

  const second = await app.inject({
    method: "POST", url: `/api/quests/${quest.id}/complete`,
    payload: {}, cookies: { token },
  });
  expect(second.json().alreadyDone).toBe(true);
  expect(second.json().awarded).toBe(0);
});

// --- bad / unknown id --------------------------------------------------------
test("complete rejects a bad id (400) and unknown id (404)", async () => {
  const token = await login(1, "111111");
  const app: any = buildApp();
  expect((await app.inject({ method: "POST", url: "/api/quests/abc/complete", payload: {}, cookies: { token } })).statusCode).toBe(400);
  expect((await app.inject({ method: "POST", url: "/api/quests/999999/complete", payload: {}, cookies: { token } })).statusCode).toBe(404);
});

// --- auth required -----------------------------------------------------------
test("GET /api/quests/today requires auth", async () => {
  const app = buildApp();
  expect((await app.inject({ method: "GET", url: "/api/quests/today" })).statusCode).toBe(401);
});

// --- regression: current region has no vocab (post-Medellín) → still serves quests, no 500 ---
test("a user past Medellín (current region has no vocab) still gets quests, not a 500", async () => {
  const token = await login(1, "111111");
  const app: any = buildApp();
  // Mark every Medellín exercise correct for user 1 → region 1 completes, so the
  // next (unseeded, vocab-less) region becomes 'current'.
  const region = medellinId();
  const lessonIds = db.select({ id: schema.lessons.id }).from(schema.lessons)
    .where(eq(schema.lessons.regionId, region)).all().map((l) => l.id);
  const exIds = db.select({ id: schema.exercises.id }).from(schema.exercises)
    .where(inArray(schema.exercises.lessonId, lessonIds)).all().map((e) => e.id);
  for (const exerciseId of exIds) {
    db.insert(schema.progress).values({ userId: 1, exerciseId, correct: true })
      .onConflictDoUpdate({ target: [schema.progress.userId, schema.progress.exerciseId], set: { correct: true } }).run();
  }

  const res = await app.inject({ method: "GET", url: "/api/quests/today", cookies: { token } });
  expect(res.statusCode).toBe(200);
  expect(res.json().length).toBeGreaterThan(0); // quests still served, drawn from Medellín's vocab
});
