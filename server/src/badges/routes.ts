import type { FastifyInstance } from "fastify";
import { listBadges } from "./service.js";

export async function badgesRoutes(app: FastifyInstance) {
  const auth = (req: any, reply: any) => app.requireAuth(req, reply);

  app.get("/api/badges", { preHandler: auth }, async (req) => listBadges(req.user.id));
}
