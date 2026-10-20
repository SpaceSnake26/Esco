import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { evaluateBadges } from "../badges/service.js";
import { completeQuest, getTodayQuests } from "./service.js";

const completeBody = z.object({ answers: z.array(z.number().int()).optional() });
const questIdParam = z.coerce.number().int().positive();

export async function questsRoutes(app: FastifyInstance) {
  const auth = (req: any, reply: any) => app.requireAuth(req, reply);

  app.get("/api/quests/today", { preHandler: auth }, async (req) => getTodayQuests(req.user.id));

  app.post<{ Params: { id: string } }>("/api/quests/:id/complete", { preHandler: auth }, async (req, reply) => {
    const idParsed = questIdParam.safeParse(req.params.id);
    if (!idParsed.success) return reply.code(400).send({ error: "bad quest id" });
    const parsed = completeBody.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: "bad request" });

    const result = completeQuest(req.user.id, idParsed.data, parsed.data.answers);
    if (!result) return reply.code(404).send({ error: "quest not found" });

    const newBadges = evaluateBadges(req.user.id);
    return { ...result, newBadges };
  });
}
