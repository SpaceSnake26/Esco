import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { fileURLToPath } from "node:url";
import { db } from "./client.js";

migrate(db, { migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)) });
console.log("migrations applied");
