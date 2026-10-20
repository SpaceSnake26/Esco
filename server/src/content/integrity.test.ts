import { eq, inArray } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import { db, schema } from "../db/client.js";

// Invariants every stop's content must hold — these guard quality as the
// curriculum grows (bad options, missing answers, duplicate vocab, too few
// live-quiz questions would otherwise slip through).

function regions() {
  return db.select().from(schema.regions).orderBy(schema.regions.order).all()
    .filter((r) => r.slug !== "empty-test-region"); // test-only fixture, intentionally empty
}
function lessonsOf(regionId: number) {
  return db.select().from(schema.lessons).where(eq(schema.lessons.regionId, regionId)).all();
}
function exercisesOf(lessonIds: number[]) {
  if (lessonIds.length === 0) return [];
  return db.select().from(schema.exercises).where(inArray(schema.exercises.lessonId, lessonIds)).all();
}

describe("content integrity", () => {
  test("every stop has a homework lesson with exercises", () => {
    for (const r of regions()) {
      const ls = lessonsOf(r.id);
      const hw = ls.filter((l) => l.kind === "homework");
      expect(hw.length, `${r.slug} homework`).toBeGreaterThan(0);
      const exIds = db.select({ id: schema.exercises.id }).from(schema.exercises)
        .where(inArray(schema.exercises.lessonId, hw.map((l) => l.id))).all();
      expect(exIds.length, `${r.slug} exercises`).toBeGreaterThan(0);
    }
  });

  test("every multiple_choice exercise is well-formed (3–4 distinct options incl. the answer)", () => {
    for (const r of regions()) {
      const exs = exercisesOf(lessonsOf(r.id).map((l) => l.id));
      for (const e of exs.filter((x) => x.type === "multiple_choice")) {
        const opts = (e.optionsJson ?? []) as string[];
        const where = `${r.slug} ex#${e.id} "${e.prompt}"`;
        expect(opts.length, `${where} option count`).toBeGreaterThanOrEqual(3);
        expect(opts.length, `${where} option count`).toBeLessThanOrEqual(4);
        expect(new Set(opts).size, `${where} distinct options`).toBe(opts.length);
        expect(opts, `${where} includes answer`).toContain(e.answer);
      }
    }
  });

  test("every fill_blank has a non-empty answer and no options", () => {
    for (const r of regions()) {
      const exs = exercisesOf(lessonsOf(r.id).map((l) => l.id));
      for (const e of exs.filter((x) => x.type === "fill_blank")) {
        expect(e.answer.trim().length, `${r.slug} ex#${e.id} answer`).toBeGreaterThan(0);
        expect(e.optionsJson, `${r.slug} ex#${e.id} options`).toBeNull();
      }
    }
  });

  test("every stop has at least 3 multiple_choice questions for El Reto", () => {
    for (const r of regions()) {
      const exs = exercisesOf(lessonsOf(r.id).map((l) => l.id));
      const mc = exs.filter((x) => x.type === "multiple_choice" && ((x.optionsJson ?? []) as string[]).includes(x.answer));
      expect(mc.length, `${r.slug} live-quiz questions`).toBeGreaterThanOrEqual(3);
    }
  });

  test("vocab within a stop has no duplicates and non-empty es/en", () => {
    for (const r of regions()) {
      const vs = db.select().from(schema.vocab).where(eq(schema.vocab.regionId, r.id)).all();
      const es = vs.map((v) => v.es);
      expect(new Set(es).size, `${r.slug} duplicate vocab`).toBe(es.length);
      for (const v of vs) {
        expect(v.es.trim().length, `${r.slug} vocab es`).toBeGreaterThan(0);
        expect(v.en.trim().length, `${r.slug} vocab en`).toBeGreaterThan(0);
      }
    }
  });
});
