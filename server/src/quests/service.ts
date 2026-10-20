import type { QuestResult, SideQuestDTO } from "@shared/types.js";
import { and, eq } from "drizzle-orm";
import { db, schema } from "../db/client.js";
import { awardWithStreak, regionStatuses, todayUTC } from "../scoring/service.js";

// --- Stored payload shapes (server-side; vocab_blast keeps answerIndex) -------
interface StoredVocabQuestion { prompt: string; options: string[]; answerIndex: number; }
interface StoredVocabBlast { questions: StoredVocabQuestion[]; }
interface StoredWordOfDay { es: string; en: string; example: string | null; }
interface StoredRoleplay { title: string; scenario: string; }

const VOCAB_BLAST_POINTS = 40;
const WORD_OF_DAY_POINTS = 15;
const ROLEPLAY_POINTS = 30;
const VOCAB_BLAST_QUESTIONS = 5;

// Roleplay scenarios per stop; one is chosen deterministically by date + region.
// No secrets live in the payload — these ship to the client as-is. A stop with
// no entry falls back to DEFAULT_ROLEPLAYS.
const ROLEPLAY_BY_SLUG: Record<string, StoredRoleplay[]> = {
  medellin: [
    { title: "Pedir un tinto", scenario: "estás en un café en Medellín, pide un tinto y da las gracias" },
    { title: "Saludos", scenario: "preséntate a un paisa y pregúntale cómo está" },
    { title: "Mucho gusto", scenario: "conoces a alguien nuevo: saluda, di tu nombre y 'mucho gusto'" },
  ],
  cartagena: [
    { title: "En el mercado", scenario: "estás en el mercado, pregunta el precio de una arepa y pide una" },
    { title: "Pedir un jugo", scenario: "pide un jugo de mango y pregunta cuánto cuesta" },
    { title: "La cuenta", scenario: "terminaste de comer: pide la cuenta amablemente" },
  ],
  barranquilla: [
    { title: "En la fiesta", scenario: "estás en una fiesta: saluda, invita a bailar y ofrece una cerveza" },
    { title: "¡Salud!", scenario: "haz un brindis con tus amigos y di que la música está chévere" },
  ],
  "santa-marta": [
    { title: "Pedir direcciones", scenario: "estás perdido: pregunta cómo llegar a la playa" },
    { title: "Tomar el bus", scenario: "pregunta dónde se toma el bus y si está cerca o lejos" },
  ],
  "sierra-nevada": [
    { title: "En el sendero", scenario: "estás caminando con un guía: di que estás cansado y pide agua" },
    { title: "¡Cuidado!", scenario: "advierte a tu amigo de una piedra y pregúntale cómo se siente" },
  ],
  "medellin-finale": [
    { title: "El viaje", scenario: "cuenta a un amigo qué aprendiste y qué extrañas de Colombia" },
    { title: "Hasta pronto", scenario: "despídete de Colombia y di que vuelves el próximo año" },
  ],
};
const DEFAULT_ROLEPLAYS: StoredRoleplay[] = ROLEPLAY_BY_SLUG.medellin;

/** Small deterministic string hash (FNV-1a), non-negative 32-bit. PURE. */
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic Fisher-Yates shuffle seeded by `seed` (xorshift32). PURE. */
function seededShuffle<T>(arr: readonly T[], seed: number): T[] {
  const out = arr.slice();
  let s = (seed >>> 0) || 1;
  const rand = () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 0x100000000;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function buildVocabBlast(regionId: number, today: string): StoredVocabBlast {
  const vocab = db.select().from(schema.vocab).where(eq(schema.vocab.regionId, regionId)).all();
  const allEs = Array.from(
    new Set(db.select({ es: schema.vocab.es }).from(schema.vocab).all().map((v) => v.es)),
  );
  const chosen = seededShuffle(vocab, hashStr(`${today}:blast:${regionId}`))
    .slice(0, Math.min(VOCAB_BLAST_QUESTIONS, vocab.length));

  const questions = chosen.map((v) => {
    const distractors = seededShuffle(allEs.filter((es) => es !== v.es), hashStr(`${today}:d:${v.id}`)).slice(0, 3);
    const options = seededShuffle([v.es, ...distractors], hashStr(`${today}:o:${v.id}`));
    return { prompt: `¿Cómo se dice "${v.en}"?`, options, answerIndex: options.indexOf(v.es) };
  });
  return { questions };
}

function buildWordOfDay(regionId: number, today: string): StoredWordOfDay {
  const vocab = db.select().from(schema.vocab).where(eq(schema.vocab.regionId, regionId)).all();
  const v = vocab[hashStr(today) % vocab.length];
  return { es: v.es, en: v.en, example: v.example ?? null };
}

function buildRoleplay(regionId: number, today: string): StoredRoleplay {
  const region = db.select({ slug: schema.regions.slug }).from(schema.regions)
    .where(eq(schema.regions.id, regionId)).get();
  const pool = (region && ROLEPLAY_BY_SLUG[region.slug]) || DEFAULT_ROLEPLAYS;
  return pool[hashStr(`${today}:roleplay:${regionId}`) % pool.length];
}

/**
 * Idempotently create today's quests for `regionId`. The unique(date, regionId,
 * type) index makes re-inserts no-ops; we also check-first to skip building the
 * payload. Returns today's quest rows for the region.
 */
/** True iff the region has at least one vocab row (needed to build quests). */
function regionHasVocab(regionId: number): boolean {
  return !!db.select({ id: schema.vocab.id }).from(schema.vocab)
    .where(eq(schema.vocab.regionId, regionId)).get();
}

/**
 * The region whose vocab today's quests should draw from: the furthest stop the
 * user has reached (current or complete) that actually has content, else the
 * first region with content, else null. This keeps quests flowing from known
 * vocab even when the user's current map stop is an unseeded future region.
 */
function resolveQuestRegionId(userId: number): number | null {
  const statuses = regionStatuses(userId); // in region order
  const reached = statuses.filter(
    (r) => (r.status === "current" || r.status === "complete") && regionHasVocab(r.id),
  );
  if (reached.length > 0) return reached[reached.length - 1].id;
  const any = statuses.find((r) => regionHasVocab(r.id));
  return any ? any.id : null;
}

/**
 * The vocab (es/en) of the region today's quests draw from for this user — the
 * same furthest-region-with-content resolution the quests use. Empty if none.
 * Used to ground Pablito's replies in what the student is actually learning.
 */
export function userRegionVocab(userId: number): { es: string; en: string }[] {
  const regionId = resolveQuestRegionId(userId);
  if (regionId === null) return [];
  return db.select({ es: schema.vocab.es, en: schema.vocab.en }).from(schema.vocab)
    .where(eq(schema.vocab.regionId, regionId)).all();
}

export function ensureTodayQuests(regionId: number, today: string) {
  // A region with no vocab can't produce quests — never build (would divide by zero).
  if (!regionHasVocab(regionId)) {
    return db.select().from(schema.sideQuests)
      .where(and(eq(schema.sideQuests.date, today), eq(schema.sideQuests.regionId, regionId))).all();
  }
  const defs = [
    { type: "vocab_blast" as const, points: VOCAB_BLAST_POINTS, build: () => buildVocabBlast(regionId, today) },
    { type: "word_of_day" as const, points: WORD_OF_DAY_POINTS, build: () => buildWordOfDay(regionId, today) },
    { type: "roleplay" as const, points: ROLEPLAY_POINTS, build: () => buildRoleplay(regionId, today) },
  ];
  for (const d of defs) {
    const existing = db.select({ id: schema.sideQuests.id }).from(schema.sideQuests)
      .where(and(
        eq(schema.sideQuests.date, today),
        eq(schema.sideQuests.regionId, regionId),
        eq(schema.sideQuests.type, d.type),
      )).get();
    if (existing) continue;
    db.insert(schema.sideQuests)
      .values({ date: today, regionId, type: d.type, payloadJson: d.build(), points: d.points })
      .onConflictDoNothing().run();
  }
  return db.select().from(schema.sideQuests)
    .where(and(eq(schema.sideQuests.date, today), eq(schema.sideQuests.regionId, regionId))).all();
}

/** True iff a ledger row (user, "sidequest", questId) exists — i.e. completed. */
function isDone(userId: number, questId: number): boolean {
  return !!db.select({ id: schema.pointsLedger.id }).from(schema.pointsLedger)
    .where(and(
      eq(schema.pointsLedger.userId, userId),
      eq(schema.pointsLedger.sourceType, "sidequest"),
      eq(schema.pointsLedger.sourceId, questId),
    )).get();
}

/**
 * Today's quests for the user's current region, each with a per-user `done` flag.
 * vocab_blast questions are returned WITHOUT their answerIndex (stripped).
 */
export function getTodayQuests(userId: number): SideQuestDTO[] {
  const today = todayUTC();
  const regionId = resolveQuestRegionId(userId);
  if (regionId === null) return [];

  return ensureTodayQuests(regionId, today).map((q): SideQuestDTO => {
    const done = isDone(userId, q.id);
    if (q.type === "vocab_blast") {
      const payload = q.payloadJson as StoredVocabBlast;
      return {
        id: q.id, type: "vocab_blast", points: q.points, done,
        payload: { questions: payload.questions.map((qq) => ({ prompt: qq.prompt, options: qq.options })) },
      };
    }
    if (q.type === "roleplay") {
      const payload = q.payloadJson as StoredRoleplay;
      return { id: q.id, type: "roleplay", points: q.points, done, payload };
    }
    const payload = q.payloadJson as StoredWordOfDay;
    return { id: q.id, type: "word_of_day", points: q.points, done, payload };
  });
}

/**
 * Complete a quest for a user. If already done, returns `{ alreadyDone: true }`
 * WITHOUT touching the streak (awardWithStreak is not called). Otherwise grades
 * (vocab_blast) or acknowledges (word_of_day), awards streak-multiplied points
 * idempotently, and reveals the correct answers (vocab_blast only).
 */
export function completeQuest(userId: number, questId: number, answers?: number[]): QuestResult | null {
  const quest = db.select().from(schema.sideQuests).where(eq(schema.sideQuests.id, questId)).get();
  if (!quest) return null;

  if (isDone(userId, questId)) return { alreadyDone: true, awarded: 0, multiplier: 1 };

  let base: number;
  let results: { correct: boolean; answerIndex: number }[] | undefined;

  if (quest.type === "vocab_blast") {
    const { questions } = quest.payloadJson as StoredVocabBlast;
    const given = answers ?? [];
    let correct = 0;
    results = questions.map((qq, i) => {
      const ok = given[i] === qq.answerIndex;
      if (ok) correct++;
      return { correct: ok, answerIndex: qq.answerIndex };
    });
    base = questions.length > 0 ? Math.round(quest.points * correct / questions.length) : 0;
  } else {
    base = quest.points;
  }

  const { awarded, multiplier } = awardWithStreak(userId, "sidequest", questId, base);
  return results ? { awarded, multiplier, results } : { awarded, multiplier };
}
