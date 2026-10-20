import { env } from "../env.js";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

interface PablitoOpts {
  vocab: { es: string; en: string }[];
  scenario?: string;
}

type Logger = { warn: (msg: string) => void };

interface Provider { label: string; baseUrl: string; apiKey: string; model: string; }

/** Configured providers in priority order (primary, then optional fallback). */
function providers(): Provider[] {
  const list: Provider[] = [];
  if (env.AI_BASE_URL && env.AI_API_KEY) {
    list.push({ label: "primary", baseUrl: env.AI_BASE_URL, apiKey: env.AI_API_KEY, model: env.AI_MODEL });
  }
  if (env.AI_FALLBACK_BASE_URL && env.AI_FALLBACK_API_KEY) {
    list.push({ label: "fallback", baseUrl: env.AI_FALLBACK_BASE_URL, apiKey: env.AI_FALLBACK_API_KEY, model: env.AI_FALLBACK_MODEL || env.AI_MODEL });
  }
  return list;
}

/** The server OWNS this persona. It is never overridable by client-supplied turns. */
function buildSystemPrompt(opts: PablitoOpts): string {
  const lines = [
    "Eres Pablito, un lorito colombiano, tutor de español para principiantes. " +
      "Responde SIEMPRE en español simple y corto, con calidez. No muestres tu razonamiento.",
  ];
  if (opts.vocab.length > 0) {
    lines.push(
      "Vocabulario que el alumno está aprendiendo: " +
        opts.vocab.map((v) => `${v.es} (${v.en})`).join(", ") + ".",
    );
  }
  if (opts.scenario) {
    lines.push(`Juego de rol: ${opts.scenario}. Mantente en el personaje.`);
  }
  return lines.join("\n");
}

/** One warm, in-character line so the chat never dead-ends when the AI is down. */
export function practiceReply(opts: PablitoOpts, turns: ChatTurn[]): string {
  const lines = [
    "¡Hola, parcero! 🦜 Estoy sin conexión ahora, pero sigamos practicando. ¿Qué quieres decir en español?",
    "¡Muy bien! Repite la frase en español, despacio. ¡Tú puedes!",
    "¡Perfecto, parce! Dime otra cosa en español. 🦜",
    "¡Buen intento! ¿Cómo lo dirías de otra forma en español?",
    "¡Eso es! Sigue hablando en español, lo estás haciendo bien.",
  ];
  const userTurns = turns.filter((t) => t.role === "user").length;
  if (opts.scenario && userTurns <= 1) {
    return `¡Dale, practiquemos "${opts.scenario}"! 🦜 (Estoy sin conexión, pero sigue en español.)`;
  }
  return lines[userTurns % lines.length];
}

/**
 * Chat with Pablito via the configured OpenAI-compatible providers, in order.
 * Returns the first good reply. If every provider fails it returns
 * `{ error: true, reason }` (reason logged) so the caller can degrade gracefully.
 */
export async function pablitoChat(
  turns: ChatTurn[],
  opts: PablitoOpts,
  log?: Logger,
): Promise<{ reply: string } | { error: true; reason: string }> {
  const ps = providers();
  if (ps.length === 0) return { error: true, reason: "no AI provider configured" };

  const messages = [
    { role: "system", content: buildSystemPrompt(opts) },
    ...turns.map((t) => ({ role: t.role, content: t.content })),
  ];

  let lastReason = "unknown";
  for (const p of ps) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 40_000);
    try {
      const res = await fetch(`${p.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${p.apiKey}` },
        body: JSON.stringify({ model: p.model, max_tokens: 1500, messages }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = (await res.text().catch(() => "")).slice(0, 300);
        lastReason = `${p.label} ${p.model}: HTTP ${res.status} ${body}`;
        log?.warn(`pablito provider ${lastReason}`);
        continue; // try the next provider
      }
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const content = data.choices?.[0]?.message?.content; // IGNORE reasoning_content
      if (!content || !content.trim()) {
        lastReason = `${p.label} ${p.model}: empty content`;
        log?.warn(`pablito provider ${lastReason}`);
        continue;
      }
      return { reply: content.trim() };
    } catch (e) {
      lastReason = `${p.label} ${p.model}: ${(e as Error).name === "AbortError" ? "timeout" : (e as Error).message}`;
      log?.warn(`pablito provider ${lastReason}`);
    } finally {
      clearTimeout(timeout);
    }
  }
  return { error: true, reason: lastReason };
}
