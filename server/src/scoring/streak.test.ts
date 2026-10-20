import { beforeAll, expect, test } from "vitest";
import { buildApp } from "../app.js";
import { getStreak, streakMultiplier, todayUTC, touchStreak, yesterday } from "./service.js";

// --- Pure: multiplier tiers --------------------------------------------------
test("streakMultiplier tiers", () => {
  expect(streakMultiplier(0)).toBe(1.0);
  expect(streakMultiplier(2)).toBe(1.0);
  expect(streakMultiplier(3)).toBe(1.05);
  expect(streakMultiplier(6)).toBe(1.05);
  expect(streakMultiplier(7)).toBe(1.1);
  expect(streakMultiplier(13)).toBe(1.1);
  expect(streakMultiplier(14)).toBe(1.2);
  expect(streakMultiplier(100)).toBe(1.2);
});

test("yesterday does UTC calendar math across month boundaries", () => {
  expect(yesterday("2026-03-02")).toBe("2026-03-01");
  expect(yesterday("2026-03-01")).toBe("2026-02-28");
  expect(yesterday("2026-01-01")).toBe("2025-12-31");
});

// --- touchStreak: same-day / consecutive / skip-reset ------------------------
test("touchStreak: same-day no-op, consecutive increment, skipped-day reset", () => {
  const u = 3; // Igor
  expect(touchStreak(u, "2026-03-01")).toBe(1); // first touch creates row
  expect(touchStreak(u, "2026-03-01")).toBe(1); // same day → no change
  expect(touchStreak(u, "2026-03-02")).toBe(2); // consecutive day → +1
  expect(touchStreak(u, "2026-03-03")).toBe(3); // consecutive day → +1
  expect(touchStreak(u, "2026-03-05")).toBe(1); // skipped 03-04 → reset to 1
  expect(getStreak(u)).toEqual({ current: 1, longest: 3 }); // longest preserved
});

// --- Integration: a 7-day streak multiplies a first correct award by 1.10 ----
test("correct first attempt on a 7-day streak awards round(base * 1.10)", async () => {
  const app: any = buildApp();
  const token = (await app.inject({ method: "POST", url: "/api/auth/login", payload: { userId: 1, pin: "111111" } }))
    .cookies.find((c: any) => c.name === "token").value;

  // Seed a 7-day streak for Fabio ending today, so gradeAttempt's same-day
  // touchStreak is a no-op and the multiplier stays at the 7-day tier (1.10).
  const dates: string[] = [];
  let d = todayUTC();
  for (let i = 0; i < 7; i++) { dates.unshift(d); d = yesterday(d); }
  for (const day of dates) touchStreak(1, day);
  expect(getStreak(1).current).toBe(7);

  // GET /api/streak reflects it.
  const streakRes = await app.inject({ method: "GET", url: "/api/streak", cookies: { token } });
  expect(streakRes.json()).toMatchObject({ current: 7 });

  const regions = (await app.inject({ method: "GET", url: "/api/regions", cookies: { token } })).json();
  const region = (await app.inject({ method: "GET", url: `/api/regions/${regions[0].id}`, cookies: { token } })).json();
  const mc = region.lessons.find((l: any) => l.kind === "homework").exercises[0]; // "Gracias", 10 pts
  const base = mc.points;

  const attempt = await app.inject({ method: "POST", url: "/api/attempts",
    payload: { exerciseId: mc.id, answer: "Gracias" }, cookies: { token } });
  expect(attempt.json().correct).toBe(true);
  expect(attempt.json().awarded).toBe(Math.round(base * 1.1)); // 10 → 11

  // Leaderboard reflects the multiplied points.
  const board = (await app.inject({ method: "GET", url: "/api/leaderboard", cookies: { token } })).json();
  expect(board.find((r: any) => r.userId === 1).points).toBe(Math.round(base * 1.1));
});
