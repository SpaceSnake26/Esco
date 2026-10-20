import { pathToFileURL } from "node:url";
import { db, schema } from "../db/client.js";

/** The fixed set of earnable badges. Order here is the shelf display order. */
export const BADGES = [
  { code: "primera_tarea", emoji: "📘", name: "Primera tarea", description: "first correct homework exercise" },
  { code: "racha_3", emoji: "🔥", name: "Racha de 3", description: "streak reached 3 days" },
  { code: "racha_7", emoji: "🔥", name: "Racha de 7", description: "streak reached 7 days" },
  { code: "medellin_completo", emoji: "🧭", name: "Medellín completado", description: "all Medellín exercises correct" },
  { code: "primera_clase", emoji: "🏫", name: "Primera clase", description: "attended a school session" },
  { code: "retador", emoji: "⚡", name: "Retador", description: "earned points in El Reto" },
] as const;

/** Idempotent seed of the badge catalog (skips rows already present). */
export function seedBadges() {
  for (const b of BADGES) {
    db.insert(schema.badges)
      .values({ code: b.code, name: b.name, emoji: b.emoji, description: b.description })
      .onConflictDoNothing()
      .run();
  }
  console.log(`seeded ${BADGES.length} badges`);
}

// Run only when invoked directly (e.g. `tsx src/seed/badges.ts`), not on import.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seedBadges();
}
