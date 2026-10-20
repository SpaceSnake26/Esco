import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(8787),
  JWT_SECRET: z.string().min(8).default("dev-secret-change-me"),
  DB_PATH: z.string().default("./data/spanish.db"),
  AI_BASE_URL: z.string().default(""),
  AI_API_KEY: z.string().default(""),
  AI_MODEL: z.string().default("kimi-k2.6"),
  // Optional second provider: if the primary fails (e.g. out of credit), Pablito
  // automatically tries this one. Any OpenAI-compatible endpoint works.
  AI_FALLBACK_BASE_URL: z.string().default(""),
  AI_FALLBACK_API_KEY: z.string().default(""),
  AI_FALLBACK_MODEL: z.string().default(""),
  // Max paid Pablito calls per UTC calendar day (cost cap). Beyond it → practice mode.
  AI_DAILY_CAP: z.coerce.number().int().positive().default(40),
});

export const env = schema.parse(process.env);
