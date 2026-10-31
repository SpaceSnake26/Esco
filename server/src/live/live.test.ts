import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, expect, test } from "vitest";
import { WebSocket } from "ws";
import { buildApp } from "../app.js";
import type { LiveEvent } from "./room.js";
import { seedArenaFixtureRegion } from "./testFixture.js";

// Fixture region: 3 multiple_choice questions, correct option always at index 1.
const CORRECT = 1;
const WRONG = 0;

let app: Awaited<ReturnType<typeof buildApp>>;
let baseWsUrl: string;
let ARENA = 0;
const open: WebSocket[] = [];

async function cookieFor(userId: number, pin: string): Promise<string> {
  const res = await app.inject({ method: "POST", url: "/api/auth/login", payload: { userId, pin } });
  expect(res.statusCode).toBe(200);
  const c = res.cookies.find((x) => x.name === "token");
  if (!c) throw new Error("no token cookie");
  return c.value;
}

function connect(token?: string): WebSocket {
  const headers = token ? { Cookie: `token=${token}` } : undefined;
  const ws = new WebSocket(`${baseWsUrl}/api/live/ws`, { headers });
  open.push(ws);
  return ws;
}

/** Resolve the next message matching `pred`, or reject after `timeoutMs`. */
function nextMatching(
  ws: WebSocket,
  pred: (ev: LiveEvent) => boolean,
  timeoutMs = 2000,
): Promise<LiveEvent> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off("message", onMsg);
      reject(new Error("timed out waiting for a matching message"));
    }, timeoutMs);
    function onMsg(raw: Buffer) {
      let ev: LiveEvent;
      try {
        ev = JSON.parse(raw.toString()) as LiveEvent;
      } catch {
        return;
      }
      if (pred(ev)) {
        clearTimeout(timer);
        ws.off("message", onMsg);
        resolve(ev);
      }
    }
    ws.on("message", onMsg);
  });
}

function opened(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    ws.once("open", () => resolve());
    ws.once("error", reject);
  });
}

beforeAll(async () => {
  app = buildApp();
  ARENA = seedArenaFixtureRegion();
  await app.listen({ port: 0, host: "127.0.0.1" });
  const addr = app.server.address() as AddressInfo;
  baseWsUrl = `ws://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
  for (const ws of open) {
    try {
      ws.close();
    } catch {
      /* ignore */
    }
  }
  await app.close();
});

test("two-client live game: lobby → question (no correctIndex) → reveal", async () => {
  const host = await cookieFor(1, "111111"); // Fabio
  const guest = await cookieFor(2, "222222"); // Aleks

  const c1 = connect(host);
  const c2 = connect(guest);
  await Promise.all([opened(c1), opened(c2)]);

  // Host creates the room → both clients receive a lobby event.
  const c1Lobby = nextMatching(c1, (e) => e.t === "lobby");
  const c2Lobby = nextMatching(c2, (e) => e.t === "lobby");
  c1.send(JSON.stringify({ t: "host:create", regionId: ARENA }));
  const [l1] = await Promise.all([c1Lobby, c2Lobby]);
  if (l1.t !== "lobby") throw new Error("expected lobby");
  expect(l1.hostUserId).toBe(1);

  // The host is a presenter, not a player — nobody is in the room yet.
  expect(l1.players.map((p) => p.userId)).toEqual([]);

  // Both play on their phones: the host (who also wants to play) and the guest join.
  const bothPlayers = nextMatching(c1, (e) => e.t === "lobby" && e.players.length === 2);
  c1.send(JSON.stringify({ t: "join" }));
  c2.send(JSON.stringify({ t: "join" }));
  const lob2 = await bothPlayers;
  if (lob2.t !== "lobby") throw new Error("expected lobby");
  expect(lob2.players.map((p) => p.userId).sort()).toEqual([1, 2]);

  // Host starts → both get a `question`, and the correct answer is NOT leaked.
  const c1Q = nextMatching(c1, (e) => e.t === "question");
  const c2Q = nextMatching(c2, (e) => e.t === "question");
  c1.send(JSON.stringify({ t: "host:start" }));
  const [q1, q2] = await Promise.all([c1Q, c2Q]);
  if (q1.t !== "question" || q2.t !== "question") throw new Error("expected question");
  expect(q1.index).toBe(0);
  expect((q1 as Record<string, unknown>).correctIndex).toBeUndefined();
  expect((q2 as Record<string, unknown>).correctIndex).toBeUndefined();

  // Both answer (host correct + fast, guest wrong) → both receive the reveal.
  const c1Reveal = nextMatching(c1, (e) => e.t === "reveal");
  const c2Reveal = nextMatching(c2, (e) => e.t === "reveal");
  c1.send(JSON.stringify({ t: "answer", index: CORRECT }));
  c2.send(JSON.stringify({ t: "answer", index: WRONG }));
  const [rev] = await Promise.all([c1Reveal, c2Reveal]);
  if (rev.t !== "reveal") throw new Error("expected reveal");
  expect(rev.correctIndex).toBe(CORRECT);
  const t1 = rev.totals.find((r) => r.userId === 1)!;
  const t2 = rev.totals.find((r) => r.userId === 2)!;
  expect(t1.points).toBeGreaterThan(t2.points);
  expect(t2.points).toBe(0);

  // Drive to the end: advance through remaining questions.
  for (;;) {
    const c1Next = nextMatching(c1, (e) => e.t === "question" || e.t === "end");
    c1.send(JSON.stringify({ t: "host:next" }));
    const nxt = await c1Next;
    if (nxt.t === "end") {
      expect(nxt.podium[0].userId).toBe(1);
      break;
    }
    // Answer the new question so the next reveal can fire (not strictly needed to advance).
    c1.send(JSON.stringify({ t: "answer", index: CORRECT }));
    c2.send(JSON.stringify({ t: "answer", index: WRONG }));
    await nextMatching(c1, (e) => e.t === "reveal");
  }
});

test("foolproof: everyone ENTERs (no host URL) and ANY player can start", async () => {
  // The exact real-world flow: each friend opens the one screen and 'enter's — the
  // first creates the room, the rest join — then ANY of them taps Start.
  const a = await cookieFor(1, "111111");
  const b = await cookieFor(2, "222222");
  const c = await cookieFor(3, "333333");
  const c1 = connect(a), c2 = connect(b), c3 = connect(c);
  await Promise.all([opened(c1), opened(c2), opened(c3)]);

  // Previous test's game ended → first enter creates, the others join.
  const three = nextMatching(c3, (e) => e.t === "lobby" && e.players.length === 3, 4000);
  c1.send(JSON.stringify({ t: "enter", regionId: ARENA }));
  await nextMatching(c1, (e) => e.t === "lobby");
  c2.send(JSON.stringify({ t: "enter", regionId: ARENA }));
  c3.send(JSON.stringify({ t: "enter", regionId: ARENA }));
  const lobby = await three;
  if (lobby.t !== "lobby") throw new Error("expected lobby");
  expect(lobby.players.map((p) => p.userId).sort()).toEqual([1, 2, 3]);

  // A NON-creator (player 3) starts the game → EVERYONE gets the question.
  const q2 = nextMatching(c2, (e) => e.t === "question");
  c3.send(JSON.stringify({ t: "host:start" }));
  expect((await q2).t).toBe("question");

  // Clean up: everyone answers (auto-reveal), advance until the game ends.
  for (;;) {
    c1.send(JSON.stringify({ t: "answer", index: CORRECT }));
    c2.send(JSON.stringify({ t: "answer", index: WRONG }));
    c3.send(JSON.stringify({ t: "answer", index: WRONG }));
    await nextMatching(c1, (e) => e.t === "reveal");
    const nxt = nextMatching(c1, (e) => e.t === "question" || e.t === "end");
    c1.send(JSON.stringify({ t: "host:next" }));
    if ((await nxt).t === "end") break;
  }
});

test("a duplicate Start mid-game resyncs the tapper — never 'Game already started'", async () => {
  const a = await cookieFor(1, "111111");
  const b = await cookieFor(2, "222222");
  const c1 = connect(a), c2 = connect(b);
  await Promise.all([opened(c1), opened(c2)]);

  // Fresh room (prior game ended): both enter.
  const two = nextMatching(c2, (e) => e.t === "lobby" && e.players.length >= 2, 4000);
  c1.send(JSON.stringify({ t: "enter", regionId: ARENA }));
  await nextMatching(c1, (e) => e.t === "lobby");
  c2.send(JSON.stringify({ t: "enter", regionId: ARENA }));
  await two;

  // c1 starts → game running.
  const q1 = nextMatching(c1, (e) => e.t === "question");
  c1.send(JSON.stringify({ t: "host:start" }));
  await q1;

  // c2 taps Start too (double/late). Must NOT error — it resyncs to the question.
  const q2 = nextMatching(c2, (e) => e.t === "question" || e.t === "error", 3000);
  c2.send(JSON.stringify({ t: "host:start" }));
  expect((await q2).t).toBe("question");

  // Drain to 'ended' so the next test starts from a clean room.
  for (;;) {
    c1.send(JSON.stringify({ t: "answer", index: CORRECT }));
    c2.send(JSON.stringify({ t: "answer", index: WRONG }));
    const rev = nextMatching(c1, (e) => e.t === "reveal");
    c1.send(JSON.stringify({ t: "host:reveal" })); // other connected sockets never answer
    await rev;
    const nxt = nextMatching(c1, (e) => e.t === "question" || e.t === "end");
    c1.send(JSON.stringify({ t: "host:next" }));
    if ((await nxt).t === "end") break;
  }
});

test("Play again by one player brings everyone in; reload on results keeps the question; reset works", async () => {
  const [a, b, c] = await Promise.all([cookieFor(1, "111111"), cookieFor(2, "222222"), cookieFor(3, "333333")]);
  const c1 = connect(a), c2 = connect(b);
  let c3 = connect(c);
  await Promise.all([opened(c1), opened(c2), opened(c3)]);

  // Only player 1 taps: the lobby still lists every connected player.
  const lobby = nextMatching(c3, (e) => e.t === "lobby" && e.players.length >= 3, 4000);
  c1.send(JSON.stringify({ t: "enter", regionId: ARENA }));
  await lobby;

  const q = nextMatching(c3, (e) => e.t === "question");
  c2.send(JSON.stringify({ t: "host:start" }));
  await q;
  const rev = nextMatching(c3, (e) => e.t === "reveal");
  c1.send(JSON.stringify({ t: "host:reveal" }));
  await rev;

  // Reloading on the results screen delivers the question AND the reveal.
  c3.close();
  c3 = connect(c);
  const got = [nextMatching(c3, (e) => e.t === "question", 4000), nextMatching(c3, (e) => e.t === "reveal", 4000)];
  await opened(c3);
  await Promise.all(got);

  // Reset from the middle of a game: everyone back in a fresh lobby, and it starts.
  const fresh = nextMatching(c2, (e) => e.t === "lobby" && e.players.length >= 3, 4000);
  c3.send(JSON.stringify({ t: "host:reset", regionId: ARENA }));
  await fresh;
  const again = nextMatching(c2, (e) => e.t === "question");
  c3.send(JSON.stringify({ t: "host:start" }));
  expect((await again).t).toBe("question");
  c1.send(JSON.stringify({ t: "host:reset", regionId: ARENA }));
});

test("host:reveal forces a reveal mid-question even if not all players answered", async () => {
  const host = await cookieFor(1, "111111"); // Fabio
  const guest = await cookieFor(2, "222222"); // Aleks

  const c1 = connect(host);
  const c2 = connect(guest);
  await Promise.all([opened(c1), opened(c2)]);

  // Fresh room (the previous game ended). Both the host and the guest join as players.
  const c1Lobby = nextMatching(c1, (e) => e.t === "lobby");
  c1.send(JSON.stringify({ t: "host:create", regionId: ARENA }));
  await c1Lobby;

  const bothPlayers = nextMatching(c1, (e) => e.t === "lobby" && e.players.length === 2);
  c1.send(JSON.stringify({ t: "join" }));
  c2.send(JSON.stringify({ t: "join" }));
  await bothPlayers;

  // Start the question.
  const c1Q = nextMatching(c1, (e) => e.t === "question");
  c1.send(JSON.stringify({ t: "host:start" }));
  await c1Q;

  // Only the guest answers. Wait for the server to record it before forcing a reveal
  // so the order (answer, then reveal) is deterministic.
  const guestAnswered = nextMatching(c1, (e) => e.t === "answered" && e.userId === 2);
  c2.send(JSON.stringify({ t: "answer", index: CORRECT }));
  await guestAnswered;

  // The host (who never answered this question) forces the reveal for everyone.
  const c2Reveal = nextMatching(c2, (e) => e.t === "reveal");
  c1.send(JSON.stringify({ t: "host:reveal" }));
  const rev = await c2Reveal;
  if (rev.t !== "reveal") throw new Error("expected reveal");
  // Guest answered correctly → points; host never buzzed → 0. No deadlock.
  expect(rev.totals.find((r) => r.userId === 2)!.points).toBeGreaterThan(0);
  expect(rev.totals.find((r) => r.userId === 1)!.points).toBe(0);
});

test("a socket opened without a cookie is closed and receives no events", async () => {
  const anon = connect(); // no token
  const closed = new Promise<number>((resolve) => anon.once("close", (code) => resolve(code)));
  let gotMessage = false;
  anon.on("message", () => {
    gotMessage = true;
  });
  const code = await Promise.race([
    closed,
    new Promise<number>((_, reject) => setTimeout(() => reject(new Error("socket was not closed")), 2000)),
  ]);
  expect(typeof code).toBe("number");
  expect(gotMessage).toBe(false);
});
