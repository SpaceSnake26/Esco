// Hermetic test DB: fresh temp SQLite file per test file, migrated + seeded.
// Must set DB_PATH BEFORE importing anything that reads env / opens the DB,
// so the db client and env are loaded via dynamic import() after this point.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), "spanish-test-")), "test.db");
process.env.JWT_SECRET ??= "test-secret-123456";

const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
const { db } = await import("../db/client.js");
const { seedProfiles } = await import("../seed/profiles.js");
const { seedMedellin } = await import("../seed/medellin.js");
const { seedPhase4 } = await import("../seed/phase4.js");
const { seedCurriculum } = await import("../seed/content/index.js");
const { seedBadges } = await import("../seed/badges.js");

migrate(db, { migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)) });
seedProfiles();
seedMedellin();
seedPhase4();
seedCurriculum();
seedBadges();
