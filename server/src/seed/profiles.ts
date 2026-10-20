import bcrypt from "bcryptjs";
import { pathToFileURL } from "node:url";
import { db, schema } from "../db/client.js";

// Real PINs come from env (set them in the server's .env); the placeholders here
// are only defaults for a fresh/public checkout — never the real login PINs.
export const PROFILES = [
  { name: "Fabio", avatar: "🐆", pin: process.env.PIN_FABIO ?? "111111" },
  { name: "Aleks", avatar: "🦅", pin: process.env.PIN_ALEKS ?? "222222" },
  { name: "Igor", avatar: "🐊", pin: process.env.PIN_IGOR ?? "333333" },
];

/** Idempotent seed of the 3 player profiles + the singleton settings row. */
export function seedProfiles() {
  const existing = db.select().from(schema.users).all();
  if (existing.length === 0) {
    db.transaction((tx) => {
      for (const p of PROFILES) {
        tx.insert(schema.users)
          .values({ name: p.name, avatar: p.avatar, pinHash: bcrypt.hashSync(p.pin, 10) })
          .run();
      }
    });
    console.log("seeded 3 profiles (Fabio / Aleks / Igor)");
  } else {
    console.log("profiles already exist, skipping");
  }

  const s = db.select().from(schema.settings).all();
  if (s.length === 0) {
    db.insert(schema.settings)
      .values({ id: 1, seasonStart: "2026-10-07", seasonEnd: "2027-01-31", stakeText: "" })
      .run();
    console.log("seeded settings (season 2026-10-07 → 2027-01-31)");
  }
}

// Run only when invoked directly (e.g. `tsx src/seed/profiles.ts`), not on import.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seedProfiles();
}
