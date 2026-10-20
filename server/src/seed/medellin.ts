import { eq } from "drizzle-orm";
import { pathToFileURL } from "node:url";
import { db, schema } from "../db/client.js";
import type { AgendaStep } from "../db/schema.js";

/** Idempotent seed of the Medellín (Stop ①) content + locked placeholder stops. */
export function seedMedellin() {
  const existing = db.select().from(schema.regions).where(eq(schema.regions.slug, "medellin")).get();
  if (existing) { console.log("medellin already seeded"); return; }

  db.transaction((tx) => {
    const region = tx.insert(schema.regions)
      .values({ order: 1, slug: "medellin", name: "Medellín", theme: "Saludos & lo básico" })
      .returning().get();

    // Lock the remaining stops as placeholders so the map shows the journey.
    const laterStops = [
      { order: 2, slug: "cartagena", name: "Cartagena", theme: "La comida & el mercado" },
      { order: 3, slug: "barranquilla", name: "Barranquilla", theme: "¡Fiesta y gente!" },
      { order: 4, slug: "santa-marta", name: "Santa Marta", theme: "Moverse & la playa" },
      { order: 5, slug: "sierra-nevada", name: "Sierra Nevada", theme: "Naturaleza & aventura" },
      { order: 6, slug: "medellin-finale", name: "Medellín (vuelta)", theme: "De vuelta · repaso" },
    ];
    for (const s of laterStops) tx.insert(schema.regions).values(s).run();

    const vocabWords = [
      { es: "Hola", en: "Hello", example: "¡Hola, parcero!" },
      { es: "Buenas", en: "Hi / good day (casual)", example: "¡Buenas! ¿Cómo está?" },
      { es: "Gracias", en: "Thank you", example: "Muchas gracias." },
      { es: "Por favor", en: "Please", example: "Un tinto, por favor." },
      { es: "Me llamo…", en: "My name is…", example: "Me llamo Ana." },
      { es: "Mucho gusto", en: "Nice to meet you", example: "Mucho gusto, soy Juan." },
      { es: "Un tinto", en: "A black coffee (Colombian)", example: "¿Me regala un tinto?" },
      { es: "¿Cómo está?", en: "How are you?", example: "Hola, ¿cómo está?" },
    ];
    for (const v of vocabWords) tx.insert(schema.vocab).values({ regionId: region.id, ...v }).run();

    // Dialogue lesson
    tx.insert(schema.lessons).values({
      regionId: region.id, order: 1, kind: "dialogue", title: "Llegada a Medellín",
      bodyJson: {
        lines: [
          { who: "Taxista", es: "¡Buenas! ¿Para dónde va?", en: "Hi! Where are you headed?" },
          { who: "Tú", es: "Buenas, al centro por favor.", en: "Hi, downtown please." },
          { who: "Taxista", es: "Con mucho gusto, parcero.", en: "With pleasure, buddy." },
        ],
      },
    }).run();

    // Homework lesson + exercises
    const hw = tx.insert(schema.lessons).values({
      regionId: region.id, order: 2, kind: "homework", title: "Tarea: Saludos", bodyJson: null,
    }).returning().get();

    const exercises = [
      { type: "multiple_choice" as const, prompt: "How do you say 'Thank you'?", answer: "Gracias",
        optionsJson: ["Hola", "Gracias", "Adiós", "Por favor"], points: 10 },
      { type: "multiple_choice" as const, prompt: "'Un tinto' is…", answer: "A black coffee",
        optionsJson: ["A red wine", "A black coffee", "A tea", "A beer"], points: 10 },
      { type: "fill_blank" as const, prompt: "Complete: Me ____ Ana. (my name is)", answer: "llamo",
        optionsJson: null, points: 15 },
      { type: "fill_blank" as const, prompt: "Polite 'please' in Spanish: por ____", answer: "favor",
        optionsJson: null, points: 10 },
      { type: "multiple_choice" as const, prompt: "Someone says '¿Cómo está?'. They ask…", answer: "How are you?",
        optionsJson: ["Your name?", "How are you?", "Where are you?", "How old?"], points: 15 },
    ];
    exercises.forEach((e, i) =>
      tx.insert(schema.exercises).values({ lessonId: hw.id, order: i + 1, ...e }).run());

    // School session agenda
    const agenda: AgendaStep[] = [
      { minutes: 10, title: "Calentamiento", instructions: "Review the 8 Medellín vocab words out loud, taking turns." },
      { minutes: 15, title: "Diálogo", instructions: "Read 'Llegada a Medellín' together — each person plays a role." },
      { minutes: 20, title: "Juego de vocabulario", instructions: "One person says the English, the others race to say the Spanish." },
      { minutes: 15, title: "Hablar", instructions: "Pair up and introduce yourselves in Spanish: greet, name, 'mucho gusto'." },
    ];
    tx.insert(schema.schoolSessions).values({ regionId: region.id, agendaJson: agenda }).run();
  });

  console.log("seeded Medellín content (vocab, dialogue, homework, school session)");
}

// Run only when invoked directly (e.g. `tsx src/seed/medellin.ts`), not on import.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seedMedellin();
}
