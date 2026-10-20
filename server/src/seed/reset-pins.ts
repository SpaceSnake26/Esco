import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { pathToFileURL } from "node:url";
import { db, schema } from "../db/client.js";
import { PROFILES } from "./profiles.js";

/** Set each existing user's PIN to the current value in PROFILES (preserves progress). */
export function resetPins() {
  for (const p of PROFILES) {
    const res = db.update(schema.users)
      .set({ pinHash: bcrypt.hashSync(p.pin, 10) })
      .where(eq(schema.users.name, p.name)).run();
    console.log(`pin set for ${p.name}: ${res.changes} row(s) updated`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  resetPins();
}
