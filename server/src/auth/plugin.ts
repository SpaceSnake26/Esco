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
