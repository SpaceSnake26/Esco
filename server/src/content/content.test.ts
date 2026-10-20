import { beforeAll, expect, test } from "vitest";
import { buildApp } from "../app.js";

async function authedCookie(app: any) {
  const res = await app.inject({ method: "POST", url: "/api/auth/login", payload: { userId: 1, pin: "111111" } });
  return res.cookies.find((c: any) => c.name === "token")!.value;
}

let app: any, token: string;
beforeAll(async () => { app = buildApp(); token = await authedCookie(app); });

test("GET /api/regions returns Medellín as current/unlocked first", async () => {
  const res = await app.inject({ method: "GET", url: "/api/regions", cookies: { token } });
  expect(res.statusCode).toBe(200);
  const regions = res.json();
  expect(regions[0]).toMatchObject({ slug: "medellin", status: "current" });
  expect(regions.find((r: any) => r.slug === "cartagena").status).toBe("locked");
});

test("GET /api/regions/:id returns lessons with exercises (answers stripped)", async () => {
  const regions = (await app.inject({ method: "GET", url: "/api/regions", cookies: { token } })).json();
  const medellinId = regions[0].id;
  const res = await app.inject({ method: "GET", url: `/api/regions/${medellinId}`, cookies: { token } });
  expect(res.statusCode).toBe(200);
  const hw = res.json().lessons.find((l: any) => l.kind === "homework");
  expect(hw.exercises.length).toBeGreaterThan(0);
  expect(hw.exercises[0]).not.toHaveProperty("answer"); // never leak the answer
});

test("Phase 4: every one of the 6 stops has a homework lesson with exercises", async () => {
  const regions = (await app.inject({ method: "GET", url: "/api/regions", cookies: { token } })).json();
  expect(regions).toHaveLength(6);
  for (const r of regions) {
    const detail = (await app.inject({ method: "GET", url: `/api/regions/${r.id}`, cookies: { token } })).json();
    const hw = detail.lessons.find((l: any) => l.kind === "homework");
    expect(hw, `region ${r.slug} should have homework`).toBeTruthy();
    expect(hw.exercises.length).toBeGreaterThan(0);
  }
});

test("GET /api/regions/:id/vocab returns es/en words for a stop", async () => {
  const regions = (await app.inject({ method: "GET", url: "/api/regions", cookies: { token } })).json();
  const cartagena = regions.find((r: any) => r.slug === "cartagena");
  const res = await app.inject({ method: "GET", url: `/api/regions/${cartagena.id}/vocab`, cookies: { token } });
  expect(res.statusCode).toBe(200);
  const words = res.json();
  expect(words.length).toBeGreaterThan(0);
  expect(words[0]).toHaveProperty("es");
  expect(words[0]).toHaveProperty("en");
});

test("vocab endpoint requires auth", async () => {
  const res = await app.inject({ method: "GET", url: "/api/regions/1/vocab" });
  expect(res.statusCode).toBe(401);
});
