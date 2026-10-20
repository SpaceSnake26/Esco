import { eq } from "drizzle-orm";
import { db, schema } from "../db/client.js";

// A deterministic El Reto fixture: a region with exactly 3 multiple_choice
// questions whose correct option is ALWAYS index 1. This decouples the live-quiz
// tests from the real curriculum (whose answers sit at varied indices), so the
// tests stay valid as content grows. Idempotent per test DB.
export function seedArenaFixtureRegion(): number {
  const existing = db.select().from(schema.regions).where(eq(schema.regions.slug, "arena-fixture")).get();
  if (existing) return existing.id;

  const region = db.insert(schema.regions)
    .values({ order: 100, slug: "arena-fixture", name: "Arena Fixture", theme: "test" })
    .returning().get();
  const hw = db.insert(schema.lessons)
    .values({ regionId: region.id, order: 1, kind: "homework", title: "Fixture", bodyJson: null })
    .returning().get();

  const qs = [
    { prompt: "Fixture Q1", answer: "B1", optionsJson: ["A1", "B1", "C1", "D1"] },
    { prompt: "Fixture Q2", answer: "B2", optionsJson: ["A2", "B2", "C2", "D2"] },
    { prompt: "Fixture Q3", answer: "B3", optionsJson: ["A3", "B3", "C3", "D3"] },
  ];
  qs.forEach((q, i) => db.insert(schema.exercises)
    .values({ lessonId: hw.id, order: i + 1, type: "multiple_choice", points: 10, ...q }).run());

  return region.id;
}
