import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { evaluateBadges } from "../badges/service.js";
import { getStreak, gradeAttempt, leaderboard } from "./service.js";

const attemptBody = z.object({ exerciseId: z.number().int(), answer: z.string().min(1) });

export async function scoringRoutes(app: FastifyInstance) {
  const auth = (req: any, reply: any) => app.requireAuth(req, reply);

  app.post("/api/attempts", { preHandler: auth }, async (req, reply) => {
    const parsed = attemptBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "bad request" });
    const result = gradeAttempt(req.user.id, parsed.data.exerciseId, parsed.data.answer);
    if (!result) return reply.code(404).send({ error: "exercise not found" });
    const newBadges = evaluateBadges(req.user.id);
    return { ...result, newBadges };
  });

  app.get("/api/leaderboard", { preHandler: auth }, async () => leaderboard());

  app.get("/api/streak", { preHandler: auth }, async (req) => getStreak(req.user.id));
}
