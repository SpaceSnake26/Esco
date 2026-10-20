import { beforeAll, expect, test } from "vitest";
import { buildApp } from "../app.js";

let app: any, token: string, exerciseId: number, answer: string;
beforeAll(async () => {
  app = buildApp();
  token = (await app.inject({ method: "POST", url: "/api/auth/login", payload: { userId: 2, pin: "222222" } }))
    .cookies.find((c: any) => c.name === "token").value;
  const regions = (await app.inject({ method: "GET", url: "/api/regions", cookies: { token } })).json();
  const region = (await app.inject({ method: "GET", url: `/api/regions/${regions[0].id}`, cookies: { token } })).json();
  const ex = region.lessons.find((l: any) => l.kind === "homework").exercises[0];
  exerciseId = ex.id;
  answer = "Gracias"; // first seeded MC answer
});

test("correct attempt awards points once; repeat awards zero", async () => {
  const first = await app.inject({ method: "POST", url: "/api/attempts",
    payload: { exerciseId, answer }, cookies: { token } });
  expect(first.json()).toMatchObject({ correct: true });
  expect(first.json().awarded).toBeGreaterThan(0);

  const second = await app.inject({ method: "POST", url: "/api/attempts",
    payload: { exerciseId, answer }, cookies: { token } });
  expect(second.json().awarded).toBe(0); // idempotent — no point farming
});

test("wrong first attempt then correct earns no points (no farming after reveal)", async () => {
  const regions = (await app.inject({ method: "GET", url: "/api/regions", cookies: { token } })).json();
  const region = (await app.inject({ method: "GET", url: `/api/regions/${regions[0].id}`, cookies: { token } })).json();
  const fill = region.lessons.find((l: any) => l.kind === "homework")
    .exercises.find((e: any) => e.type === "fill_blank");

  const wrong = await app.inject({ method: "POST", url: "/api/attempts",
    payload: { exerciseId: fill.id, answer: "zzz-not-right" }, cookies: { token } });
  expect(wrong.json()).toMatchObject({ correct: false, awarded: 0 });

  // The response reveals correctAnswer; resubmitting it must still award nothing.
  const retry = await app.inject({ method: "POST", url: "/api/attempts",
    payload: { exerciseId: fill.id, answer: wrong.json().correctAnswer }, cookies: { token } });
  expect(retry.json().correct).toBe(true);
  expect(retry.json().awarded).toBe(0);
});

test("leaderboard reflects awarded points", async () => {
  const res = await app.inject({ method: "GET", url: "/api/leaderboard", cookies: { token } });
  expect(res.statusCode).toBe(200);
  const rows = res.json();
  expect(rows.find((r: any) => r.userId === 2).points).toBeGreaterThan(0);
});
