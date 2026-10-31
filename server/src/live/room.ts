import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "../db/client.js";
import { awardLive, liveScore } from "../scoring/service.js";

export interface QuizQ { questionId: number; prompt: string; options: string[]; correctIndex: number; }
export interface LivePlayer { userId: number; name: string; avatar: string; }

interface Answer { choiceIndex: number; ms: number; }
interface TotalRow { userId: number; name: string; avatar: string; points: number; }
interface RoundRow { userId: number; points: number; ms: number; correct: boolean; }

// server→client event union (matches the plan's protocol)
export type LiveEvent =
  | { t: "lobby"; hostUserId: number; players: LivePlayer[] }
  | { t: "question"; index: number; total: number; questionId: number; prompt: string; options: string[]; timeLimitMs: number }
  | { t: "answered"; userId: number }
  | { t: "reveal"; correctIndex: number; round: RoundRow[]; totals: TotalRow[] }
  | { t: "end"; podium: TotalRow[] }
  | { t: "error"; message: string };

const TIME_LIMIT_MS = 15000;
// A live buzzer round should be short & punchy, not the region's whole homework.
const LIVE_QUESTION_LIMIT = 6;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Deterministic Fisher-Yates shuffle (xorshift32) so a given game is reproducible. PURE. */
function seededShuffle<T>(arr: readonly T[], seed: number): T[] {
  const out = arr.slice();
  let s = (seed >>> 0) || 1;
  const rand = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 0x100000000; };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * A single in-memory live-quiz room (the three players). Pure mechanism: no sockets,
 * no host-only enforcement (the WS layer checks `userId === hostUserId`). Methods mutate
 * the room's state and return the event to broadcast.
 */
export class LiveRoom {
  status: "lobby" | "question" | "reveal" | "ended" = "lobby";
  hostUserId = 0;
  regionId = 0;
  questions: QuizQ[] = [];
  index = 0;
  questionStartedAt = 0;
  readonly timeLimitMs = TIME_LIMIT_MS;
  gameStartedAtSec = 0;
  private readonly answers = new Map<number, Answer>();
  private readonly totals = new Map<number, number>();
  private readonly players = new Map<number, LivePlayer>();
  private readonly now: () => number;
  private lastReveal: LiveEvent | null = null;

  constructor(opts?: { now?: () => number }) {
    this.now = opts?.now ?? Date.now;
  }

  /** Load a user's profile for the players list; returns null if the user does not exist. */
  private loadPlayer(userId: number): LivePlayer | null {
    const u = db.select({ name: schema.users.name, avatar: schema.users.avatar })
      .from(schema.users).where(eq(schema.users.id, userId)).get();
    return u ? { userId, name: u.name, avatar: u.avatar } : null;
  }

  private lobbyEvent(): LiveEvent {
    return { t: "lobby", hostUserId: this.hostUserId, players: [...this.players.values()] };
  }

  private questionEvent(): LiveEvent {
    const q = this.questions[this.index];
    return {
      t: "question", index: this.index, total: this.questions.length,
      questionId: q.questionId, prompt: q.prompt, options: q.options, timeLimitMs: this.timeLimitMs,
    };
  }

  private totalsSorted(): TotalRow[] {
    return [...this.players.values()]
      .map((p) => ({ userId: p.userId, name: p.name, avatar: p.avatar, points: this.totals.get(p.userId) ?? 0 }))
      .sort((a, b) => b.points - a.points);
  }

  /** Build the question set from the region's multiple_choice exercises, capped & shuffled per game. */
  private loadQuestions(regionId: number, seed: number): QuizQ[] {
    const lessonRows = db.select({ id: schema.lessons.id }).from(schema.lessons)
      .where(eq(schema.lessons.regionId, regionId)).all();
    if (lessonRows.length === 0) return [];
    const exRows = db.select().from(schema.exercises)
      .where(and(
        inArray(schema.exercises.lessonId, lessonRows.map((l) => l.id)),
        eq(schema.exercises.type, "multiple_choice"),
      )).orderBy(schema.exercises.order).all();
    const valid = exRows
      .map((e) => {
        const options = (e.optionsJson ?? []) as string[];
        return { questionId: e.id, prompt: e.prompt, options, correctIndex: options.indexOf(e.answer) };
      })
      // Drop any malformed question whose stored answer isn't one of its options,
      // so a content typo can never make every player silently score 0.
      .filter((q) => q.correctIndex >= 0);
    // Shuffle (seeded for reproducibility) and cap to a short live round.
    return seededShuffle(valid, seed).slice(0, LIVE_QUESTION_LIMIT);
  }

  create(hostUserId: number, regionId: number): LiveEvent {
    const gameStartedAtSec = Math.floor(this.now() / 1000);
    const questions = this.loadQuestions(regionId, gameStartedAtSec);
    if (questions.length === 0) return { t: "error", message: "This region has no live-quiz questions." };
    this.hostUserId = hostUserId;
    this.regionId = regionId;
    this.questions = questions;
    this.index = 0;
    this.status = "lobby";
    this.gameStartedAtSec = gameStartedAtSec;
    this.answers.clear();
    this.totals.clear();
    this.players.clear();
    this.lastReveal = null;
    // The host is a PRESENTER (the shared TV screen), not a player — do NOT add
    // them to `players`. Players join only via join(); if the host also wants to
    // play, they open /arena on their phone (same userId → one player entry).
    return this.lobbyEvent();
  }

  join(userId: number): LiveEvent {
    if (!this.players.has(userId)) {
      const p = this.loadPlayer(userId);
      if (p) this.players.set(userId, p);
    }
    return this.lobbyEvent();
  }

  start(): LiveEvent {
    // Only start from the lobby — re-issuing start mid-game would desync the
    // in-memory totals from the (idempotent) ledger.
    if (this.status !== "lobby") return { t: "error", message: "Game already started." };
    this.status = "question";
    this.index = 0;
    this.questionStartedAt = this.now();
    this.answers.clear();
    return this.questionEvent();
  }

  answer(userId: number, choiceIndex: number): LiveEvent {
    if (this.status !== "question") return { t: "error", message: "Not accepting answers right now." };
    if (!this.players.has(userId)) return { t: "error", message: "Not a player in this room." };
    if (this.answers.has(userId)) return { t: "error", message: "Already answered." };
    const ms = clamp(this.now() - this.questionStartedAt, 0, this.timeLimitMs);
    this.answers.set(userId, { choiceIndex, ms });
    return { t: "answered", userId };
  }

  allAnswered(): boolean {
    return this.players.size > 0 && this.answers.size === this.players.size;
  }

  reveal(): LiveEvent {
    const q = this.questions[this.index];
    const awarding = this.status === "question"; // only award on the first transition
    const round: RoundRow[] = [];
    for (const p of this.players.values()) {
      const a = this.answers.get(p.userId);
      const correct = a?.choiceIndex === q.correctIndex;
      const ms = a?.ms ?? this.timeLimitMs;
      const points = liveScore(correct, ms, this.timeLimitMs);
      round.push({ userId: p.userId, points, ms, correct });
      if (awarding) {
        awardLive(p.userId, this.gameStartedAtSec * 100 + this.index, points);
        this.totals.set(p.userId, (this.totals.get(p.userId) ?? 0) + points);
      }
    }
    this.status = "reveal";
    this.lastReveal = { t: "reveal", correctIndex: q.correctIndex, round, totals: this.totalsSorted() };
    return this.lastReveal;
  }

  /**
   * The event a (re)connecting or late client should receive for the CURRENT state.
   * Lets the server resync a client instead of ever erroring with "Game already
   * started" — a late/duplicate action just snaps the caller to what's happening now.
   */
  syncEvents(): LiveEvent[] {
    // The results screen also needs the question it is showing the answer to.
    return this.status === "reveal" ? [this.questionEvent(), this.syncEvent()] : [this.syncEvent()];
  }

  syncEvent(): LiveEvent {
    switch (this.status) {
      case "question": return this.questionEvent();
      case "reveal": return this.lastReveal ?? this.questionEvent();
      case "ended": return { t: "end", podium: this.totalsSorted() };
      default: return this.lobbyEvent();
    }
  }

  next(): LiveEvent {
    if (this.index < this.questions.length - 1) {
      this.index++;
      this.status = "question";
      this.questionStartedAt = this.now();
      this.answers.clear();
      return this.questionEvent();
    }
    this.status = "ended";
    return { t: "end", podium: this.totalsSorted() };
  }
}
