import { asc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db, schema } from "../db/client.js";
import { regionStatuses } from "../scoring/service.js";

export async function contentRoutes(app: FastifyInstance) {
  const auth = (req: any, reply: any) => app.requireAuth(req, reply);

  app.get("/api/regions", { preHandler: auth }, async (req) => regionStatuses(req.user.id));

  // Vocab for a region — used by the "Listen & repeat" pronunciation screen.
  app.get<{ Params: { id: string } }>("/api/regions/:id/vocab", { preHandler: auth }, async (req) => {
    const regionId = Number(req.params.id);
    return db.select({ es: schema.vocab.es, en: schema.vocab.en, example: schema.vocab.example })
      .from(schema.vocab).where(eq(schema.vocab.regionId, regionId)).all();
  });

  app.get<{ Params: { id: string } }>("/api/regions/:id", { preHandler: auth }, async (req) => {
    const regionId = Number(req.params.id);
    const lessons = db.select().from(schema.lessons)
      .where(eq(schema.lessons.regionId, regionId)).orderBy(asc(schema.lessons.order)).all();

    const done = db.select().from(schema.progress).where(eq(schema.progress.userId, req.user.id)).all();
    const doneMap = new Map(done.map((d) => [d.exerciseId, d.correct]));

    return {
      lessons: lessons.map((l) => ({
        id: l.id, kind: l.kind, title: l.title, body: l.bodyJson,
        exercises: db.select().from(schema.exercises)
          .where(eq(schema.exercises.lessonId, l.id)).orderBy(asc(schema.exercises.order)).all()
          .map((e) => ({
            id: e.id, type: e.type, prompt: e.prompt, options: e.optionsJson,
            points: e.points, done: doneMap.has(e.id), gotCorrect: doneMap.get(e.id) ?? false,
            // NOTE: answer intentionally omitted
          })),
      })),
    };
  });
}
