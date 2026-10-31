import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { env } from "../env.js";
import { userRegionVocab } from "../quests/service.js";
import { todayUTC } from "../scoring/service.js";
import { type ChatTurn, pablitoChat, practiceReply } from "./pablito.js";
import { aiUsageToday, bumpAiUsage } from "./usage.js";

const MAX_TURNS = 12;

const chatBody = z.object({
  // Bound input size (cost/abuse) — reasoning model, auth-gated to the players.
  messages: z.array(z.object({ role: z.string(), content: z.string().max(2000) })).max(50).default([]),
  scenario: z.string().max(400).optional(),
});

export async function aiRoutes(app: FastifyInstance) {
  const auth = (req: any, reply: any) => app.requireAuth(req, reply);

  app.post("/api/pablito/chat", { preHandler: auth }, async (req, reply) => {
    const parsed = chatBody.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: "bad request" });

    // SECURITY: the server owns the system prompt. Drop any client-supplied
    // non user/assistant turns (e.g. an injected `system` message) and cap length.
    const turns: ChatTurn[] = parsed.data.messages
      .filter((m): m is ChatTurn => m.role === "user" || m.role === "assistant")
      .slice(-MAX_TURNS);

    const vocab = userRegionVocab(req.user.id);
    const opts = { vocab, scenario: parsed.data.scenario };

    // Daily cost cap: once the day's paid calls hit AI_DAILY_CAP, stop calling the
    // paid API and serve practice mode. Protects the account balance from draining.
    const day = todayUTC();
    if (aiUsageToday(day) >= env.AI_DAILY_CAP) {
      return { reply: practiceReply(opts, turns), degraded: true };
    }

    const result = await pablitoChat(turns, opts, { warn: (m) => console.warn(m) });

    // Always answer (HTTP 200). If the AI is unavailable, log WHY and fall back
    // to a friendly in-character practice line so the chat never dead-ends.
    if ("error" in result) {
      console.warn(`pablito unavailable → practice mode: ${result.reason}`);
      return { reply: practiceReply(opts, turns), degraded: true };
    }
    bumpAiUsage(day); // count only successful (paid) calls
    return { reply: result.reply };
  });
}
