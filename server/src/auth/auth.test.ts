import { beforeAll, expect, test } from "vitest";
import { buildApp } from "../app.js";

let app: Awaited<ReturnType<typeof buildApp>>;
beforeAll(() => { app = buildApp(); });

test("login with correct PIN sets cookie and /api/me returns the user", async () => {
  const login = await app.inject({
    method: "POST", url: "/api/auth/login",
    payload: { userId: 1, pin: "111111" },
  });
  expect(login.statusCode).toBe(200);
  const cookie = login.cookies.find((c) => c.name === "token");
  expect(cookie).toBeTruthy();

  const me = await app.inject({
    method: "GET", url: "/api/me",
    cookies: { token: cookie!.value },
  });
  expect(me.statusCode).toBe(200);
  expect(me.json()).toMatchObject({ id: 1, name: expect.any(String) });
});

test("login with wrong PIN is rejected", async () => {
  const res = await app.inject({
    method: "POST", url: "/api/auth/login",
    payload: { userId: 1, pin: "0000" },
  });
  expect(res.statusCode).toBe(401);
});

test("/api/me without cookie is 401", async () => {
  const res = await app.inject({ method: "GET", url: "/api/me" });
  expect(res.statusCode).toBe(401);
});
