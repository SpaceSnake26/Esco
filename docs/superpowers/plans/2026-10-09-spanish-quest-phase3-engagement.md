# Spanish Quest — Phase 3 (Engagement) Plan

> **For agentic workers:** executed via superpowers:subagent-driven-development, one work package at a time, each with spec + code-quality review. TDD throughout.

**Goal:** Add the engagement layer — streaks, badges, daily side quests, and **Pablito** the AI tutor (Kimi/Moonshot) — on top of the live Medellín MVP + El Reto.

**Builds on:** `build/phase-0-1` (Phases 0–2 live at esco.alpbot.ch). Server: Fastify + Drizzle/SQLite, NodeNext ESM (`.js` imports), hermetic vitest. Client: Vite/React PWA, extensionless imports. Scoring lives in `server/src/scoring/service.ts` (idempotent `award(user, sourceType, sourceId, points)` on a unique ledger; `gradeAttempt` awards exercise points on first attempt only).

**AI:** Kimi/Moonshot, OpenAI-compatible. `AI_BASE_URL=https://api.moonshot.ai/v1`, `AI_MODEL=kimi-k2.6`, `AI_API_KEY` from env. **kimi-k2.6 is a reasoning model**: send generous `max_tokens` (≥512), read `choices[0].message.content` (ignore `reasoning_content`), ~5–8s latency, graceful-degrade on any non-200.

## Locked design decisions
- **Streak scope:** the streak multiplier applies to **solo earning only — homework (exercise) and side quests** — NOT school/live (those stay flat so the live scoreboard matches the season board). Rationale: streak rewards the daily personal grind.
- **Streak tiers:** `mult(current) = 1.0 (<3 days) · 1.05 (3–6) · 1.10 (7–13) · 1.20 (14+)`. A "day" is any day the user earned points; streak increments on consecutive calendar days (server local date), resets if a day is skipped.
- **Side quests:** one auto-generated **"Reto diario"** per calendar day from the current region's vocab (a 5-question vocab blast), + a **"Palabra del día"**. AI roleplay quest arrives with Pablito (WP4). Quests award `sourceType:"sidequest"` (streak-multiplied), once per day.
- **Badges:** a small fixed set, evaluated after any award. Earned once (unique per user+code).
- **ledger sourceType** already includes `exercise|school|sidequest|live` — no schema change needed for quests.

---

## WP1 — Streaks + multiplier
**Schema:** `streaks(userId pk → users.id, current int, longest int, lastActiveDate text 'YYYY-MM-DD')`.
**Service (`scoring/service.ts`):**
- `streakMultiplier(current): number` (pure, tiers above).
- `touchStreak(userId, today): number` — upsert: if `lastActiveDate===today` no-op; if `===yesterday` current++; else current=1; longest=max; returns new current.
- `awardWithStreak(userId, sourceType, sourceId, basePoints): { awarded, multiplier }` — touches streak, multiplies base by `streakMultiplier`, awards rounded points.
- Wire `gradeAttempt` to use `awardWithStreak(..., "exercise", ...)` instead of raw `award` for the first-correct award.
- `getStreak(userId): { current, longest }`.
**API:** fold `streak` into the dashboard data (extend `/api/me` or add `GET /api/streak`). Home header shows 🔥`current`.
**Tests:** multiplier tiers; touchStreak consecutive/skip/same-day; a correct first attempt on a 7-day streak awards `round(base*1.10)`; leaderboard reflects multiplied points.

## WP2 — Badges
**Schema:** `badges(code pk, name, emoji, description)` seeded; `userBadges(userId, code, earnedAt, unique(userId,code))`.
**Rules engine (`server/src/badges/service.ts`):** `evaluateBadges(userId)` checks each rule against DB state and inserts newly-earned rows (idempotent); returns newly earned. Call it at the end of `gradeAttempt`, quest-complete, school-complete, and live-reveal award paths. Seeded badges: `primera_clase` (first school session), `racha_7` (streak ≥7), `cien_palabras` (≥100 correct exercises... scope to vocab later — use correct-exercise count), `medellin_cleared` (region 1 complete), `reto_ganador` (won an El Reto — most points in an ended game). Keep rules simple/DB-derivable.
**API:** `GET /api/badges` → all badges + earned flags for the user. **Client:** `/logros` screen (badge shelf) + a nav entry; a toast when a new badge is earned (optional, from the attempt response `newBadges`).
**Tests:** earning a badge is idempotent; streak_7 badge appears after a 7-day streak; region_cleared after all Medellín exercises correct.

## WP3 — Daily side quests
**Schema:** `sideQuests(id, date 'YYYY-MM-DD', regionId, type 'vocab_blast'|'word_of_day'|'roleplay', payloadJson, points)` + reuse `pointsLedger` (sourceType `sidequest`, sourceId = quest id) and a per-user completion via the ledger's uniqueness (user+sidequest+questId).
**Generator (`server/src/quests/service.ts`):** `ensureTodayQuests(regionId, today)` — idempotent; builds today's vocab_blast (5 MC from the region's vocab, correct answer + distractors) and word_of_day; returns them. `GET /api/quests/today` calls it for the user's current region. `POST /api/quests/:id/answer` (vocab_blast item grading, like attempts) and `POST /api/quests/:id/complete` (word_of_day acknowledge) → `awardWithStreak(..., "sidequest", questId, points)`.
**Client:** Home "🎯 Misión de hoy" card → `/misiones` quest player (reuses the exercise-player pattern). **Tests:** generator idempotent per day; completing a quest awards streak-multiplied points once; a new day generates new quests.

## WP4 — Pablito (AI tutor, Kimi)
**Server (`server/src/ai/pablito.ts`):** a thin Kimi client — `chat(messages, {regionVocab}): Promise<{reply} | {error}>`. System prompt: "Eres Pablito, un lorito colombiano, tutor de español para principiantes…"; inject the current region's vocab so replies stay near level; `max_tokens: 600`, read `content`. On any non-200/timeout return `{error}`.
**API:** `POST /api/pablito/chat {messages}` (auth; server prepends the system+vocab prompt, never trusts a client system prompt) → `{reply}` or `{error:"asleep"}`. **Roleplay quest:** a `roleplay` side-quest type (scenario e.g. "pide un tinto"); after the player exchanges ≥3 messages that stay on-topic, award completion (simple: ≥3 user turns → `POST /api/quests/:id/complete`). **Client:** `🦜 Charlar` screen (`/charlar`) — chat UI with Pablito; shows "Pablito está dormido 😴" on error. Add the roleplay quest to the Misión card.
**Tests:** `pablito.ts` returns `{error}` cleanly when the AI endpoint errors (mock fetch non-200); the chat route strips any client-supplied system role; a roleplay quest completes after 3 user turns. (Live Kimi calls are not hit in unit tests — mock fetch.)

---

## Build order & review
WP1 → WP2 → WP3 → WP4, each: implementer subagent (TDD) → spec review → code-quality review → fix → commit. Deploy after WP4 (or incrementally). Pablito ships behind graceful degradation so a dead/empty AI never breaks the app.
