import { beforeAll, expect, test } from "vitest";
import { buildApp } from "../app.js";

let app: any, token: string;
beforeAll(async () => {
  app = buildApp();
  token = (await app.inject({ method: "POST", url: "/api/auth/login", payload: { userId: 3, pin: "333333" } }))
    .cookies.find((c: any) => c.name === "token").value;
});

test("GET /api/school/current returns the current stop's sessions with agendas", async () => {
  const res = await app.inject({ method: "GET", url: "/api/school/current", cookies: { token } });
  expect(res.statusCode).toBe(200);
  const body = res.json();
  expect(body.regionName).toBe("Medellín"); // user 3 is on the first stop
  expect(body.sessions.length).toBeGreaterThan(0);
  expect(body.sessions[0].agenda.length).toBeGreaterThan(0);
});

test("completing a session awards 100 to each present user, once", async () => {
  const body = (await app.inject({ method: "GET", url: "/api/school/current", cookies: { token } })).json();
  const sessionId = body.sessions[0].id;
  const first = await app.inject({ method: "POST", url: `/api/school/${sessionId}/complete`,
    payload: { presentUserIds: [3] }, cookies: { token } });
  expect(first.json().awarded[0]).toMatchObject({ userId: 3, points: 100 });

  const again = await app.inject({ method: "POST", url: `/api/school/${sessionId}/complete`,
    payload: { presentUserIds: [3] }, cookies: { token } });
  expect(again.json().awarded[0].points).toBe(0); // idempotent
});

test("rejects a non-numeric session id (400) and an unknown session (404)", async () => {
  const bad = await app.inject({ method: "POST", url: "/api/school/abc/complete",
    payload: { presentUserIds: [3] }, cookies: { token } });
  expect(bad.statusCode).toBe(400);

  const missing = await app.inject({ method: "POST", url: "/api/school/99999/complete",
    payload: { presentUserIds: [3] }, cookies: { token } });
  expect(missing.statusCode).toBe(404);
});
