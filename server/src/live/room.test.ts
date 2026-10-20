import { and, eq } from "drizzle-orm";
import { beforeAll, expect, test } from "vitest";
import { db, schema } from "../db/client.js";
import { LiveRoom } from "./room.js";
import { seedArenaFixtureRegion } from "./testFixture.js";

// All live-quiz tests run against the fixture region (3 MC, correct = index 1),
// so they're independent of the real curriculum content.
let REGION = 0;
beforeAll(() => { REGION = seedArenaFixtureRegion(); });

// A deterministic, injectable clock so answer timing is exact.
function makeClock(startMs = 1_000_000) {
  let t = startMs;
  return { now: () => t, advance: (ms: number) => { t += ms; } };
}

// Seed facts (region 1 = Medellín): 3 multiple_choice exercises, each with the
// correct option at index 1 ("Gracias", "A black coffee", "How are you?").
const CORRECT = 1;
const WRONG = 0;

function liveRows(userId: number) {
  return db.select().from(schema.pointsLedger)
    .where(and(eq(schema.pointsLedger.userId, userId), eq(schema.pointsLedger.sourceType, "live"))).all();
}

test("create with a region that has no multiple_choice questions returns an error event", () => {
  // Every seeded stop now has questions, so make a genuinely empty region for this path.
  const empty = db.insert(schema.regions)
    .values({ order: 99, slug: "empty-test-region", name: "Empty", theme: "none" })
    .returning().get();
  const room = new LiveRoom({ now: makeClock().now });
  const ev = room.create(1, empty.id);
  expect(ev.t).toBe("error");
});

test("single round: fast-correct beats slow-wrong, totals sorted, points persisted", () => {
  const clock = makeClock(1_000_000); // gameStartedAtSec = 1000
  const room = new LiveRoom({ now: clock.now });

  const lobby = room.create(1, REGION);
  expect(lobby.t).toBe("lobby");
  if (lobby.t !== "lobby") throw new Error("unreachable");
  expect(lobby.hostUserId).toBe(1);
  // The host is a presenter, not a player — creating the room adds nobody.
  expect(lobby.players.map((p) => p.userId)).toEqual([]);

  // Players join on their phones. Host 1 also plays; dedupe: re-joining does not duplicate.
  room.join(1);
  room.join(1);
  const lobby2 = room.join(2);
  if (lobby2.t !== "lobby") throw new Error("unreachable");
  expect(lobby2.players.map((p) => p.userId).sort()).toEqual([1, 2]);

  const q = room.start();
  if (q.t !== "question") throw new Error("expected question");
  expect(q.index).toBe(0);
  expect(q.total).toBe(3);
  expect(q.options.length).toBeGreaterThan(1);
  expect((q as Record<string, unknown>).correctIndex).toBeUndefined(); // hidden until reveal

  clock.advance(1000); // player 1: fast + correct
  const a1 = room.answer(1, CORRECT);
  expect(a1).toMatchObject({ t: "answered", userId: 1 });
  expect(room.allAnswered()).toBe(false);

  clock.advance(9000); // player 2: slow + wrong
  const a2 = room.answer(2, WRONG);
  expect(a2).toMatchObject({ t: "answered", userId: 2 });
  expect(room.allAnswered()).toBe(true);

  const rev = room.reveal();
  if (rev.t !== "reveal") throw new Error("expected reveal");
  expect(rev.correctIndex).toBe(CORRECT);

  const r1 = rev.round.find((r) => r.userId === 1)!;
  const r2 = rev.round.find((r) => r.userId === 2)!;
  expect(r1.correct).toBe(true);
  expect(r1.points).toBeGreaterThan(0);
  expect(r2.correct).toBe(false);
  expect(r2.points).toBe(0);

  // totals sorted desc: the fast-correct player is first
  expect(rev.totals[0].userId).toBe(1);
  expect(rev.totals[0].points).toBe(r1.points);
  expect(rev.totals[0].name).toBe("Fabio");
  expect(rev.totals[0].avatar).toBe("🐆");
  expect(rev.totals.find((x) => x.userId === 2)!.points).toBe(0);

  // point row persisted under the "live" source
  const rows = liveRows(1);
  expect(rows.length).toBe(1);
  expect(rows[0].points).toBe(r1.points);
  expect(rows[0].sourceId).toBe(1000 * 100 + 0); // gameStartedAtSec*100 + index
});

test("next() through all questions ends with a sorted podium", () => {
  const clock = makeClock(2_000_000); // gameStartedAtSec = 2000
  const room = new LiveRoom({ now: clock.now });
  room.create(1, REGION);
  room.join(1); // host 1 also plays on their phone
  room.join(2);
  room.join(3);

  room.start();
  let rounds = 0;
  for (;;) {
    clock.advance(1000);
    room.answer(1, CORRECT); // fast correct
    clock.advance(3000);
    room.answer(3, CORRECT); // slower correct
    clock.advance(1000);
    room.answer(2, WRONG); // wrong
    expect(room.allAnswered()).toBe(true);

    const rev = room.reveal();
    expect(rev.t).toBe("reveal");
    rounds++;

    const nxt = room.next();
    if (nxt.t === "end") {
      expect(rounds).toBe(3);
      expect(nxt.podium.map((p) => p.userId)).toEqual([1, 3, 2]); // fast > slow > wrong
      expect(nxt.podium[0].points).toBeGreaterThanOrEqual(nxt.podium[1].points);
      expect(nxt.podium[1].points).toBeGreaterThanOrEqual(nxt.podium[2].points);
      expect(nxt.podium[2].points).toBe(0); // all-wrong player
      break;
    }
    expect(nxt.t).toBe("question");
  }
});

test("a second game (new gameStartedAtSec) awards again under a distinct synthetic id", () => {
  const before = liveRows(1).length;

  const clock = makeClock(9_000_000); // gameStartedAtSec = 9000, distinct from earlier games
  const room = new LiveRoom({ now: clock.now });
  room.create(1, REGION);
  room.join(1); // host also plays on their phone
  room.start();
  clock.advance(500);
  room.answer(1, CORRECT);
  expect(room.allAnswered()).toBe(true);

  const rev = room.reveal();
  if (rev.t !== "reveal") throw new Error("expected reveal");
  expect(rev.round.find((r) => r.userId === 1)!.points).toBeGreaterThan(0);

  const after = liveRows(1);
  expect(after.length).toBe(before + 1); // a brand-new row, not an idempotent no-op
  expect(after.some((r) => r.sourceId === 9000 * 100 + 0)).toBe(true);
});

test("host can force a reveal even when a player never answered (no deadlock)", () => {
  const clock = makeClock(3_000_000); // gameStartedAtSec = 3000, distinct from other games
  const room = new LiveRoom({ now: clock.now });
  room.create(1, REGION);
  room.join(1); // host plays too
  room.join(2); // a phone-player who will never buzz

  room.start();
  clock.advance(1000);
  room.answer(1, CORRECT); // only player 1 answers
  // Without a force-reveal this would deadlock: the auto-reveal trigger never fires.
  expect(room.allAnswered()).toBe(false);

  // Simulate host:reveal — reveal() works regardless of who answered.
  const rev = room.reveal();
  if (rev.t !== "reveal") throw new Error("expected reveal");
  expect(rev.correctIndex).toBe(CORRECT);

  const r1 = rev.round.find((r) => r.userId === 1)!;
  const r2 = rev.round.find((r) => r.userId === 2)!;
  expect(r1.correct).toBe(true);
  expect(r1.points).toBeGreaterThan(0);
  expect(r2.correct).toBe(false);
  expect(r2.points).toBe(0); // the non-answerer scores 0
});
