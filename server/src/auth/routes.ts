import type { PublicUser } from "@shared/types.js";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db, schema } from "../db/client.js";
import { env } from "../env.js";

const loginBody = z.object({ userId: z.number().int(), pin: z.string().min(3) });
const SEASON_MAX_AGE = 60 * 60 * 24 * 120; // 120 days — whole season

export async function authRoutes(app: FastifyInstance) {
  app.post("/api/auth/login", async (req, reply): Promise<PublicUser | undefined> => {
    const parsed = loginBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "bad request" });

    const user = db.select().from(schema.users).where(eq(schema.users.id, parsed.data.userId)).get();
    if (!user || !bcrypt.compareSync(parsed.data.pin, user.pinHash)) {
      return reply.code(401).send({ error: "invalid credentials" });
    }
    const token = app.jwt.sign({ id: user.id }, { expiresIn: "120d" });
    reply.setCookie("token", token, {
      httpOnly: true, sameSite: "lax", path: "/",
      secure: env.NODE_ENV === "production",
      maxAge: SEASON_MAX_AGE,
    });
    return { id: user.id, name: user.name, avatar: user.avatar };
  });

  app.post("/api/auth/logout", async (_req, reply) => {
    reply.clearCookie("token", { path: "/" });
    return { ok: true };
  });

  app.get("/api/me", { preHandler: (req, reply) => app.requireAuth(req, reply) },
    async (req, reply): Promise<PublicUser | undefined> => {
      const user = db.select().from(schema.users).where(eq(schema.users.id, req.user.id)).get();
      if (!user) return reply.code(401).send({ error: "unknown user" });
      return { id: user.id, name: user.name, avatar: user.avatar };
    });

  // Public: list profiles for the login picker (no PINs exposed)
  app.get("/api/profiles", async (): Promise<PublicUser[]> => {
    return db.select({ id: schema.users.id, name: schema.users.name, avatar: schema.users.avatar })
      .from(schema.users).all();
  });
}
