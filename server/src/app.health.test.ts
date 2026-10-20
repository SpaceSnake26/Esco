import { expect, test } from "vitest";
import { buildApp } from "./app.js";

test("GET /api/health returns ok", async () => {
  const app = buildApp();
  const res = await app.inject({ method: "GET", url: "/api/health" });
  expect(res.statusCode).toBe(200);
  expect(res.json()).toEqual({ status: "ok" });
  await app.close();
});
