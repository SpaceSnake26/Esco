import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyInstance } from "fastify";
import { fileURLToPath } from "node:url";
import { aiRoutes } from "./ai/routes.js";
import { registerAuth } from "./auth/plugin.js";
import { authRoutes } from "./auth/routes.js";
import { badgesRoutes } from "./badges/routes.js";
import { contentRoutes } from "./content/routes.js";
import { liveRoutes } from "./live/routes.js";
import { questsRoutes } from "./quests/routes.js";
import { schoolRoutes } from "./school/routes.js";
import { ttsRoutes } from "./tts/routes.js";
import { scoringRoutes } from "./scoring/routes.js";

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: false });
  app.get("/api/health", async () => ({ status: "ok" }));
  app.register(async (instance) => {
    await registerAuth(instance);
    await instance.register(authRoutes);
    await instance.register(contentRoutes);
    await instance.register(scoringRoutes);
    await instance.register(schoolRoutes);
    await instance.register(liveRoutes);
    await instance.register(badgesRoutes);
    await instance.register(questsRoutes);
    await instance.register(aiRoutes);
    await instance.register(ttsRoutes);
  });

  if (process.env.NODE_ENV === "production") {
    const root = fileURLToPath(new URL("../../client/dist", import.meta.url));
    app.register(fastifyStatic, { root });
    app.setNotFoundHandler((req, reply) => {
      if (req.raw.url?.startsWith("/api")) return reply.code(404).send({ error: "not found" });
      return reply.sendFile("index.html"); // SPA fallback
    });
  }

  return app;
}
