# Spanish Quest — Phase 0 + Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an installable, gamified Spanish-learning PWA at `spanish.alpbot.ch` where 3 friends log in with a PIN, complete the Medellín (Stop ①) homework, earn points, and see a season leaderboard — plus a timed in-person "school session" facilitator.

**Architecture:** A single Node process (Fastify, TypeScript) serves a JSON API under `/api` and the built React PWA as static files. Data lives in a single SQLite file via Drizzle ORM. All grading and scoring happen server-side (never trust the client). In dev, Vite runs the client on :5173 and proxies `/api` to Fastify on :8787; in prod, Caddy reverse-proxies `spanish.alpbot.ch` → :8787. Deploy is rsync-over-SSH to `/opt/spanish` on the VPS + a systemd service.

**Tech Stack:** Node 22, TypeScript, Fastify, better-sqlite3 + Drizzle ORM, zod, @fastify/jwt + @fastify/cookie, bcryptjs, Vite + React + react-router-dom + @tanstack/react-query, vite-plugin-pwa, Vitest (+ @testing-library/react, jsdom). Package manager: npm.

**Spec:** `docs/superpowers/specs/2026-10-07-spanish-learning-game-design.md`

---

## File Structure

```
/ (repo root)
├── package.json                 # root scripts (dev, build, deploy) + concurrently
├── .env.example                 # documents env vars
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   ├── drizzle.config.ts
│   ├── vitest.config.ts
│   ├── data/                    # spanish.db lives here (gitignored)
│   ├── drizzle/                 # generated migrations
│   └── src/
│       ├── index.ts             # process entry: build app + listen
│       ├── app.ts               # buildApp(): Fastify instance (used by tests via inject)
│       ├── env.ts               # validated env config
│       ├── db/
│       │   ├── client.ts        # drizzle + better-sqlite3 connection
│       │   ├── schema.ts        # all tables
│       │   └── migrate.ts       # run migrations programmatically
│       ├── auth/
│       │   ├── routes.ts        # POST /api/auth/login, /logout, GET /api/me
│       │   └── plugin.ts        # jwt + cookie + requireAuth decorator
│       ├── content/
│       │   └── routes.ts        # GET /api/regions, /api/regions/:id
│       ├── scoring/
│       │   ├── service.ts       # award(), leaderboard(), regionStatus()
│       │   └── routes.ts        # POST /api/attempts, GET /api/leaderboard
│       ├── school/
│       │   └── routes.ts        # GET /api/school/current, POST /api/school/:id/complete
│       └── seed/
│           ├── profiles.ts      # 3 users + settings
│           └── medellin.ts      # Stop ① content
├── shared/
│   └── types.ts                 # API DTOs shared by client + server (path alias @shared)
├── client/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts           # react + PWA plugin + /api proxy + @shared alias
│   ├── vitest.config.ts
│   ├── index.html
│   ├── public/
│   │   └── logo.svg             # source icon for PWA asset generation
│   └── src/
│       ├── main.tsx             # router + react-query provider
│       ├── api.ts               # typed fetch helpers
│       ├── auth.tsx             # useAuth() context
│       ├── components/          # Mascot, BottomNav, PointsBadge, etc.
│       └── screens/
│           ├── Login.tsx
│           ├── Home.tsx
│           ├── Ruta.tsx         # Colombia map / region list
│           ├── Homework.tsx     # lesson + exercise player
│           ├── Leaderboard.tsx
│           └── School.tsx       # timed agenda facilitator
└── scripts/
    ├── deploy.sh                # rsync + remote build + restart
    └── spanish-api.service      # systemd unit (installed on VPS)
```

**Responsibility boundaries:** each `routes.ts` owns one HTTP surface; `scoring/service.ts` owns all point math (the one place scoring logic lives — DRY); `db/schema.ts` is the single source of truth for tables; `shared/types.ts` is the single source of truth for API DTOs.

---

# PHASE 0 — Foundation

Exit criteria: the app installs on the friends' phones from `spanish.alpbot.ch`, all 3 can log in with a PIN, and a health check passes in production.

### Task 0.1: Repo & root tooling

**Files:**
- Create: `package.json`, `.env.example`
- Verify: `.gitignore` (already contains `node_modules/ dist/ .superpowers/ *.db .env`)

- [ ] **Step 1: Create root `package.json`**

```json
{
  "name": "spanish-quest",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "concurrently -n api,web -c cyan,magenta \"npm --prefix server run dev\" \"npm --prefix client run dev\"",
    "build": "npm --prefix client run build && npm --prefix server run build",
    "start": "npm --prefix server run start",
    "migrate": "npm --prefix server run migrate",
    "seed": "npm --prefix server run seed",
    "test": "npm --prefix server test && npm --prefix client test",
    "deploy": "bash scripts/deploy.sh"
  },
  "devDependencies": {
    "concurrently": "^9.0.0"
  }
}
```

- [ ] **Step 2: Create `.env.example`**

```bash
# Server
NODE_ENV=development
PORT=8787
JWT_SECRET=change-me-to-a-long-random-string
DB_PATH=./data/spanish.db
# Phase 2 (AI partner "Pablito") — Hermes OpenAI-compatible endpoint
AI_BASE_URL=http://127.0.0.1:8642/v1
AI_API_KEY=hermes-local-2026
AI_MODEL=deepseek-v4-flash
```

- [ ] **Step 3: Install root dev dep & commit**

```bash
npm install
git add package.json package-lock.json .env.example
git commit -m "chore: root workspace scripts and env template"
```

### Task 0.2: Server skeleton + health endpoint (TDD)

**Files:**
- Create: `server/package.json`, `server/tsconfig.json`, `server/vitest.config.ts`, `server/src/env.ts`, `server/src/app.ts`, `server/src/index.ts`
- Test: `server/src/app.health.test.ts`

- [ ] **Step 1: Create `server/package.json`**

```json
{
  "name": "server",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc --noEmit",
    "start": "tsx src/index.ts",
    "migrate": "tsx src/db/migrate.ts",
    "seed": "tsx src/seed/profiles.ts && tsx src/seed/medellin.ts",
    "db:generate": "drizzle-kit generate",
    "test": "vitest run"
  },
  "dependencies": {
    "@fastify/cookie": "^10.0.0",
    "@fastify/jwt": "^9.0.0",
    "@fastify/static": "^8.0.0",
    "bcryptjs": "^2.4.3",
    "better-sqlite3": "^11.0.0",
    "drizzle-orm": "^0.36.0",
    "fastify": "^5.0.0",
    "tsx": "^4.19.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/better-sqlite3": "^7.6.11",
    "@types/node": "^22.0.0",
    "drizzle-kit": "^0.28.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

> **Production runs via `tsx`** (no compiled `dist/` step), consistent with the systemd unit in Task 0.9. `build` is a type-check only (`tsc --noEmit`); the client build produces the only shipped artifact. `tsx` is a runtime dependency (not dev) so it is present under any install flags.

- [ ] **Step 2: Create `server/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "noEmit": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "baseUrl": ".",
    "paths": { "@shared/*": ["../shared/*"] }
  },
  "include": ["src", "../shared", "drizzle.config.ts", "vitest.config.ts"]
}
```

- [ ] **Step 3: Create `server/vitest.config.ts`**

```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "node", include: ["src/**/*.test.ts"] },
  resolve: { alias: { "@shared": fileURLToPath(new URL("../shared/", import.meta.url)) } },
});
```

- [ ] **Step 4: Create `server/src/env.ts`**

```ts
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(8787),
  JWT_SECRET: z.string().min(8).default("dev-secret-change-me"),
  DB_PATH: z.string().default("./data/spanish.db"),
});

export const env = schema.parse(process.env);
```

- [ ] **Step 5: Write the failing health test — `server/src/app.health.test.ts`**

```ts
import { expect, test } from "vitest";
import { buildApp } from "./app.js";

test("GET /api/health returns ok", async () => {
  const app = buildApp();
  const res = await app.inject({ method: "GET", url: "/api/health" });
  expect(res.statusCode).toBe(200);
  expect(res.json()).toEqual({ status: "ok" });
  await app.close();
});
```

- [ ] **Step 6: Run it — expect FAIL**

Run: `npm --prefix server test`
Expected: FAIL — cannot find module `./app.js` / `buildApp` is not defined.

- [ ] **Step 7: Create `server/src/app.ts`**

```ts
import Fastify, { type FastifyInstance } from "fastify";

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: false });
  app.get("/api/health", async () => ({ status: "ok" }));
  return app;
}
```

- [ ] **Step 8: Create `server/src/index.ts`**

```ts
import { buildApp } from "./app.js";
import { env } from "./env.js";

const app = buildApp();
app.listen({ port: env.PORT, host: "127.0.0.1" }).then((addr) => {
  console.log(`spanish-api listening on ${addr}`);
});
```

- [ ] **Step 9: Run test — expect PASS**

Run: `npm --prefix server test`
Expected: PASS (1 test).

- [ ] **Step 10: Commit**

```bash
git add server package-lock.json
git commit -m "feat(server): fastify skeleton with health endpoint"
```

### Task 0.3: Database + Drizzle schema (users, settings)

**Files:**
- Create: `server/drizzle.config.ts`, `server/src/db/client.ts`, `server/src/db/schema.ts`, `server/src/db/migrate.ts`

- [ ] **Step 1: Create `server/drizzle.config.ts`**

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DB_PATH ?? "./data/spanish.db" },
});
```

- [ ] **Step 2: Create `server/src/db/schema.ts` (Phase 0 tables)**

```ts
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
```

- [ ] **Step 3: Create `server/src/db/client.ts`**

```ts
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { env } from "../env.js";
import * as schema from "./schema.js";

mkdirSync(dirname(env.DB_PATH), { recursive: true });
const sqlite = new Database(env.DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export { schema };
```

- [ ] **Step 4: Create `server/src/db/migrate.ts`**

```ts
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { fileURLToPath } from "node:url";
import { db } from "./client.js";

migrate(db, { migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)) });
console.log("migrations applied");
```

- [ ] **Step 5: Generate the migration & apply**

Run:
```bash
npm --prefix server run db:generate
npm --prefix server run migrate
```
Expected: a `server/drizzle/0000_*.sql` file is created and `migrations applied` prints. `server/data/spanish.db` now exists.

- [ ] **Step 6: Commit**

```bash
git add server/drizzle server/src/db server/drizzle.config.ts
git commit -m "feat(server): sqlite + drizzle schema for users and settings"
```

### Task 0.4: Seed 3 profiles + settings

**Files:**
- Create: `shared/types.ts`, `server/src/seed/profiles.ts`

- [ ] **Step 1: Create `shared/types.ts` (start the shared DTO file)**

```ts
export interface PublicUser {
  id: number;
  name: string;
  avatar: string;
}
```

- [ ] **Step 2: Create `server/src/seed/profiles.ts`**

```ts
import bcrypt from "bcryptjs";
import { db, schema } from "../db/client.js";

const PROFILES = [
  { name: "Fabio", avatar: "🐆", pin: "1111" },
  { name: "Aleks", avatar: "🦅", pin: "2222" },
  { name: "Igor", avatar: "🐊", pin: "3333" },
];

async function run() {
  const existing = db.select().from(schema.users).all();
  if (existing.length === 0) {
    for (const p of PROFILES) {
      db.insert(schema.users)
        .values({ name: p.name, avatar: p.avatar, pinHash: bcrypt.hashSync(p.pin, 10) })
        .run();
    }
    console.log("seeded 3 profiles (PINs 1111 / 2222 / 3333 — change in app later)");
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

run();
```

- [ ] **Step 3: Run seed & verify**

Run: `npm --prefix server exec tsx src/seed/profiles.ts`
Expected: prints "seeded 3 profiles…" and "seeded settings…". Re-running prints "already exist".

- [ ] **Step 4: Commit**

```bash
git add shared/types.ts server/src/seed/profiles.ts
git commit -m "feat(server): seed 3 PIN profiles and season settings"
```

### Task 0.5: Auth — PIN login, JWT cookie, /api/me (TDD)

**Files:**
- Create: `server/src/auth/plugin.ts`, `server/src/auth/routes.ts`
- Modify: `server/src/app.ts` (register auth)
- Test: `server/src/auth/auth.test.ts`

- [ ] **Step 1: Write the failing test — `server/src/auth/auth.test.ts`**

```ts
import { beforeAll, expect, test } from "vitest";
import { buildApp } from "../app.js";

let app: Awaited<ReturnType<typeof buildApp>>;
beforeAll(() => { app = buildApp(); });

test("login with correct PIN sets cookie and /api/me returns the user", async () => {
  const login = await app.inject({
    method: "POST", url: "/api/auth/login",
    payload: { userId: 1, pin: "1111" },
  });
  expect(login.statusCode).toBe(200);
  const cookie = login.cookies.find((c) => c.name === "token");
  expect(cookie).toBeTruthy();

  const me = await app.inject({
    method: "GET", url: "/api/me",
    cookies: { token: cookie!.value },
  });
  expect(me.statusCode).toBe(200);
  expect(me.json()).toMatchObject({ id: 1, name: expect.any(String) });
});

test("login with wrong PIN is rejected", async () => {
  const res = await app.inject({
    method: "POST", url: "/api/auth/login",
    payload: { userId: 1, pin: "0000" },
  });
  expect(res.statusCode).toBe(401);
});

test("/api/me without cookie is 401", async () => {
  const res = await app.inject({ method: "GET", url: "/api/me" });
  expect(res.statusCode).toBe(401);
});
```

- [ ] **Step 2: Run — expect FAIL** (`/api/auth/login` 404). Run: `npm --prefix server test`

- [ ] **Step 3: Create `server/src/auth/plugin.ts`**

```ts
import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { env } from "../env.js";

declare module "@fastify/jwt" {
  interface FastifyJWT { payload: { id: number }; user: { id: number }; }
}

export async function registerAuth(app: FastifyInstance) {
  await app.register(cookie);
  await app.register(jwt, {
    secret: env.JWT_SECRET,
    cookie: { cookieName: "token", signed: false },
  });

  app.decorate("requireAuth", async (req: FastifyRequest, reply: FastifyReply) => {
    try { await req.jwtVerify(); }
    catch { reply.code(401).send({ error: "unauthorized" }); }
  });
}

declare module "fastify" {
  interface FastifyInstance {
    requireAuth: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
```

- [ ] **Step 4: Create `server/src/auth/routes.ts`**

```ts
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db, schema } from "../db/client.js";

const loginBody = z.object({ userId: z.number().int(), pin: z.string().min(3) });

export async function authRoutes(app: FastifyInstance) {
  app.post("/api/auth/login", async (req, reply) => {
    const parsed = loginBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "bad request" });

    const user = db.select().from(schema.users).where(eq(schema.users.id, parsed.data.userId)).get();
    if (!user || !bcrypt.compareSync(parsed.data.pin, user.pinHash)) {
      return reply.code(401).send({ error: "invalid credentials" });
    }
    const token = app.jwt.sign({ id: user.id });
    reply.setCookie("token", token, {
      httpOnly: true, sameSite: "lax", path: "/",
      maxAge: 60 * 60 * 24 * 120, // 120 days — whole season
    });
    return { id: user.id, name: user.name, avatar: user.avatar };
  });

  app.post("/api/auth/logout", async (_req, reply) => {
    reply.clearCookie("token", { path: "/" });
    return { ok: true };
  });

  app.get("/api/me", { preHandler: (req, reply) => app.requireAuth(req, reply) }, async (req) => {
    const user = db.select().from(schema.users).where(eq(schema.users.id, req.user.id)).get();
    return { id: user!.id, name: user!.name, avatar: user!.avatar };
  });

  // Public: list profiles for the login picker (no PINs exposed)
  app.get("/api/profiles", async () => {
    return db.select({ id: schema.users.id, name: schema.users.name, avatar: schema.users.avatar })
      .from(schema.users).all();
  });
}
```

- [ ] **Step 5: Register auth in `server/src/app.ts`**

Replace the file contents with:
```ts
import Fastify, { type FastifyInstance } from "fastify";
import { registerAuth } from "./auth/plugin.js";
import { authRoutes } from "./auth/routes.js";

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: false });
  app.get("/api/health", async () => ({ status: "ok" }));
  app.register(async (instance) => {
    await registerAuth(instance);
    await instance.register(authRoutes);
  });
  return app;
}
```

> Note: tests call `buildApp()` synchronously then `app.inject()`; Fastify queues `register` and `inject()` awaits readiness, so this works without an explicit `ready()`.

- [ ] **Step 6: Run — expect PASS** (3 tests). Run: `npm --prefix server test`

- [ ] **Step 7: Commit**

```bash
git add server/src/auth server/src/app.ts
git commit -m "feat(server): PIN login with JWT cookie, /api/me, /api/profiles"
```

### Task 0.6: Client scaffold — Vite React PWA shell

**Files:**
- Create: `client/package.json`, `client/tsconfig.json`, `client/vite.config.ts`, `client/index.html`, `client/public/logo.svg`, `client/src/main.tsx`, `client/src/screens/Home.tsx`

- [ ] **Step 1: Create `client/package.json`**

```json
{
  "name": "client",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "@tanstack/react-query": "^5.59.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.27.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.5.0",
    "@testing-library/react": "^16.0.1",
    "@types/react": "^18.3.11",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.0",
    "jsdom": "^25.0.0",
    "typescript": "^5.6.0",
    "vite": "^5.4.0",
    "vite-plugin-pwa": "^0.20.5",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `client/vite.config.ts`**

```ts
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["logo.svg"],
      manifest: {
        name: "Spanish Quest",
        short_name: "Spanish",
        description: "Learn Spanish for Colombia — together.",
        theme_color: "#FFD21E",
        background_color: "#FFF9E6",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
  resolve: { alias: { "@shared": fileURLToPath(new URL("../shared", import.meta.url)) } },
  server: { port: 5173, proxy: { "/api": "http://127.0.0.1:8787" } },
});
```

- [ ] **Step 3: Create `client/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "baseUrl": ".",
    "paths": { "@shared/*": ["../shared/*"] }
  },
  "include": ["src", "../shared"]
}
```

- [ ] **Step 4: Create `client/index.html`**

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#FFD21E" />
    <title>Spanish Quest</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `client/public/logo.svg`** (source for icon generation)

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#FFD21E"/>
  <text x="50%" y="54%" font-size="300" text-anchor="middle" dominant-baseline="middle">🦜</text>
</svg>
```

- [ ] **Step 6: Generate the PWA PNG icons from the SVG**

Run: `cd client && npx -y @vite-pwa/assets-generator@latest --preset minimal-2023 public/logo.svg && cd ..`
Expected: creates `client/public/pwa-192x192.png` and `client/public/pwa-512x512.png` (plus apple-touch-icon). If the generator is unavailable offline, create two solid `#FFD21E` PNGs at 192×192 and 512×512 named exactly as above as a fallback.

- [ ] **Step 7: Create `client/src/main.tsx`** (minimal shell; screens wired in later tasks)

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { Home } from "./screens/Home.js";

const qc = new QueryClient();
const router = createBrowserRouter([{ path: "/", element: <Home /> }]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
);
```

- [ ] **Step 8: Create `client/src/screens/Home.tsx`** (placeholder — real dashboard in Task 1.7)

```tsx
export function Home() {
  return <main style={{ fontFamily: "system-ui", padding: 24 }}><h1>🦜 Spanish Quest</h1><p>¡Hola! Shell is alive.</p></main>;
}
```

- [ ] **Step 9: Install & verify dev server boots**

Run: `npm --prefix client install && npm --prefix client run build`
Expected: a clean production build in `client/dist` including `manifest.webmanifest`, `sw.js`, and the icons.

- [ ] **Step 10: Commit**

```bash
git add client
git commit -m "feat(client): vite react PWA shell with manifest and icons"
```

### Task 0.7: Client login screen + auth context (TDD)

**Files:**
- Create: `client/src/api.ts`, `client/src/auth.tsx`, `client/src/screens/Login.tsx`
- Modify: `client/src/main.tsx` (add /login route + guard)
- Create: `client/vitest.config.ts`, `client/src/test/setup.ts`, `client/src/screens/Login.test.tsx`

- [ ] **Step 1: Create `client/vitest.config.ts`**

```ts
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@shared": fileURLToPath(new URL("../shared", import.meta.url)) } },
  test: { environment: "jsdom", setupFiles: ["./src/test/setup.ts"], globals: true },
});
```

- [ ] **Step 2: Create `client/src/test/setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 3: Create `client/src/api.ts`**

```ts
import type { PublicUser } from "@shared/types.js";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? res.statusText);
  return res.json() as Promise<T>;
}

export const api = {
  profiles: () => fetch("/api/profiles").then((r) => json<PublicUser[]>(r)),
  login: (userId: number, pin: string) =>
    fetch("/api/auth/login", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId, pin }),
    }).then((r) => json<PublicUser>(r)),
  me: () => fetch("/api/me").then((r) => json<PublicUser>(r)),
  logout: () => fetch("/api/auth/logout", { method: "POST" }).then((r) => json<{ ok: true }>(r)),
};
```

- [ ] **Step 4: Write the failing test — `client/src/screens/Login.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { Login } from "./Login.js";

vi.mock("../api.js", () => ({
  api: { profiles: () => Promise.resolve([{ id: 1, name: "Jugador 1", avatar: "🧑" }]) },
}));

test("renders a profile button from the API", async () => {
  render(<Login onLoggedIn={() => {}} />);
  expect(await screen.findByText("Jugador 1")).toBeInTheDocument();
});
```

- [ ] **Step 5: Run — expect FAIL** (no `Login`). Run: `npm --prefix client test`

- [ ] **Step 6: Create `client/src/screens/Login.tsx`**

```tsx
import { useEffect, useState } from "react";
import { api } from "../api.js";
import type { PublicUser } from "@shared/types.js";

export function Login({ onLoggedIn }: { onLoggedIn: (u: PublicUser) => void }) {
  const [profiles, setProfiles] = useState<PublicUser[]>([]);
  const [picked, setPicked] = useState<PublicUser | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { api.profiles().then(setProfiles).catch(() => setError("No se pudo cargar")); }, []);

  async function submit() {
    if (!picked) return;
    try { onLoggedIn(await api.login(picked.id, pin)); }
    catch { setError("PIN incorrecto"); setPin(""); }
  }

  return (
    <main style={{ fontFamily: "system-ui", padding: 24, maxWidth: 420, margin: "0 auto" }}>
      <h1>🦜 Spanish Quest</h1>
      {!picked ? (
        <>
          <p>¿Quién eres?</p>
          {profiles.map((p) => (
            <button key={p.id} onClick={() => setPicked(p)} style={{ display: "block", width: "100%", padding: 14, margin: "8px 0", fontSize: 18 }}>
              {p.avatar} {p.name}
            </button>
          ))}
        </>
      ) : (
        <>
          <p>PIN para {picked.name}</p>
          <input inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} maxLength={6}
            style={{ fontSize: 24, padding: 10, width: "100%" }} autoFocus />
          <button onClick={submit} style={{ padding: 12, marginTop: 12, width: "100%" }}>Entrar</button>
          <button onClick={() => { setPicked(null); setPin(""); setError(""); }} style={{ padding: 8, marginTop: 8, width: "100%" }}>← atrás</button>
        </>
      )}
      {error && <p style={{ color: "crimson" }}>{error}</p>}
    </main>
  );
}
```

- [ ] **Step 7: Create `client/src/auth.tsx`** (auth gate used by main)

```tsx
import { useEffect, useState } from "react";
import { api } from "./api.js";
import type { PublicUser } from "@shared/types.js";
import { Login } from "./screens/Login.js";

export function RequireAuth({ children }: { children: (user: PublicUser) => React.ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.me().then(setUser).catch(() => setUser(null)).finally(() => setLoading(false)); }, []);
  if (loading) return <main style={{ padding: 24 }}>…</main>;
  if (!user) return <Login onLoggedIn={setUser} />;
  return <>{children(user)}</>;
}
```

- [ ] **Step 8: Modify `client/src/main.tsx`** to gate Home behind auth

Replace the router element line so the root route renders:
```tsx
import { RequireAuth } from "./auth.js";
// ...
const router = createBrowserRouter([
  { path: "/*", element: <RequireAuth>{(user) => <Home user={user} />}</RequireAuth> },
]);
```
And update `Home.tsx` to accept `{ user }`:
```tsx
import type { PublicUser } from "@shared/types.js";
export function Home({ user }: { user: PublicUser }) {
  return <main style={{ fontFamily: "system-ui", padding: 24 }}><h1>🦜 ¡Hola, {user.name}!</h1></main>;
}
```

- [ ] **Step 9: Run — expect PASS**. Run: `npm --prefix client test`

- [ ] **Step 10: Manual smoke test**

Run: `npm run migrate && npm run seed && npm run dev`
Open `http://localhost:5173`, pick Jugador 1, enter `1111` → should greet "¡Hola, Jugador 1!". Reload → stays logged in (cookie).

- [ ] **Step 11: Commit**

```bash
git add client
git commit -m "feat(client): PIN login screen + auth gate wired to API"
```

### Task 0.8: Production static serving

**Files:**
- Modify: `server/src/app.ts` (serve client build in production)

- [ ] **Step 1: Add static serving to `server/src/app.ts`**

Add after the auth register block, before `return app;`:
```ts
import { fileURLToPath } from "node:url";
import fastifyStatic from "@fastify/static";
// ...
if (process.env.NODE_ENV === "production") {
  const root = fileURLToPath(new URL("../../client/dist", import.meta.url));
  app.register(fastifyStatic, { root });
  app.setNotFoundHandler((req, reply) => {
    if (req.raw.url?.startsWith("/api")) return reply.code(404).send({ error: "not found" });
    return reply.sendFile("index.html"); // SPA fallback
  });
}
```

- [ ] **Step 2: Verify prod serving locally**

Run:
```bash
npm run build
NODE_ENV=production DB_PATH=./server/data/spanish.db node --import tsx server/src/index.ts
```
Open `http://localhost:8787` → the app loads (login screen) served by Fastify. API works at `/api/health`.

- [ ] **Step 3: Commit**

```bash
git add server/src/app.ts
git commit -m "feat(server): serve built client with SPA fallback in production"
```

### Task 0.9: Deploy to VPS behind Caddy

**Files:**
- Create: `scripts/spanish-api.service`, `scripts/deploy.sh`

- [ ] **Step 1: Create `scripts/spanish-api.service`**

```ini
[Unit]
Description=Spanish Quest API
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/spanish
EnvironmentFile=/opt/spanish/.env
ExecStart=/usr/bin/npx tsx server/src/index.ts
Restart=on-failure
RestartSec=3
MemoryMax=400M

[Install]
WantedBy=multi-user.target
```

- [ ] **Step 2: Create `scripts/deploy.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail
VPS=178.104.249.249
DEST=/opt/spanish

echo "→ syncing source to $VPS:$DEST"
ssh "$VPS" "mkdir -p $DEST"
rsync -az --delete \
  --exclude node_modules --exclude .git --exclude 'server/data' \
  --exclude '.env' --exclude 'client/dist' --exclude '.superpowers' \
  ./ "$VPS:$DEST/"

echo "→ building & migrating on VPS"
ssh "$VPS" "cd $DEST && npm install && npm run build && npm run migrate && (npm run seed || true)"

echo "→ installing/refreshing systemd unit"
ssh "$VPS" "cp $DEST/scripts/spanish-api.service /etc/systemd/system/ && systemctl daemon-reload && systemctl enable --now spanish-api && systemctl restart spanish-api"

echo "→ done. Check: systemctl status spanish-api"
```

- [ ] **Step 3: Create the production `.env` on the VPS (once, manually — never commit it)**

Run:
```bash
ssh 178.104.249.249 'mkdir -p /opt/spanish && cat > /opt/spanish/.env <<EOF
NODE_ENV=production
PORT=8787
JWT_SECRET='"$(openssl rand -hex 32)"'
DB_PATH=/opt/spanish/server/data/spanish.db
AI_BASE_URL=http://127.0.0.1:8642/v1
AI_API_KEY=hermes-local-2026
AI_MODEL=deepseek-v4-flash
EOF'
```

- [ ] **Step 4: Add the Caddy site block**

Append to the VPS Caddyfile (inside `kanban-v2-caddy-1`'s mounted Caddyfile — same file that defines `kanban.alpbot.ch`). Add:
```
spanish.alpbot.ch {
  encode zstd gzip
  reverse_proxy 127.0.0.1:8787
  log { output stdout
    format console }
}
```
Then reload Caddy:
```bash
ssh 178.104.249.249 'docker exec kanban-v2-caddy-1 caddy reload --config /etc/caddy/Caddyfile'
```
> Confirm the exact Caddyfile path/mount first with: `ssh 178.104.249.249 'docker inspect kanban-v2-caddy-1 --format "{{json .Mounts}}"'` — edit the host-side file that maps to `/etc/caddy/Caddyfile`, then reload.

- [ ] **Step 5: Ensure DNS** — confirm `spanish.alpbot.ch` has an A record → 178.104.249.249 (same as `kanban.alpbot.ch`). Caddy auto-provisions TLS on first request.

- [ ] **Step 6: Deploy & verify**

Run: `chmod +x scripts/deploy.sh && npm run deploy`
Then:
```bash
curl -s https://spanish.alpbot.ch/api/health   # → {"status":"ok"}
```
On each friend's phone, open `https://spanish.alpbot.ch` → browser offers "Add to Home Screen" (Android Chrome: install banner; iOS Safari: Share → Add to Home Screen). Installed app logs in with PIN.

- [ ] **Step 7: Commit**

```bash
git add scripts
git commit -m "chore(deploy): systemd unit, deploy script, Caddy site for spanish.alpbot.ch"
```

**✅ Phase 0 exit check:** `https://spanish.alpbot.ch` installs on phones; all 3 PINs log in; `/api/health` is green in prod.

---

# PHASE 1 — Playable MVP (Medellín, Stop ①)

Exit criteria: a logged-in player can open Stop ① homework, answer graded exercises, earn points recorded to the ledger, see the season leaderboard update, and the group can run a timed school session that awards participation points.

### Task 1.1: Content + scoring schema

**Files:**
- Modify: `server/src/db/schema.ts` (add tables)
- Modify: `shared/types.ts` (add DTOs)

- [ ] **Step 1: Append tables to `server/src/db/schema.ts`**

```ts
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
  kind: text("kind", { enum: ["dialogue", "homework"] }).notNull(),
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
  sourceType: text("source_type", { enum: ["exercise", "school", "sidequest"] }).notNull(),
  sourceId: integer("source_id").notNull(),
  points: integer("points").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => ({ uniq: uniqueIndex("ledger_unique").on(t.userId, t.sourceType, t.sourceId) }));

export const schoolSessions = sqliteTable("school_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  regionId: integer("region_id").notNull().references(() => regions.id),
  agendaJson: text("agenda_json", { mode: "json" }).$type<AgendaStep[]>().notNull(),
}, (t) => ({ uniqRegion: uniqueIndex("school_sessions_region").on(t.regionId) }));

export const sessionAttendance = sqliteTable("session_attendance", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id").notNull().references(() => schoolSessions.id),
  userId: integer("user_id").notNull().references(() => users.id),
}, (t) => ({ uniq: uniqueIndex("attend_unique").on(t.sessionId, t.userId) }));

export interface AgendaStep { minutes: number; title: string; instructions: string; }
```

- [ ] **Step 2: Append DTOs to `shared/types.ts`**

```ts
export interface RegionDTO {
  id: number; order: number; slug: string; name: string; theme: string;
  status: "locked" | "current" | "complete";
}
export interface ExerciseDTO {
  id: number; type: "multiple_choice" | "fill_blank"; prompt: string;
  options: string[] | null; points: number; done: boolean; gotCorrect: boolean;
}
export interface LessonDTO {
  id: number; kind: "dialogue" | "homework"; title: string; body: unknown;
  exercises: ExerciseDTO[];
}
export interface AttemptResult { correct: boolean; awarded: number; correctAnswer: string; }
export interface LeaderboardRow { userId: number; name: string; avatar: string; points: number; }
export interface AgendaStepDTO { minutes: number; title: string; instructions: string; }
export interface SchoolSessionDTO { id: number; regionName: string; agenda: AgendaStepDTO[]; }
```

- [ ] **Step 3: Generate & apply migration**

Run: `npm --prefix server run db:generate && npm --prefix server run migrate`
Expected: new `drizzle/0001_*.sql`, migration applies cleanly.

- [ ] **Step 4: Commit**

```bash
git add server/src/db/schema.ts server/drizzle shared/types.ts
git commit -m "feat(server): content, progress, ledger, and school-session schema"
```

### Task 1.2: Seed Medellín (Stop ①) content

**Files:**
- Create: `server/src/seed/medellin.ts`
- Modify: `server/src/test/setup.ts`

> **Follow the WP2 seed pattern:** export a `seedMedellin()` function (wrap the inserts in `db.transaction(...)`) and only auto-run it under a main-module guard — `import { pathToFileURL } from "node:url"; if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) seedMedellin();` — exactly like `seedProfiles()`. Then add `seedMedellin()` to `server/src/test/setup.ts` (call it after `seedProfiles()`) so the hermetic temp DB used by the Task 1.3–1.5 server tests contains the Medellín region, exercises, and school session. The code below shows the body; adapt it to the exported-function + guard shape.

- [ ] **Step 1: Create `server/src/seed/medellin.ts`**

```ts
import { eq } from "drizzle-orm";
import { db, schema } from "../db/client.js";
import type { AgendaStep } from "../db/schema.js";

function run() {
  const existing = db.select().from(schema.regions).where(eq(schema.regions.slug, "medellin")).get();
  if (existing) { console.log("medellin already seeded"); return; }

  const region = db.insert(schema.regions)
    .values({ order: 1, slug: "medellin", name: "Medellín", theme: "Saludos & lo básico" })
    .returning().get();

  // Lock the remaining stops as placeholders so the map shows the journey.
  const laterStops = [
    { order: 2, slug: "cartagena", name: "Cartagena", theme: "La comida & el mercado" },
    { order: 3, slug: "barranquilla", name: "Barranquilla", theme: "¡Fiesta y gente!" },
    { order: 4, slug: "santa-marta", name: "Santa Marta", theme: "Moverse & la playa" },
    { order: 5, slug: "sierra-nevada", name: "Sierra Nevada", theme: "Naturaleza & aventura" },
    { order: 6, slug: "medellin-finale", name: "Medellín (vuelta)", theme: "De vuelta · repaso" },
  ];
  for (const s of laterStops) db.insert(schema.regions).values(s).run();

  const vocab = [
    { es: "Hola", en: "Hello", example: "¡Hola, parcero!" },
    { es: "Buenas", en: "Hi / good day (casual)", example: "¡Buenas! ¿Cómo está?" },
    { es: "Gracias", en: "Thank you", example: "Muchas gracias." },
    { es: "Por favor", en: "Please", example: "Un tinto, por favor." },
    { es: "Me llamo…", en: "My name is…", example: "Me llamo Ana." },
    { es: "Mucho gusto", en: "Nice to meet you", example: "Mucho gusto, soy Juan." },
    { es: "Un tinto", en: "A black coffee (Colombian)", example: "¿Me regala un tinto?" },
    { es: "¿Cómo está?", en: "How are you?", example: "Hola, ¿cómo está?" },
  ];
  for (const v of vocab) db.insert(schema.vocab).values({ regionId: region.id, ...v }).run();

  // Dialogue lesson
  const dialogue = db.insert(schema.lessons).values({
    regionId: region.id, order: 1, kind: "dialogue", title: "Llegada a Medellín",
    bodyJson: {
      lines: [
        { who: "Taxista", es: "¡Buenas! ¿Para dónde va?", en: "Hi! Where are you headed?" },
        { who: "Tú", es: "Buenas, al centro por favor.", en: "Hi, downtown please." },
        { who: "Taxista", es: "Con mucho gusto, parcero.", en: "With pleasure, buddy." },
      ],
    },
  }).returning().get();
  void dialogue;

  // Homework lesson + exercises
  const hw = db.insert(schema.lessons).values({
    regionId: region.id, order: 2, kind: "homework", title: "Tarea: Saludos", bodyJson: null,
  }).returning().get();

  const exercises = [
    { type: "multiple_choice" as const, prompt: "How do you say 'Thank you'?", answer: "Gracias",
      optionsJson: ["Hola", "Gracias", "Adiós", "Por favor"], points: 10 },
    { type: "multiple_choice" as const, prompt: "'Un tinto' is…", answer: "A black coffee",
      optionsJson: ["A red wine", "A black coffee", "A tea", "A beer"], points: 10 },
    { type: "fill_blank" as const, prompt: "Complete: Me ____ Ana. (my name is)", answer: "llamo",
      optionsJson: null, points: 15 },
    { type: "fill_blank" as const, prompt: "Polite 'please' in Spanish: por ____", answer: "favor",
      optionsJson: null, points: 10 },
    { type: "multiple_choice" as const, prompt: "Someone says '¿Cómo está?'. They ask…", answer: "How are you?",
      optionsJson: ["Your name?", "How are you?", "Where are you?", "How old?"], points: 15 },
  ];
  exercises.forEach((e, i) =>
    db.insert(schema.exercises).values({ lessonId: hw.id, order: i + 1, ...e }).run());

  // School session agenda
  const agenda: AgendaStep[] = [
    { minutes: 10, title: "Calentamiento", instructions: "Review the 8 Medellín vocab words out loud, taking turns." },
    { minutes: 15, title: "Diálogo", instructions: "Read 'Llegada a Medellín' together — each person plays a role." },
    { minutes: 20, title: "Juego de vocabulario", instructions: "One person says the English, the others race to say the Spanish." },
    { minutes: 15, title: "Hablar", instructions: "Pair up and introduce yourselves in Spanish: greet, name, 'mucho gusto'." },
  ];
  db.insert(schema.schoolSessions).values({ regionId: region.id, agendaJson: agenda }).run();

  console.log("seeded Medellín content (vocab, dialogue, homework, school session)");
}

run();
```

- [ ] **Step 2: Run seed & verify**

Run: `npm --prefix server exec tsx src/seed/medellin.ts`
Expected: "seeded Medellín content…". Re-run prints "already seeded".

- [ ] **Step 3: Commit**

```bash
git add server/src/seed/medellin.ts
git commit -m "feat(server): seed Medellin Stop 1 content and school session"
```

### Task 1.3: Content API (TDD)

**Files:**
- Create: `server/src/content/routes.ts`, `server/src/scoring/service.ts` (regionStatus helper)
- Modify: `server/src/app.ts` (register content routes)
- Test: `server/src/content/content.test.ts`

- [ ] **Step 1: Create `server/src/scoring/service.ts` with `regionStatus`**

```ts
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "../db/client.js";

/** A region is complete for a user when every exercise in it has a correct progress row. */
export function regionExerciseIds(regionId: number): number[] {
  const lessons = db.select({ id: schema.lessons.id }).from(schema.lessons)
    .where(eq(schema.lessons.regionId, regionId)).all();
  if (lessons.length === 0) return [];
  return db.select({ id: schema.exercises.id }).from(schema.exercises)
    .where(inArray(schema.exercises.lessonId, lessons.map((l) => l.id))).all().map((e) => e.id);
}

export function isRegionComplete(userId: number, regionId: number): boolean {
  const exIds = regionExerciseIds(regionId);
  if (exIds.length === 0) return false;
  const correct = db.select({ id: schema.progress.id }).from(schema.progress)
    .where(and(eq(schema.progress.userId, userId), inArray(schema.progress.exerciseId, exIds),
      eq(schema.progress.correct, true))).all();
  return correct.length >= exIds.length;
}

export function regionStatuses(userId: number) {
  const regions = db.select().from(schema.regions).orderBy(schema.regions.order).all();
  let prevComplete = true; // first region is always unlocked
  return regions.map((r) => {
    const complete = isRegionComplete(userId, r.id);
    const status: "locked" | "current" | "complete" = complete ? "complete" : prevComplete ? "current" : "locked";
    prevComplete = complete;
    return { id: r.id, order: r.order, slug: r.slug, name: r.name, theme: r.theme, status };
  });
}
```

- [ ] **Step 2: Write the failing test — `server/src/content/content.test.ts`**

```ts
import { beforeAll, expect, test } from "vitest";
import { buildApp } from "../app.js";

async function authedCookie(app: any) {
  const res = await app.inject({ method: "POST", url: "/api/auth/login", payload: { userId: 1, pin: "1111" } });
  return res.cookies.find((c: any) => c.name === "token")!.value;
}

let app: any, token: string;
beforeAll(async () => { app = buildApp(); token = await authedCookie(app); });

test("GET /api/regions returns Medellín as current/unlocked first", async () => {
  const res = await app.inject({ method: "GET", url: "/api/regions", cookies: { token } });
  expect(res.statusCode).toBe(200);
  const regions = res.json();
  expect(regions[0]).toMatchObject({ slug: "medellin", status: "current" });
  expect(regions.find((r: any) => r.slug === "cartagena").status).toBe("locked");
});

test("GET /api/regions/:id returns lessons with exercises (answers stripped)", async () => {
  const regions = (await app.inject({ method: "GET", url: "/api/regions", cookies: { token } })).json();
  const medellinId = regions[0].id;
  const res = await app.inject({ method: "GET", url: `/api/regions/${medellinId}`, cookies: { token } });
  expect(res.statusCode).toBe(200);
  const hw = res.json().lessons.find((l: any) => l.kind === "homework");
  expect(hw.exercises.length).toBeGreaterThan(0);
  expect(hw.exercises[0]).not.toHaveProperty("answer"); // never leak the answer
});
```

- [ ] **Step 3: Run — expect FAIL** (routes 404). Run: `npm --prefix server test`

- [ ] **Step 4: Create `server/src/content/routes.ts`**

```ts
import { asc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db, schema } from "../db/client.js";
import { regionStatuses } from "../scoring/service.js";

export async function contentRoutes(app: FastifyInstance) {
  const auth = (req: any, reply: any) => app.requireAuth(req, reply);

  app.get("/api/regions", { preHandler: auth }, async (req) => regionStatuses(req.user.id));

  app.get<{ Params: { id: string } }>("/api/regions/:id", { preHandler: auth }, async (req) => {
    const regionId = Number(req.params.id);
    const lessons = db.select().from(schema.lessons)
      .where(eq(schema.lessons.regionId, regionId)).orderBy(asc(schema.lessons.order)).all();

    const done = db.select().from(schema.progress).where(eq(schema.progress.userId, req.user.id)).all();
    const doneMap = new Map(done.map((d) => [d.exerciseId, d.correct]));

    return {
      lessons: lessons.map((l) => ({
        id: l.id, kind: l.kind, title: l.title, body: l.bodyJson,
        exercises: db.select().from(schema.exercises)
          .where(eq(schema.exercises.lessonId, l.id)).orderBy(asc(schema.exercises.order)).all()
          .map((e) => ({
            id: e.id, type: e.type, prompt: e.prompt, options: e.optionsJson,
            points: e.points, done: doneMap.has(e.id), gotCorrect: doneMap.get(e.id) ?? false,
            // NOTE: answer intentionally omitted
          })),
      })),
    };
  });
}
```

- [ ] **Step 5: Register in `server/src/app.ts`** — inside the register block add:
```ts
import { contentRoutes } from "./content/routes.js";
// ... after authRoutes:
await instance.register(contentRoutes);
```

- [ ] **Step 6: Run — expect PASS**. Run: `npm --prefix server test`

- [ ] **Step 7: Commit**

```bash
git add server/src/content server/src/scoring/service.ts server/src/app.ts
git commit -m "feat(server): content API with region gating and answer-stripped exercises"
```

### Task 1.4: Attempt grading + point award (TDD — the scoring core)

**Files:**
- Modify: `server/src/scoring/service.ts` (add `award` + `gradeAttempt`)
- Create: `server/src/scoring/routes.ts`
- Modify: `server/src/app.ts`
- Test: `server/src/scoring/scoring.test.ts`

- [ ] **Step 1: Add to `server/src/scoring/service.ts`**

```ts
import { sql } from "drizzle-orm";

/** Idempotent point award: unique on (user, sourceType, sourceId). Returns points actually added. */
export function award(userId: number, sourceType: "exercise" | "school" | "sidequest", sourceId: number, points: number): number {
  const res = db.insert(schema.pointsLedger)
    .values({ userId, sourceType, sourceId, points })
    .onConflictDoNothing().run();
  return res.changes > 0 ? points : 0;
}

function normalize(s: string): string {
  return s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Grade an exercise answer server-side. Points are awarded only on the FIRST attempt
 * at an exercise, and only if correct — so revealing the correct answer on a wrong
 * attempt can't be farmed (a later correct retry records progress but earns nothing).
 */
export function gradeAttempt(userId: number, exerciseId: number, answer: string): AttemptResult | null {
  const ex = db.select().from(schema.exercises).where(eq(schema.exercises.id, exerciseId)).get();
  if (!ex) return null;

  const prior = db.select({ id: schema.progress.id }).from(schema.progress)
    .where(and(eq(schema.progress.userId, userId), eq(schema.progress.exerciseId, exerciseId))).get();
  const correct = normalize(answer) === normalize(ex.answer);

  db.insert(schema.progress).values({ userId, exerciseId, correct })
    .onConflictDoUpdate({
      target: [schema.progress.userId, schema.progress.exerciseId],
      set: { correct: sql`${schema.progress.correct} OR ${correct ? 1 : 0}` },
    }).run();

  const awarded = !prior && correct ? award(userId, "exercise", exerciseId, ex.points) : 0;
  return { correct, awarded, correctAnswer: ex.answer };
}

export function leaderboard() {
  return db.select({
    userId: schema.users.id, name: schema.users.name, avatar: schema.users.avatar,
    points: sql<number>`COALESCE(SUM(${schema.pointsLedger.points}), 0)`,
  }).from(schema.users)
    .leftJoin(schema.pointsLedger, eq(schema.pointsLedger.userId, schema.users.id))
    .groupBy(schema.users.id)
    .orderBy(sql`points DESC`).all();
}
```

- [ ] **Step 2: Write the failing test — `server/src/scoring/scoring.test.ts`**

```ts
import { beforeAll, expect, test } from "vitest";
import { buildApp } from "../app.js";

let app: any, token: string, exerciseId: number, answer: string;
beforeAll(async () => {
  app = buildApp();
  token = (await app.inject({ method: "POST", url: "/api/auth/login", payload: { userId: 2, pin: "2222" } }))
    .cookies.find((c: any) => c.name === "token").value;
  const regions = (await app.inject({ method: "GET", url: "/api/regions", cookies: { token } })).json();
  const region = (await app.inject({ method: "GET", url: `/api/regions/${regions[0].id}`, cookies: { token } })).json();
  const ex = region.lessons.find((l: any) => l.kind === "homework").exercises[0];
  exerciseId = ex.id;
  answer = "Gracias"; // first seeded MC answer
});

test("correct attempt awards points once; repeat awards zero", async () => {
  const first = await app.inject({ method: "POST", url: "/api/attempts",
    payload: { exerciseId, answer }, cookies: { token } });
  expect(first.json()).toMatchObject({ correct: true });
  expect(first.json().awarded).toBeGreaterThan(0);

  const second = await app.inject({ method: "POST", url: "/api/attempts",
    payload: { exerciseId, answer }, cookies: { token } });
  expect(second.json().awarded).toBe(0); // idempotent — no point farming
});

test("leaderboard reflects awarded points", async () => {
  const res = await app.inject({ method: "GET", url: "/api/leaderboard", cookies: { token } });
  expect(res.statusCode).toBe(200);
  const rows = res.json();
  expect(rows.find((r: any) => r.userId === 2).points).toBeGreaterThan(0);
});
```

- [ ] **Step 3: Run — expect FAIL**. Run: `npm --prefix server test`

- [ ] **Step 4: Create `server/src/scoring/routes.ts`**

```ts
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { gradeAttempt, leaderboard } from "./service.js";

const attemptBody = z.object({ exerciseId: z.number().int(), answer: z.string().min(1) });

export async function scoringRoutes(app: FastifyInstance) {
  const auth = (req: any, reply: any) => app.requireAuth(req, reply);

  app.post("/api/attempts", { preHandler: auth }, async (req, reply) => {
    const parsed = attemptBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "bad request" });
    const result = gradeAttempt((req as any).user.id, parsed.data.exerciseId, parsed.data.answer);
    if (!result) return reply.code(404).send({ error: "exercise not found" });
    return result;
  });

  app.get("/api/leaderboard", { preHandler: auth }, async () => leaderboard());
}
```

- [ ] **Step 5: Register in `server/src/app.ts`**:
```ts
import { scoringRoutes } from "./scoring/routes.js";
// ... await instance.register(scoringRoutes);
```

- [ ] **Step 6: Run — expect PASS**. Run: `npm --prefix server test`

- [ ] **Step 7: Commit**

```bash
git add server/src/scoring server/src/app.ts
git commit -m "feat(server): server-side grading, idempotent point awards, leaderboard"
```

### Task 1.5: School session API (TDD)

**Files:**
- Create: `server/src/school/routes.ts`
- Modify: `server/src/app.ts`
- Test: `server/src/school/school.test.ts`

- [ ] **Step 1: Write the failing test — `server/src/school/school.test.ts`**

```ts
import { beforeAll, expect, test } from "vitest";
import { buildApp } from "../app.js";

let app: any, token: string;
beforeAll(async () => {
  app = buildApp();
  token = (await app.inject({ method: "POST", url: "/api/auth/login", payload: { userId: 3, pin: "3333" } }))
    .cookies.find((c: any) => c.name === "token").value;
});

test("GET /api/school/current returns an agenda", async () => {
  const res = await app.inject({ method: "GET", url: "/api/school/current", cookies: { token } });
  expect(res.statusCode).toBe(200);
  expect(res.json().agenda.length).toBeGreaterThan(0);
});

test("completing a session awards 100 to each present user, once", async () => {
  const session = (await app.inject({ method: "GET", url: "/api/school/current", cookies: { token } })).json();
  const first = await app.inject({ method: "POST", url: `/api/school/${session.id}/complete`,
    payload: { presentUserIds: [3] }, cookies: { token } });
  expect(first.json().awarded[0]).toMatchObject({ userId: 3, points: 100 });

  const again = await app.inject({ method: "POST", url: `/api/school/${session.id}/complete`,
    payload: { presentUserIds: [3] }, cookies: { token } });
  expect(again.json().awarded[0].points).toBe(0); // idempotent
});
```

- [ ] **Step 2: Run — expect FAIL**. Run: `npm --prefix server test`

- [ ] **Step 3: Create `server/src/school/routes.ts`**

```ts
import { asc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db, schema } from "../db/client.js";
import { award } from "../scoring/service.js";

const completeBody = z.object({ presentUserIds: z.array(z.number().int()).min(1) });

export async function schoolRoutes(app: FastifyInstance) {
  const auth = (req: any, reply: any) => app.requireAuth(req, reply);

  // Current = the session for the earliest (current) region that has one.
  app.get("/api/school/current", { preHandler: auth }, async (_req, reply) => {
    const session = db.select().from(schema.schoolSessions)
      .orderBy(asc(schema.schoolSessions.id)).get();
    if (!session) return reply.code(404).send({ error: "no session" });
    const region = db.select().from(schema.regions)
      .where(eq(schema.regions.id, session.regionId)).get();
    return { id: session.id, regionName: region!.name, agenda: session.agendaJson };
  });

  app.post<{ Params: { id: string } }>("/api/school/:id/complete", { preHandler: auth }, async (req, reply) => {
    const idParsed = sessionIdParam.safeParse(req.params.id); // z.coerce.number().int().positive()
    if (!idParsed.success) return reply.code(400).send({ error: "bad session id" });
    const parsed = completeBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "bad request" });

    const sessionId = idParsed.data;
    const session = db.select().from(schema.schoolSessions)
      .where(eq(schema.schoolSessions.id, sessionId)).get();
    if (!session) return reply.code(404).send({ error: "session not found" });

    const awarded = parsed.data.presentUserIds.map((userId) => {
      db.insert(schema.sessionAttendance).values({ sessionId, userId }).onConflictDoNothing().run();
      const points = award(userId, "school", sessionId, 100);
      return { userId, points };
    });
    return { awarded };
  });
}
```

- [ ] **Step 4: Register in `server/src/app.ts`**:
```ts
import { schoolRoutes } from "./school/routes.js";
// ... await instance.register(schoolRoutes);
```

- [ ] **Step 5: Run — expect PASS**. Run: `npm --prefix server test`

- [ ] **Step 6: Commit**

```bash
git add server/src/school server/src/app.ts
git commit -m "feat(server): school session agenda + attendance point award"
```

### Task 1.6: Client — API helpers for content/scoring/school

**Files:**
- Modify: `client/src/api.ts`

- [ ] **Step 1: Extend `client/src/api.ts`**

```ts
import type {
  AttemptResult, LeaderboardRow, LessonDTO, RegionDTO, SchoolSessionDTO,
} from "@shared/types.js";

// add inside the existing `api` object:
  regions: () => fetch("/api/regions").then((r) => json<RegionDTO[]>(r)),
  region: (id: number) => fetch(`/api/regions/${id}`).then((r) => json<{ lessons: LessonDTO[] }>(r)),
  attempt: (exerciseId: number, answer: string) =>
    fetch("/api/attempts", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ exerciseId, answer }) }).then((r) => json<AttemptResult>(r)),
  leaderboard: () => fetch("/api/leaderboard").then((r) => json<LeaderboardRow[]>(r)),
  school: () => fetch("/api/school/current").then((r) => json<SchoolSessionDTO>(r)),
  completeSchool: (id: number, presentUserIds: number[]) =>
    fetch(`/api/school/${id}/complete`, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ presentUserIds }) }).then((r) => json<{ awarded: { userId: number; points: number }[] }>(r)),
```

- [ ] **Step 2: Typecheck & commit**

Run: `npm --prefix client run build`
```bash
git add client/src/api.ts
git commit -m "feat(client): typed API helpers for content, scoring, school"
```

### Task 1.7: Client — Home dashboard (TDD)

**Files:**
- Modify: `client/src/screens/Home.tsx`
- Create: `client/src/components/BottomNav.tsx`
- Test: `client/src/screens/Home.test.tsx`

- [ ] **Step 1: Write the failing test — `client/src/screens/Home.test.tsx`**

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, test, vi } from "vitest";
import { Home } from "./Home.js";

vi.mock("../api.js", () => ({
  api: {
    regions: () => Promise.resolve([{ id: 1, order: 1, slug: "medellin", name: "Medellín", theme: "Saludos", status: "current" }]),
    leaderboard: () => Promise.resolve([{ userId: 1, name: "Jugador 1", avatar: "🧑", points: 120 }]),
  },
}));

function wrap(ui: React.ReactNode) {
  return <QueryClientProvider client={new QueryClient()}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>;
}

test("shows greeting, current region, and leaderboard points", async () => {
  render(wrap(<Home user={{ id: 1, name: "Jugador 1", avatar: "🧑" }} />));
  expect(await screen.findByText(/Medellín/)).toBeInTheDocument();
  expect(await screen.findByText(/120/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run — expect FAIL**. Run: `npm --prefix client test`

- [ ] **Step 3: Create `client/src/components/BottomNav.tsx`**

```tsx
import { Link, useLocation } from "react-router-dom";

const items = [
  { to: "/", icon: "🏠", label: "Inicio" },
  { to: "/ruta", icon: "🧭", label: "Ruta" },
  { to: "/tarea", icon: "📚", label: "Tarea" },
  { to: "/ranking", icon: "🏆", label: "Ranking" },
  { to: "/clase", icon: "🏫", label: "Clase" },
];

export function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav style={{ position: "sticky", bottom: 0, display: "flex", justifyContent: "space-around",
      background: "#fff", borderTop: "1px solid #eee", padding: "8px 0" }}>
      {items.map((i) => (
        <Link key={i.to} to={i.to} style={{ textAlign: "center", fontSize: 11, textDecoration: "none",
          color: pathname === i.to ? "#0a6e5c" : "#999" }}>
          <div style={{ fontSize: 20 }}>{i.icon}</div>{i.label}
        </Link>
      ))}
    </nav>
  );
}
```

- [ ] **Step 4: Replace `client/src/screens/Home.tsx`**

```tsx
import { useQuery } from "@tanstack/react-query";
import type { PublicUser } from "@shared/types.js";
import { api } from "../api.js";
import { BottomNav } from "../components/BottomNav.js";

export function Home({ user }: { user: PublicUser }) {
  const regions = useQuery({ queryKey: ["regions"], queryFn: api.regions });
  const board = useQuery({ queryKey: ["leaderboard"], queryFn: api.leaderboard });
  const current = regions.data?.find((r) => r.status === "current");

  return (
    <div style={{ fontFamily: "system-ui", minHeight: "100dvh", background: "#FFF9E6", display: "flex", flexDirection: "column" }}>
      <header style={{ background: "#FFD21E", padding: 14 }}>
        <strong style={{ color: "#0a6e5c" }}>🦜 ¡Buenas, {user.name}!</strong>
      </header>
      <main style={{ flex: 1, padding: 14, display: "grid", gap: 12 }}>
        <section style={{ background: "#fff", borderRadius: 14, padding: 14 }}>
          <div style={{ fontSize: 12, color: "#0a6e5c", fontWeight: 700 }}>🧭 Tu parada actual</div>
          {current ? <h2 style={{ margin: "6px 0" }}>{current.name} — {current.theme}</h2> : <p>…</p>}
        </section>
        <section style={{ background: "#fff", borderRadius: 14, padding: 14 }}>
          <div style={{ fontSize: 12, color: "#0a6e5c", fontWeight: 700 }}>🏆 Clasificación</div>
          {board.data?.map((row, i) => (
            <div key={row.userId} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
              <span>{["🥇", "🥈", "🥉"][i] ?? "•"} {row.name}</span><b>{row.points}</b>
            </div>
          ))}
          <div style={{ fontSize: 10, color: "#999", marginTop: 6 }}>Gran campeón: 31 de enero 2027 🇨🇴</div>
        </section>
      </main>
      <BottomNav />
    </div>
  );
}
```

- [ ] **Step 5: Run — expect PASS**. Run: `npm --prefix client test`

- [ ] **Step 6: Commit**

```bash
git add client/src/screens/Home.tsx client/src/components/BottomNav.tsx
git commit -m "feat(client): home dashboard with current stop and leaderboard"
```

### Task 1.8: Client — Homework exercise player (TDD)

**Files:**
- Create: `client/src/screens/Homework.tsx`
- Modify: `client/src/main.tsx` (routes)
- Test: `client/src/screens/Homework.test.tsx`

- [ ] **Step 1: Write the failing test — `client/src/screens/Homework.test.tsx`**

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, test, vi } from "vitest";
import { Homework } from "./Homework.js";

vi.mock("../api.js", () => ({
  api: {
    regions: () => Promise.resolve([{ id: 1, order: 1, slug: "medellin", name: "Medellín", theme: "Saludos", status: "current" }]),
    region: () => Promise.resolve({ lessons: [{ id: 2, kind: "homework", title: "Tarea", body: null, exercises: [
      { id: 10, type: "multiple_choice", prompt: "'Thank you'?", options: ["Hola", "Gracias"], points: 10, done: false, gotCorrect: false },
    ] }] }),
    attempt: vi.fn(() => Promise.resolve({ correct: true, awarded: 10, correctAnswer: "Gracias" })),
  },
}));

function wrap(ui: React.ReactNode) {
  return <QueryClientProvider client={new QueryClient()}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>;
}

test("answering a multiple-choice question shows a correct result", async () => {
  render(wrap(<Homework />));
  fireEvent.click(await screen.findByText("Gracias"));
  expect(await screen.findByText(/\+10/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run — expect FAIL**. Run: `npm --prefix client test`

- [ ] **Step 3: Create `client/src/screens/Homework.tsx`**

```tsx
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { ExerciseDTO } from "@shared/types.js";
import { api } from "../api.js";
import { BottomNav } from "../components/BottomNav.js";

export function Homework() {
  const regions = useQuery({ queryKey: ["regions"], queryFn: api.regions });
  const current = regions.data?.find((r) => r.status === "current");
  const region = useQuery({
    queryKey: ["region", current?.id], enabled: !!current,
    queryFn: () => api.region(current!.id),
  });
  const hw = region.data?.lessons.find((l) => l.kind === "homework");

  return (
    <div style={{ fontFamily: "system-ui", minHeight: "100dvh", background: "#FFF9E6", display: "flex", flexDirection: "column" }}>
      <header style={{ background: "#FFD21E", padding: 14 }}><strong style={{ color: "#0a6e5c" }}>📚 {hw?.title ?? "Tarea"}</strong></header>
      <main style={{ flex: 1, padding: 14, display: "grid", gap: 14 }}>
        {hw?.exercises.map((ex) => <ExerciseCard key={ex.id} ex={ex} />)}
      </main>
      <BottomNav />
    </div>
  );
}

function ExerciseCard({ ex }: { ex: ExerciseDTO }) {
  const [value, setValue] = useState("");
  const [result, setResult] = useState<{ correct: boolean; awarded: number; correctAnswer: string } | null>(null);

  async function submit(answer: string) {
    setResult(await api.attempt(ex.id, answer));
  }

  return (
    <section style={{ background: "#fff", borderRadius: 14, padding: 14 }}>
      <p style={{ fontWeight: 600 }}>{ex.prompt}</p>
      {ex.type === "multiple_choice" && ex.options?.map((o) => (
        <button key={o} onClick={() => submit(o)} disabled={!!result}
          style={{ display: "block", width: "100%", padding: 12, margin: "6px 0" }}>{o}</button>
      ))}
      {ex.type === "fill_blank" && !result && (
        <div style={{ display: "flex", gap: 8 }}>
          <input value={value} onChange={(e) => setValue(e.target.value)} style={{ flex: 1, padding: 10 }} />
          <button onClick={() => submit(value)}>OK</button>
        </div>
      )}
      {result && (
        <p style={{ color: result.correct ? "#2e7d32" : "crimson", fontWeight: 700 }}>
          {result.correct ? `¡Correcto! +${result.awarded}` : `Casi — era "${result.correctAnswer}"`}
        </p>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Add routes in `client/src/main.tsx`**

Replace the router definition to include all screens behind auth:
```tsx
import { Ruta } from "./screens/Ruta.js";
import { Homework } from "./screens/Homework.js";
import { Leaderboard } from "./screens/Leaderboard.js";
import { School } from "./screens/School.js";
// ...
const router = createBrowserRouter([
  { path: "/", element: <RequireAuth>{(u) => <Home user={u} />}</RequireAuth> },
  { path: "/ruta", element: <RequireAuth>{() => <Ruta />}</RequireAuth> },
  { path: "/tarea", element: <RequireAuth>{() => <Homework />}</RequireAuth> },
  { path: "/ranking", element: <RequireAuth>{() => <Leaderboard />}</RequireAuth> },
  { path: "/clase", element: <RequireAuth>{(u) => <School user={u} />}</RequireAuth> },
]);
```

- [ ] **Step 5: Run — expect PASS** (Home test still green; Homework green). Run: `npm --prefix client test`

> If the build fails because `Ruta`/`Leaderboard`/`School` don't exist yet, create them as one-line stubs now (`export function Ruta(){return null}` etc.) and flesh them out in Tasks 1.9–1.11.

- [ ] **Step 6: Commit**

```bash
git add client/src/screens/Homework.tsx client/src/main.tsx
git commit -m "feat(client): homework exercise player with server-graded attempts"
```

### Task 1.9: Client — Leaderboard screen

**Files:**
- Create/replace: `client/src/screens/Leaderboard.tsx`

- [ ] **Step 1: Create `client/src/screens/Leaderboard.tsx`**

```tsx
import { useQuery } from "@tanstack/react-query";
import { api } from "../api.js";
import { BottomNav } from "../components/BottomNav.js";

export function Leaderboard() {
  const board = useQuery({ queryKey: ["leaderboard"], queryFn: api.leaderboard });
  return (
    <div style={{ fontFamily: "system-ui", minHeight: "100dvh", background: "#FFF9E6", display: "flex", flexDirection: "column" }}>
      <header style={{ background: "#FFD21E", padding: 14 }}><strong style={{ color: "#0a6e5c" }}>🏆 Clasificación — Temporada</strong></header>
      <main style={{ flex: 1, padding: 14 }}>
        {board.data?.map((row, i) => (
          <div key={row.userId} style={{ display: "flex", justifyContent: "space-between", background: "#fff",
            borderRadius: 12, padding: 14, margin: "8px 0", fontSize: 18 }}>
            <span>{["🥇", "🥈", "🥉"][i] ?? `${i + 1}.`} {row.avatar} {row.name}</span>
            <b style={{ color: "#e8590c" }}>{row.points}</b>
          </div>
        ))}
        <p style={{ textAlign: "center", fontSize: 12, color: "#999" }}>Gran campeón coronado el 31 de enero 2027 🇨🇴</p>
      </main>
      <BottomNav />
    </div>
  );
}
```

- [ ] **Step 2: Build & commit**

Run: `npm --prefix client run build`
```bash
git add client/src/screens/Leaderboard.tsx
git commit -m "feat(client): season leaderboard screen"
```

### Task 1.10: Client — Ruta (Colombia map) screen

**Files:**
- Create/replace: `client/src/screens/Ruta.tsx`

- [ ] **Step 1: Create `client/src/screens/Ruta.tsx`**

```tsx
import { useQuery } from "@tanstack/react-query";
import { api } from "../api.js";
import { BottomNav } from "../components/BottomNav.js";

const ICON = { complete: "✅", current: "🧭", locked: "🔒" } as const;

export function Ruta() {
  const regions = useQuery({ queryKey: ["regions"], queryFn: api.regions });
  return (
    <div style={{ fontFamily: "system-ui", minHeight: "100dvh", background: "#0a6e5c", display: "flex", flexDirection: "column" }}>
      <header style={{ padding: 14, color: "#fff" }}><strong>🧭 Tu ruta por Colombia</strong></header>
      <main style={{ flex: 1, padding: 14, display: "grid", gap: 10 }}>
        {regions.data?.map((r) => (
          <div key={r.id} style={{ display: "flex", gap: 12, alignItems: "center", background: "#fff",
            borderRadius: 12, padding: 12, opacity: r.status === "locked" ? 0.6 : 1 }}>
            <div style={{ fontSize: 24 }}>{ICON[r.status]}</div>
            <div><b>{r.order}. {r.name}</b><div style={{ fontSize: 12, color: "#555" }}>{r.theme}</div></div>
          </div>
        ))}
      </main>
      <BottomNav />
    </div>
  );
}
```

- [ ] **Step 2: Build & commit**

Run: `npm --prefix client run build`
```bash
git add client/src/screens/Ruta.tsx
git commit -m "feat(client): Colombia route map screen with lock/current/complete states"
```

### Task 1.11: Client — School session facilitator (TDD)

**Files:**
- Create/replace: `client/src/screens/School.tsx`
- Test: `client/src/screens/School.test.tsx`

- [ ] **Step 1: Write the failing test — `client/src/screens/School.test.tsx`**

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, test, vi } from "vitest";
import { School } from "./School.js";

vi.mock("../api.js", () => ({
  api: {
    school: () => Promise.resolve({ id: 1, regionName: "Medellín", agenda: [
      { minutes: 10, title: "Calentamiento", instructions: "Review vocab out loud." },
    ] }),
    completeSchool: vi.fn(() => Promise.resolve({ awarded: [{ userId: 1, points: 100 }] })),
  },
}));

function wrap(ui: React.ReactNode) {
  return <QueryClientProvider client={new QueryClient()}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>;
}

test("shows the first agenda step for the session's region", async () => {
  render(wrap(<School user={{ id: 1, name: "Jugador 1", avatar: "🧑" }} />));
  expect(await screen.findByText("Calentamiento")).toBeInTheDocument();
  expect(screen.getByText(/Medellín/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run — expect FAIL**. Run: `npm --prefix client test`

- [ ] **Step 3: Create `client/src/screens/School.tsx`**

```tsx
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { PublicUser } from "@shared/types.js";
import { api } from "../api.js";
import { BottomNav } from "../components/BottomNav.js";

export function School({ user }: { user: PublicUser }) {
  const session = useQuery({ queryKey: ["school"], queryFn: api.school });
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const agenda = session.data?.agenda ?? [];
  const current = agenda[step];

  async function finish() {
    if (session.data) { await api.completeSchool(session.data.id, [user.id]); setDone(true); }
  }

  return (
    <div style={{ fontFamily: "system-ui", minHeight: "100dvh", background: "#FFF9E6", display: "flex", flexDirection: "column" }}>
      <header style={{ background: "#0a6e5c", color: "#fff", padding: 14 }}>
        <strong>🏫 Clase — {session.data?.regionName}</strong>
      </header>
      <main style={{ flex: 1, padding: 18 }}>
        {done ? (
          <h2>¡Buen trabajo! +100 pts de participación 🎉</h2>
        ) : current ? (
          <section style={{ background: "#fff", borderRadius: 16, padding: 18 }}>
            <div style={{ fontSize: 12, color: "#0a6e5c" }}>Paso {step + 1}/{agenda.length} · {current.minutes} min</div>
            <h2>{current.title}</h2>
            <p style={{ fontSize: 18, lineHeight: 1.5 }}>{current.instructions}</p>
            {step < agenda.length - 1 ? (
              <button onClick={() => setStep(step + 1)} style={{ padding: 14, width: "100%", marginTop: 12 }}>Siguiente →</button>
            ) : (
              <button onClick={finish} style={{ padding: 14, width: "100%", marginTop: 12, background: "#58CC02", color: "#fff", border: 0, borderRadius: 12 }}>
                Terminar clase (+100)
              </button>
            )}
          </section>
        ) : <p>…</p>}
      </main>
      <BottomNav />
    </div>
  );
}
```

- [ ] **Step 4: Run — expect PASS**. Run: `npm --prefix client test`

- [ ] **Step 5: Full test sweep + build**

Run: `npm test && npm run build`
Expected: all server + client tests pass; production build succeeds.

- [ ] **Step 6: Commit**

```bash
git add client/src/screens/School.tsx
git commit -m "feat(client): in-person school session facilitator with timed agenda"
```

### Task 1.12: Deploy Phase 1 & manual end-to-end check

- [ ] **Step 1: Deploy**

Run: `npm run deploy`
Expected: build + migrate + seed on VPS, service restarts.

- [ ] **Step 2: Manual E2E on a phone (or browser)**

1. Open `https://spanish.alpbot.ch`, log in as Jugador 1 (PIN 1111).
2. Home shows Medellín as current stop + leaderboard.
3. 📚 Tarea → answer all 5 exercises → see "+points"; leaderboard total rises.
4. Re-answer a correct one → no extra points (idempotent).
5. 🧭 Ruta → Medellín current, other stops locked.
6. 🏫 Clase → step through agenda → "Terminar clase" → +100.
7. Log in as Jugador 2 on another device → independent progress & points.

- [ ] **Step 3: Tag the MVP**

```bash
git tag -a v0.1-medellin-mvp -m "Playable Medellín MVP"
git push --tags 2>/dev/null || echo "no remote configured yet — tag is local"
```

**✅ Phase 1 exit check:** real lessons completable, points & leaderboard working, school facilitator awards participation, all behind the installable PWA.

---

# PHASE 2 — El Reto (live buzzer quiz)

The only real-time feature. A single in-memory game room (the three players), server-authoritative timing and scoring, delivered over a WebSocket. Full TDD steps are expanded when this phase begins; the design below is fixed.

**Architecture:**
- **Transport:** `@fastify/websocket` at `GET /api/live/ws`. The socket authenticates from the same JWT cookie as REST (reuse `app.jwt.verify` on the upgrade request); reject unauthenticated upgrades.
- **Room state (in memory, one room):** `{ status: "lobby"|"question"|"reveal"|"ended", hostUserId, regionId, questions: QuizQ[], index, questionStartedAt: number, timeLimitMs: 15000, answers: Map<userId,{choiceIndex,ms}>, totals: Map<userId,points>, players: Map<userId,{name,avatar,connected}> }`. Nothing persisted except the resulting point rows.
- **Questions:** built from the current region's `multiple_choice` exercises — `{ questionId, prompt, options: string[], correctIndex }`. `correctIndex` never leaves the server until reveal.

**WebSocket protocol:**
- client→server: `{t:"join"}` · `{t:"answer", index}` (index into options) · host-only `{t:"host:create", regionId}` · `{t:"host:start"}` · `{t:"host:next"}`
- server→client (broadcast unless noted): `{t:"lobby", hostUserId, players:[{userId,name,avatar}]}` · `{t:"question", index, total, questionId, prompt, options, timeLimitMs}` · `{t:"answered", userId}` (who answered, never the choice) · `{t:"reveal", correctIndex, round:[{userId,points,ms,correct}], totals:[{userId,name,avatar,points}]}` · `{t:"end", podium:[{userId,name,avatar,points}]}` · `{t:"error", message}`

**Speed-weighted scoring (pure function, unit-tested):**
`score(correct, ms, timeLimitMs) = correct ? 100 + Math.round(100 * Math.max(0, 1 - ms / timeLimitMs)) : 0`. Reveal awards each player their round score.

**Season integration & idempotency:** award with source type `"live"` and a synthetic `sourceId = gameStartedAtSec * 100 + questionIndex` (so replays in a later game earn again, while re-processing the same round stays idempotent via the existing ledger unique index).

**Tasks:**
- **Task 2.1 — `live` ledger source + scoring formula.** Add `"live"` to the `pointsLedger.sourceType` enum (migration); add `liveScore()` pure function + `awardLive()` to `scoring/service.ts`. TDD the formula (correct-fast > correct-slow > wrong=0; clamps at ms≥limit).
- **Task 2.2 — `LiveRoom` state machine** (`server/src/live/room.ts`): create/join/start/answer/next/reveal/end as pure methods over the in-memory state, emitting event objects. Unit-test the full flow (two players answer at different ms → faster correct gets more; totals accumulate; wrong gets 0) with no sockets involved.
- **Task 2.3 — WebSocket endpoint** (`server/src/live/routes.ts`): register `@fastify/websocket`, authenticate the upgrade via cookie JWT, map inbound messages to `LiveRoom`, broadcast outbound to all connected sockets. Integration test with a ws client: two clients join, host starts, both answer, both receive `reveal` with correct totals.
- **Task 2.4 — Client live hook** (`client/src/live/useLiveGame.ts`): typed WebSocket wrapper (connect, send actions, expose latest server event + derived state). 
- **Task 2.5 — Host view** (`client/src/screens/ArenaHost.tsx`, route `/arena/host`): lobby with joined players → big-screen question (colour/shape answers + countdown + "answered" ticks) → reveal scoreboard → `Next` → podium. This is the TV view.
- **Task 2.6 — Player view** (`client/src/screens/Arena.tsx`, route `/arena`): lobby ("waiting for host") → four big buzzer buttons → per-round feedback ("¡Correcto! +180 ⚡" / "Oof") → final placement.
- **Task 2.7 — Entry points + deploy + E2E.** School screen gains "🔥 Jugar El Reto" (host → `/arena/host`); a prompt/nav sends players to `/arena`. Deploy; manual 3-device E2E: laptop hosts (cast to TV), 3 phones join, play a full deck, confirm podium and that season leaderboard rose by the round totals.

# PHASE 3 — Engagement (outline)

Build on the same patterns. Each becomes its own detailed plan before execution.

- **Daily side quests:** `side_quests` table (date, type, payload, points) + `GET /api/quests/today` + `POST /api/quests/:id/complete` (award `sourcetype:'sidequest'`). Home "🎯 Misión de hoy" card. Generator seeds one quest/day (word-of-the-day, 5-min vocab blast).
- **Streaks:** `streaks` table (current, longest, last_active_date); update on any point-earning action; apply a bonus multiplier in `award()` (e.g. +5% @3d, +10% @7d, capped). Surface 🔥 count in the header.
- **Badges:** `badges` + `user_badges`; evaluate rules after each award (First Perfect Week, 7-Day Streak, 100 Words, Region Cleared, Beat-a-Friend). Badge shelf screen.
- **Pablito (AI partner):** `server/src/ai/pablito.ts` proxying the Hermes endpoint (`AI_BASE_URL`/`AI_API_KEY`/`AI_MODEL` from `.env`), scoped to the current region's vocab; roleplay side quests graded for completion → bonus points; free-chat screen (🦜 Charlar). Graceful fallback when AI is down.

# PHASE 4 — Full journey (outline)

- **Content for Stops ②–⑥:** reuse the `medellin.ts` seed shape per region (Cartagena, Barranquilla, Santa Marta, Sierra Nevada, Medellín finale), each with vocab, a dialogue, a homework set, and a school agenda. Consider moving seed content to JSON files loaded by a generic seeder.
- **Map progression polish:** real Colombia map art/route visual on the Ruta screen; unlock animations.
- **Rewards/stakes UI:** editable `settings.stakeText`; champion banner after the season end date.
- **Visual polish:** replace inline styles with a small design-token stylesheet; mascot illustrations; sounds; haptics on correct answers.
- **Admin niceties:** change-PIN screen; rename profiles to the friends' real names.

---

## Self-Review (performed against the spec)

- **Spec §2 Hybrid content:** backbone covered (Tasks 1.1–1.3); AI parts explicitly deferred to Phase 2 (matches spec's phased roadmap). ✓
- **Spec §3 loops:** School facilitator (1.5, 1.11), weekly homework (1.2–1.4, 1.8), side quests (Phase 3 — matches roadmap). ✓
- **Spec §4 scoring:** server-side grading + idempotent ledger + leaderboard (1.4); 100-pt school participation (1.5); streak multiplier deferred to Phase 3 (spec lists it under Engagement). ✓
- **Spec §5 Pablito:** Phase 3 (named, env wired in `.env.example`/service). ✓
- **Spec §5b El Reto:** Phase 2 (live buzzer quiz; WS protocol + speed scoring fixed in the Phase 2 design block above). ✓
- **Spec §6 curriculum:** Medellín seeded as Stop ①; Stops ②–⑥ seeded as locked placeholders so the Ruta map shows the full itinerary (1.2); full content in Phase 3. ✓
- **Spec §7 architecture:** Vite+React PWA (0.6), Fastify (0.2), SQLite+Drizzle (0.3), PIN auth (0.4–0.5, 0.7), Caddy at spanish.alpbot.ch + systemd (0.9). ✓
- **Spec §7 data model:** all Phase-0/1 tables present (users, settings, regions, lessons, exercises, vocab, progress, points_ledger, school_sessions, session_attendance); streaks/badges/ai_chats are Phase 2 tables. ✓
- **Placeholder scan:** no "TBD"/"handle edge cases"/"similar to" — each code step has real code. Deploy Step 4 requires confirming the Caddyfile mount path (explicit command given) — a genuine environment lookup, not a placeholder. ✓
- **Type consistency:** DTOs in `shared/types.ts` match server returns (`RegionDTO.status`, `ExerciseDTO` without `answer`, `AttemptResult {correct,awarded,correctAnswer}`, `LeaderboardRow`, `SchoolSessionDTO.agenda`); `award(userId, sourceType, sourceId, points)` signature used identically in scoring and school routes. ✓
