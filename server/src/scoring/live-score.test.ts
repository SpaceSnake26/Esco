import { expect, test } from "vitest";
import { liveScore } from "./service.js";

const LIMIT = 15000;

test("a fast correct answer scores higher than a slow correct one", () => {
  const fast = liveScore(true, 1000, LIMIT);
  const slow = liveScore(true, 12000, LIMIT);
  expect(fast).toBeGreaterThan(slow);
  // both are correct, so both are at least the 100 base
  expect(slow).toBeGreaterThanOrEqual(100);
});

test("an instant correct answer approaches the 200 ceiling", () => {
  expect(liveScore(true, 0, LIMIT)).toBe(200);
});

test("ms >= timeLimit still yields exactly 100 for a correct answer (clamp, never below 100)", () => {
  expect(liveScore(true, LIMIT, LIMIT)).toBe(100);
  // way past the limit must not go below 100
  expect(liveScore(true, LIMIT * 5, LIMIT)).toBe(100);
});

test("a wrong answer scores 0 regardless of speed", () => {
  expect(liveScore(false, 0, LIMIT)).toBe(0);
  expect(liveScore(false, 5000, LIMIT)).toBe(0);
  expect(liveScore(false, LIMIT * 2, LIMIT)).toBe(0);
});
