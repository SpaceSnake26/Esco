# Spanish Quest — Design Spec

**Date:** 2026-10-07
**Status:** Approved (brainstorm complete; pending written-spec review)
**Author:** brainstorm session (user + Claude)

## 1. Overview

An installable, gamified web app (PWA) that helps three friends learn **survival travel Spanish with a conversation focus** before a trip to **Colombia on 31 January 2027**. Served at `esco.alpbot.ch`.

The app combines a **weekly rhythm** (a 1-hour group "school" session + ~1 hour of solo homework) with **optional daily side quests**, wrapped in a **season-long competitive leaderboard** that crowns a grand champion at the trip. Visual theme: **playful mascot warmth × a Colombia adventure-map journey**.

### Learners
- Three friends, roughly **near-beginner** level (between absolute beginner and advanced beginner).
- **Goal:** survival travel Spanish (food, directions, hotel, shopping, emergencies, small talk) + the ability to **hold simple conversations**.
- **Deadline:** usable value well before 31 Jan 2027; full journey spans ~16 weeks (Oct 2026 → Jan 2027).

### Success criteria
- All three can install the app on Android & iOS from `spanish.alpbot.ch` and sign in with a PIN.
- Each week delivers a runnable group school session + solo homework, with points recorded to a working season leaderboard.
- By the trip, players can handle core travel scenarios and a simple back-and-forth conversation.
- The experience is motivating enough that at least the competitive player(s) engage with daily side quests.

## 2. Content strategy — Hybrid

- **Hand-authored backbone:** a fixed, structured curriculum (regions → lessons → exercises + core vocab) ensures a coherent, offline-capable learning path of controlled quality.
- **AI-powered variable parts** (via the existing Hermes OpenAI-compatible endpoint on the VPS, `:8642`):
  - Conversation partner ("Pablito") for the simple-conversation goal.
  - Roleplay side-quest scenarios.
  - On-demand extra practice sentences/quizzes so homework stays fresh.
- **Graceful degradation:** if the AI endpoint is unavailable, the hand-authored core curriculum, homework, and scoring all still work fully.

## 3. Core loops

### ① School Session (weekly, in-person, together) — the Facilitator
The app runs a **timed agenda** on a shared screen to guide the group's ~1h. Example per-unit plan:
- `0–10` Warm-up: review previous vocab aloud (fast flashcards).
- `10–25` New material: read a Colombian-themed dialogue together, tap words for meaning.
- `25–45` Group game: app-run vocab/listening challenge.
- `45–60` Speak: app provides conversation prompts to practice with each other.

Completing a session grants all present players **participation points** and unlocks that week's homework. No real-time multiplayer sync required (single shared screen).

### ② Weekly Homework (solo, ~1h) — point engine
Assigned per-week exercise set (vocab drills, listening, fill-in-the-blank, short reading, a mini AI chat). Completing the **core set** = base points, scaled by completion + accuracy. Expected of all players.

### ③ Daily Side Quests (solo, optional) — competitive grind
Short optional challenges awarding **bonus points** and building a **streak** 🔥 (word of the day, 5-min vocab blast, quick AI roleplay). Drives the "do more, score more" competitive lever.

## 4. Gamification & scoring

**Point sources (all roll into one season total):**
- School session: ~100 pts (attend + complete activities).
- Weekly homework: up to ~200 pts, scaled by completion + accuracy.
- Side quests: 20–50 pts each, optional/daily.

**Multipliers & progression:**
- **Streak bonus:** growing multiplier for consecutive active days (e.g. +5% @3d, +10% @7d, capped).
- **Levels/XP:** points double as XP; levels map to mascot titles (*Principiante → Viajero → Parcero → El Jefe*).
- **Badges:** achievements (First Perfect Week, 7-Day Streak, 100 Words, Region Cleared, beat a friend this week, etc.).
- **Map gating:** unlocking the next region requires completing the **current region's homework** (not winning) — slower players still progress; competition is about points, not blocking.

**Leaderboard:** season-long cumulative; weekly deltas visible for flavor; **grand champion crowned 31 Jan**.

**Rewards:**
- In-game: badges, titles, mascot cosmetics, level-ups.
- Real-world: a free-text **"Colombia Stake"** the group sets in the app; champion settles it on the trip.

## 5. AI conversation partner — "Pablito"

A friendly Medellín parrot tutor, backed by the Hermes endpoint. Note: "Pablito" is an in-joke mascot name for the friend group; the character is strictly a friendly language tutor. Functions:
- **Roleplay side quests** — scenario chats graded for completion → bonus points.
- **Free conversation practice** — scoped to the player's current region vocab to stay near level.
- **Dynamic practice generation** — extra sentences/quizzes on demand.

All AI calls are server-side (keys never reach the client).

## 5b. Live Arena — "El Reto" (live buzzer quiz)

A real-time, Kahoot-style competitive round run at the **end of the in-person school session** to make it more interactive.

- **Host screen (TV):** the laptop casts to the TV and shows the current question, four colour/shape answers, a countdown, and who has answered. The host device advances questions (*Next*).
- **Player screen (phone):** each player, already logged into their profile, sees only the four big answer buttons — their buzzer.
- **Speed-weighted scoring:** a correct answer earns a base (~100) plus a speed bonus (up to ~100) that decays with response time; wrong = 0. The **server is authoritative** — it timestamps when a question goes live and when each phone answers, so timing can't be gamed.
- **Reveal & podium:** between questions the host screen reveals the answer and a live scoreboard; a podium ends the game.
- **Question source:** auto-generated from the current stop's `multiple_choice` exercises (no extra authoring).
- **Season integration:** Reto points post to the same `points_ledger` with source type `live`.
- **Scope:** a single live game/room at a time (just the three players). This is the *only* real-time feature; everything else stays request/response.

## 6. Curriculum — journey across Colombia (follows the real trip itinerary, ~16 weeks)

| # | Stop (Unit) | Theme & situations | Weeks | Grammar drip | Conversation goal |
|---|---|---|---|---|---|
| ① | **Medellín** *(start · MVP)* | Saludos & lo básico: greetings, introductions, numbers, politeness, paisa warmth, ordering a *tinto* & first arepas, airport/arrival | 1–3 | present tense, ser vs estar | introduce yourself & greet people |
| ② | **Cartagena** | La comida & el mercado: restaurants, street food, fruit vendors in the walled city, drinks, quantities, first bargaining | 4–6 | querer/quisiera, gustar | order a meal & buy at a market |
| ③ | **Barranquilla** | ¡Fiesta y gente! social & small talk: making friends, Carnaval culture, music, feelings, likes/dislikes | 7–8 | questions, me/te gusta | small talk & make a friend |
| ④ | **Santa Marta** | Moverse & la playa: directions, taxis/buses, booking a tour, beach & hostel, "¿cómo llego a…?" | 9–11 | ir + a, near future, this/that | ask directions & book a tour |
| ⑤ | **Sierra Nevada** | Naturaleza & aventura: hiking to Ciudad Perdida, weather, nature, asking for help, basic health & emergencies | 12–14 | simple past, basic commands | ask for help & handle a problem |
| ⑥ | **Medellín** *(return · finale)* | De vuelta: souvenir shopping & prices, goodbyes, airport, trip recap — plus the **"¡Listos para Colombia!" boss-challenge** across all stops | 15–16 | review all | hold a simple full conversation |

Order mirrors the itinerary (Medellín → Cartagena → Barranquilla → Santa Marta → Sierra Nevada → Medellín), so each unit preps the players for the city they'll actually be in next. Content is Colombian-flavored (real places & local terms: *tinto*, *parcero*, *arepa*, *Carnaval*, *Ciudad Perdida*). Grand champion crowned at Week 16 (trip, 31 Jan 2027); real-world Colombia stakes settled then. Curriculum themes are adjustable.

## 7. Architecture

- **Frontend:** Vite + React + TypeScript, built as an installable **PWA** (service worker caches core curriculum for offline use; Add-to-Home-Screen on Android & iOS).
- **Backend:** Fastify (Node/TS) REST API — serves content, records progress, computes scores/leaderboard, proxies AI calls — plus a **WebSocket channel** (`@fastify/websocket`) used only by the El Reto live quiz (§5b).
- **Database:** SQLite via Drizzle ORM (single file; backup via `cp`).
- **AI:** proxied through the VPS Hermes OpenAI-compatible endpoint (`127.0.0.1:8642`).
- **Auth:** 3 pre-created profiles — **Fabio, Aleks, Igor** — each with a PIN. No signup flow.
- **Deploy:** single Node process on the VPS (178.104.249.249) + an `esco.alpbot.ch` Caddy block (auto-HTTPS), mirroring the existing `kanban.alpbot.ch` PWA pattern. Caddy serves PWA public files (`manifest.webmanifest`, icons, `.well-known`) and reverse-proxies the app.

### Data model (SQLite sketch)
- `users` (id, name, pin_hash, avatar, created_at)
- `regions` (id, order, name, theme, unlock_rule)
- `lessons` (id, region_id, order, type, title, content_json)
- `exercises` (id, lesson_id, type, payload_json, points)
- `vocab` (id, region_id, es, en, example, audio_ref?)
- `progress` (id, user_id, exercise_id, status, score, accuracy, completed_at)
- `points_ledger` (id, user_id, source, points, meta_json, created_at) — append-only; leaderboard = SUM per user
- `streaks` (user_id, current, longest, last_active_date)
- `badges` (id, code, name, description) + `user_badges` (user_id, badge_id, earned_at)
- `school_sessions` (id, region_id, scheduled_at, agenda_json) + `session_attendance` (session_id, user_id, points_awarded)
- `settings` (singleton: season_start, season_end, stake_text)
- `ai_chats` (id, user_id, scenario, transcript_json, graded, points) — optional
- `points_ledger.source` includes `live` for El Reto awards; live-game runtime state (current question, answers, timings) is held in server memory for the single active room, not persisted.

## 8. Build roadmap

- **Phase 0 — Foundation:** repo scaffold, PWA shell, deploy to `spanish.alpbot.ch` (installable), 3 PIN profiles, DB + migrations. *Exit: the app installs on the friends' phones.*
- **Phase 1 — Playable MVP (Medellín, Stop ①):** Stop ① content (greetings & basics) + homework exercises + points + season leaderboard + basic school-session facilitator. *Exit: a real lesson can be completed and scores appear.*
- **Phase 2 — El Reto (live buzzer quiz):** WebSocket game room, host (TV) + player (phone) views, speed-weighted scoring into the season leaderboard (§5b).
- **Phase 3 — Engagement:** daily side quests, streaks, badges, Pablito (AI partner + roleplay + free chat).
- **Phase 4 — Full journey:** remaining stops (②–⑥: Cartagena, Barranquilla, Santa Marta, Sierra Nevada, Medellín finale), map progression polish, rewards/stakes UI, visual polish.
- **Ongoing:** ship content region-by-region, staying ahead of the ~3-weeks-per-region pace.

## 9. Non-goals (YAGNI)
- No real-time multiplayer sync **except** the El Reto live quiz (§5b); all other screens are request/response only, and homework/school remain single-screen.
- No public signup / general-audience accounts (3 fixed profiles only).
- No native app stores (PWA install only).
- No payment/monetization.
- No complex spaced-repetition engine in v1 (simple review rounds suffice; can revisit).

## 10. Open items to confirm at build time
- Players: **Fabio, Aleks, Igor** (seeded; PINs default to 1111/2222/3333, changeable later).
- Exact school-session weekday/time (used for the "next class" banner; default Thursday 19:00).
- Final palette/mascot art polish.
