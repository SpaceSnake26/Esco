import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { FastifyInstance } from "fastify";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { z } from "zod";
import { env } from "../env.js";

const VOICES = { female: "es-CO-SalomeNeural", male: "es-CO-GonzaloNeural" } as const;
const query = z.object({ voice: z.enum(["female", "male"]), text: z.string().min(1).max(300) });

async function synthesize(voice: string, text: string): Promise<Buffer> {
  const tts = new MsEdgeTTS();
  try {
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(text, { rate: "-10%" }); // a bit slow, to repeat after
    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks);
  } finally {
    tts.close();
  }
}

/** Neural Spanish audio, cached on disk per (voice, text) so each phrase is fetched only once. */
export async function ttsRoutes(app: FastifyInstance) {
  const auth = (req: any, reply: any) => app.requireAuth(req, reply);
  const dir = join(dirname(resolve(env.DB_PATH)), "tts");

  app.get("/api/tts", { preHandler: auth }, async (req, reply) => {
    const parsed = query.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: "bad request" });
    const { voice, text } = parsed.data;
    const name = createHash("sha256").update(`${VOICES[voice]}|${text}`).digest("hex");
    const file = join(dir, `${name}.mp3`);
    let audio: Buffer;
    if (existsSync(file)) {
      audio = readFileSync(file);
    } else {
      try {
        audio = await Promise.race([
          synthesize(VOICES[voice], text),
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 15_000)),
        ]);
        if (audio.length === 0) throw new Error("empty audio");
        mkdirSync(dir, { recursive: true });
        writeFileSync(`${file}.tmp`, audio);
        renameSync(`${file}.tmp`, file);
      } catch (e) {
        console.warn(`tts failed: ${(e as Error).message}`);
        return reply.code(502).send({ error: "tts unavailable" }); // client falls back to the device voice
      }
    }
    return reply.header("content-type", "audio/mpeg").header("cache-control", "private, max-age=604800").send(audio);
  });
}
