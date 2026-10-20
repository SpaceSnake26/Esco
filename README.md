# Esco — Spanish Quest 🦜🇨🇴

A small, competitive, gamified **Spanish-learning PWA** for a group of friends preparing for a Colombia trip. Installable on Android & iOS, built around a 6-stop journey (Medellín → Cartagena → Barranquilla → Santa Marta → Sierra Nevada → Medellín), with weekly in-person "school" sessions, homework, daily side-quests, a live buzzer quiz, and an AI tutor.

## Features

- **Route map** — 6 themed stops, each a ~2-week unit (40 vocab · 3 dialogues · 3 grammar notes · ~40 exercises · 2 class agendas). Unlock the next stop at 80% mastery.
- **El Reto** — a live, Kahoot-style buzzer quiz. Everyone opens one screen, anyone starts, fastest correct answer scores most.
- **Listen & repeat** — text-to-speech pronunciation drills (Web Speech API) with a male/female voice toggle.
- **Pablito** — an AI conversation tutor (OpenAI-compatible provider, e.g. Kimi/Moonshot), with a daily cost cap and graceful offline practice mode.
- **Scoring** — points, daily streaks with multipliers, badges, a season leaderboard, and roleplay side-quests.

## Stack

- **Client:** Vite + React + TypeScript, installable PWA (`vite-plugin-pwa`).
- **Server:** Fastify (ESM) + WebSocket, SQLite + Drizzle ORM, Zod validation, JWT cookie auth.
- **Shared:** a `shared/` types package used by both.

## Develop

```bash
npm install
npm --prefix server install && npm --prefix client install
cp .env.example .env          # fill in JWT_SECRET and (optionally) an AI key
npm run migrate && npm run seed
npm run dev                   # server + client
```

Tests: `npm --prefix server test` and `npm --prefix client test`.

## Configuration

Copy `.env.example` → `.env`. Notable keys: `JWT_SECRET`, `AI_BASE_URL` / `AI_API_KEY` / `AI_MODEL` (plus optional `AI_FALLBACK_*` and `AI_DAILY_CAP`), and `PIN_FABIO` / `PIN_ALEKS` / `PIN_IGOR` for the player login PINs. **Real PINs and API keys live only in `.env` (git-ignored) — never in source.**

## Deploy

`scripts/deploy.sh` rsyncs to a VPS, installs, builds, migrates, seeds, and restarts a `systemd` service behind a shared Caddy reverse proxy.
