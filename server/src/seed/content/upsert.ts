import { and, eq } from "drizzle-orm";
import { db, schema } from "../../db/client.js";
import type { AgendaStep } from "../../db/schema.js";

// Additive, idempotent content enrichment. Everything is matched by a NATURAL
// key and only inserted when missing — existing rows (and the player progress
// that references them) are never touched. Safe to re-run on production.

export interface ExerciseSpec {
  type: "multiple_choice" | "fill_blank";
  prompt: string;
  answer: string;
  optionsJson: string[] | null;
  points: number;
}
export interface StopContent {
  slug: string;
  vocab?: { es: string; en: string; example: string }[];
  dialogues?: { title: string; lines: { who: string; es: string; en: string }[] }[];
  grammar?: { title: string; intro?: string; points: { es: string; en: string }[] }[];
  homeworks?: { title: string; exercises: ExerciseSpec[] }[];
  agendas?: { order: number; steps: AgendaStep[] }[];
}

function nextLessonOrder(regionId: number): number {
  const rows = db.select({ order: schema.lessons.order }).from(schema.lessons)
    .where(eq(schema.lessons.regionId, regionId)).all();
  return rows.reduce((m, r) => Math.max(m, r.order), 0) + 1;
}

/** Insert a lesson only if (regionId, kind, title) is absent; returns its id either way. */
function ensureLesson(regionId: number, kind: "dialogue" | "homework" | "grammar", title: string, bodyJson: unknown): number {
  const existing = db.select({ id: schema.lessons.id }).from(schema.lessons)
    .where(and(eq(schema.lessons.regionId, regionId), eq(schema.lessons.kind, kind), eq(schema.lessons.title, title)))
    .get();
  if (existing) return existing.id;
  return db.insert(schema.lessons)
    .values({ regionId, order: nextLessonOrder(regionId), kind, title, bodyJson: bodyJson as never })
    .returning().get().id;
}

/** Apply one stop's enrichment. Returns a short summary of what was added. */
export function upsertStopContent(c: StopContent): string {
  const region = db.select().from(schema.regions).where(eq(schema.regions.slug, c.slug)).get();
  if (!region) return `content: region '${c.slug}' not found — skipped`;
  let added = { vocab: 0, dialogues: 0, grammar: 0, exercises: 0, agendas: 0 };

  db.transaction(() => {
    for (const v of c.vocab ?? []) {
      const exists = db.select({ id: schema.vocab.id }).from(schema.vocab)
        .where(and(eq(schema.vocab.regionId, region.id), eq(schema.vocab.es, v.es))).get();
      if (!exists) { db.insert(schema.vocab).values({ regionId: region.id, ...v }).run(); added.vocab++; }
    }

    for (const d of c.dialogues ?? []) {
      const before = db.select({ id: schema.lessons.id }).from(schema.lessons)
        .where(and(eq(schema.lessons.regionId, region.id), eq(schema.lessons.kind, "dialogue"), eq(schema.lessons.title, d.title))).get();
      ensureLesson(region.id, "dialogue", d.title, { lines: d.lines });
      if (!before) added.dialogues++;
    }

    for (const g of c.grammar ?? []) {
      const before = db.select({ id: schema.lessons.id }).from(schema.lessons)
        .where(and(eq(schema.lessons.regionId, region.id), eq(schema.lessons.kind, "grammar"), eq(schema.lessons.title, g.title))).get();
      ensureLesson(region.id, "grammar", g.title, { intro: g.intro, points: g.points });
      if (!before) added.grammar++;
    }

    for (const hw of c.homeworks ?? []) {
      const lessonId = ensureLesson(region.id, "homework", hw.title, null);
      // Append any exercises whose (lessonId, prompt) is not already present.
      const existingPrompts = new Set(
        db.select({ prompt: schema.exercises.prompt }).from(schema.exercises)
          .where(eq(schema.exercises.lessonId, lessonId)).all().map((e) => e.prompt),
      );
      let order = db.select({ order: schema.exercises.order }).from(schema.exercises)
        .where(eq(schema.exercises.lessonId, lessonId)).all().reduce((m, r) => Math.max(m, r.order), 0);
      for (const e of hw.exercises) {
        if (existingPrompts.has(e.prompt)) continue;
        db.insert(schema.exercises).values({ lessonId, order: ++order, ...e }).run();
        added.exercises++;
      }
    }

    for (const a of c.agendas ?? []) {
      const exists = db.select({ id: schema.schoolSessions.id }).from(schema.schoolSessions)
        .where(and(eq(schema.schoolSessions.regionId, region.id), eq(schema.schoolSessions.order, a.order))).get();
      if (!exists) {
        db.insert(schema.schoolSessions).values({ regionId: region.id, order: a.order, agendaJson: a.steps }).run();
        added.agendas++;
      }
    }
  });

  return `content[${c.slug}]: +${added.vocab} vocab, +${added.dialogues} dialogues, +${added.grammar} grammar, +${added.exercises} exercises, +${added.agendas} agendas`;
}
