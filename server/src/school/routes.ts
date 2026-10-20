import { asc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db, schema } from "../db/client.js";
import { award, regionStatuses } from "../scoring/service.js";

const completeBody = z.object({ presentUserIds: z.array(z.number().int()).min(1) });
const sessionIdParam = z.coerce.number().int().positive();

export async function schoolRoutes(app: FastifyInstance) {
  const auth = (req: any, reply: any) => app.requireAuth(req, reply);

  // Current = the sessions (week 1, week 2, …) for the player's current stop.
  app.get("/api/school/current", { preHandler: auth }, async (req, reply) => {
    const statuses = regionStatuses(req.user.id);
    const current = statuses.find((r) => r.status === "current") ?? statuses[0];
    if (!current) return reply.code(404).send({ error: "no region" });
    const sessions = db.select().from(schema.schoolSessions)
      .where(eq(schema.schoolSessions.regionId, current.id))
      .orderBy(asc(schema.schoolSessions.order)).all();
    if (sessions.length === 0) return reply.code(404).send({ error: "no session" });
    return {
      regionName: current.name,
      sessions: sessions.map((s) => ({ id: s.id, order: s.order, agenda: s.agendaJson })),
    };
  });

  app.post<{ Params: { id: string } }>("/api/school/:id/complete", { preHandler: auth }, async (req, reply) => {
    const idParsed = sessionIdParam.safeParse(req.params.id);
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
