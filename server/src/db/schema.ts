import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  pinHash: text("pin_hash").notNull(),
  avatar: text("avatar").notNull().default("🧑"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey(), // always row 1
  seasonStart: text("season_start").notNull(),
  seasonEnd: text("season_end").notNull(),
  stakeText: text("stake_text").notNull().default(""),
});

export const regions = sqliteTable("regions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  order: integer("order").notNull(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  theme: text("theme").notNull(),
}, (t) => ({ uniqSlug: uniqueIndex("regions_slug").on(t.slug) }));

export const lessons = sqliteTable("lessons", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  regionId: integer("region_id").notNull().references(() => regions.id),
  order: integer("order").notNull(),
  kind: text("kind", { enum: ["dialogue", "homework", "grammar"] }).notNull(),
  title: text("title").notNull(),
  bodyJson: text("body_json", { mode: "json" }).$type<unknown>(), // dialogue text, etc.
});

export const exercises = sqliteTable("exercises", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  lessonId: integer("lesson_id").notNull().references(() => lessons.id),
  order: integer("order").notNull(),
  type: text("type", { enum: ["multiple_choice", "fill_blank"] }).notNull(),
  prompt: text("prompt").notNull(),
  answer: text("answer").notNull(),           // canonical correct answer (server-checked)
  optionsJson: text("options_json", { mode: "json" }).$type<string[] | null>(),
  points: integer("points").notNull().default(10),
});

export const vocab = sqliteTable("vocab", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  regionId: integer("region_id").notNull().references(() => regions.id),
  es: text("es").notNull(),
  en: text("en").notNull(),
  example: text("example"),
});

export const progress = sqliteTable("progress", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  exerciseId: integer("exercise_id").notNull().references(() => exercises.id),
  correct: integer("correct", { mode: "boolean" }).notNull(),
  completedAt: integer("completed_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => ({ uniq: uniqueIndex("progress_user_ex").on(t.userId, t.exerciseId) }));

export const pointsLedger = sqliteTable("points_ledger", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  sourceType: text("source_type", { enum: ["exercise", "school", "sidequest", "live"] }).notNull(),
  sourceId: integer("source_id").notNull(),
  points: integer("points").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => ({ uniq: uniqueIndex("ledger_unique").on(t.userId, t.sourceType, t.sourceId) }));

export const streaks = sqliteTable("streaks", {
  userId: integer("user_id").primaryKey().references(() => users.id),
  current: integer("current").notNull().default(0),
  longest: integer("longest").notNull().default(0),
  lastActiveDate: text("last_active_date"), // 'YYYY-MM-DD' (UTC), nullable until first touch
});

export const badges = sqliteTable("badges", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  emoji: text("emoji").notNull(),
  description: text("description").notNull(),
});

export const userBadges = sqliteTable("user_badges", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  code: text("code").notNull().references(() => badges.code),
  earnedAt: integer("earned_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => ({ uniq: uniqueIndex("user_badges_unique").on(t.userId, t.code) }));

export const sideQuests = sqliteTable("side_quests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(), // 'YYYY-MM-DD' (UTC)
  regionId: integer("region_id").notNull().references(() => regions.id),
  type: text("type", { enum: ["vocab_blast", "word_of_day", "roleplay"] }).notNull(),
  payloadJson: text("payload_json", { mode: "json" }).$type<unknown>().notNull(),
  points: integer("points").notNull(),
}, (t) => ({ uniq: uniqueIndex("side_quests_unique").on(t.date, t.regionId, t.type) }));

export const schoolSessions = sqliteTable("school_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  regionId: integer("region_id").notNull().references(() => regions.id),
  order: integer("order").notNull().default(1), // week within the stop (1, 2, …)
  agendaJson: text("agenda_json", { mode: "json" }).$type<AgendaStep[]>().notNull(),
}, (t) => ({ uniqRegionOrder: uniqueIndex("school_sessions_region_order").on(t.regionId, t.order) }));

export const sessionAttendance = sqliteTable("session_attendance", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id").notNull().references(() => schoolSessions.id),
  userId: integer("user_id").notNull().references(() => users.id),
}, (t) => ({ uniq: uniqueIndex("attend_unique").on(t.sessionId, t.userId) }));

// Bounds Pablito's paid AI calls per UTC calendar day (cost control). One row per day.
export const aiUsage = sqliteTable("ai_usage", {
  day: text("day").primaryKey(), // 'YYYY-MM-DD' (UTC)
  count: integer("count").notNull().default(0),
});

export interface AgendaStep { minutes: number; title: string; instructions: string; }
