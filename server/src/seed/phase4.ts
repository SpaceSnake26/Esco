import { eq } from "drizzle-orm";
import { pathToFileURL } from "node:url";
import { db, schema } from "../db/client.js";
import type { AgendaStep } from "../db/schema.js";

/** One region's full content payload. */
interface RegionContent {
  slug: string;
  vocab: { es: string; en: string; example: string }[];
  dialogue: { title: string; lines: { who: string; es: string; en: string }[] };
  homework: {
    title: string;
    exercises: {
      type: "multiple_choice" | "fill_blank";
      prompt: string;
      answer: string;
      optionsJson: string[] | null;
      points: number;
    }[];
  };
  agenda: AgendaStep[];
}

const CONTENT: RegionContent[] = [
  // ─────────────────────────── Stop ② Cartagena · food & market ───────────────
  {
    slug: "cartagena",
    vocab: [
      { es: "La comida", en: "The food", example: "La comida aquí es deliciosa." },
      { es: "¿Cuánto cuesta?", en: "How much is it?", example: "¿Cuánto cuesta el mango?" },
      { es: "El mercado", en: "The market", example: "Vamos al mercado de Bazurto." },
      { es: "Una arepa", en: "An arepa (corn cake)", example: "Quiero una arepa con queso." },
      { es: "El jugo", en: "The juice", example: "Un jugo de lulo, por favor." },
      { es: "La cuenta", en: "The bill / check", example: "La cuenta, por favor." },
      { es: "Rico / Rica", en: "Tasty / delicious", example: "¡Qué rico este ceviche!" },
      { es: "¿Me regala…?", en: "Could I have…? (polite, Colombian)", example: "¿Me regala un jugo?" },
    ],
    dialogue: {
      title: "En el mercado de Cartagena",
      lines: [
        { who: "Vendedora", es: "¡Buenas! ¿Qué le provoca, mi amor?", en: "Hi! What would you like, dear?" },
        { who: "Tú", es: "Buenas. ¿Cuánto cuesta el jugo de mango?", en: "Hi. How much is the mango juice?" },
        { who: "Vendedora", es: "Tres mil pesos, fresquito.", en: "Three thousand pesos, nice and fresh." },
        { who: "Tú", es: "¿Me regala uno, por favor?", en: "Could I have one, please?" },
      ],
    },
    homework: {
      title: "Tarea: La comida & el mercado",
      exercises: [
        { type: "multiple_choice", prompt: "How do you ask 'How much is it?'", answer: "¿Cuánto cuesta?",
          optionsJson: ["¿Cómo está?", "¿Cuánto cuesta?", "¿Dónde está?", "¿Qué hora es?"], points: 10 },
        { type: "multiple_choice", prompt: "'Rico' describing food means…", answer: "Tasty",
          optionsJson: ["Expensive", "Cold", "Tasty", "Spicy"], points: 10 },
        { type: "fill_blank", prompt: "Ask politely for the bill: La ____, por favor.", answer: "cuenta",
          optionsJson: null, points: 15 },
        { type: "fill_blank", prompt: "Colombian way to ask 'Could I have a coffee?': ¿Me ____ un tinto?", answer: "regala",
          optionsJson: null, points: 15 },
        { type: "multiple_choice", prompt: "Where would you buy fresh fruit?", answer: "El mercado",
          optionsJson: ["La cuenta", "El mercado", "La comida", "El jugo"], points: 10 },
      ],
    },
    agenda: [
      { minutes: 10, title: "Calentamiento", instructions: "Review the 8 Cartagena food words out loud, taking turns." },
      { minutes: 15, title: "Diálogo", instructions: "Act out 'En el mercado de Cartagena' — one is the vendor, one is the buyer." },
      { minutes: 20, title: "Juego del mercado", instructions: "Set up a pretend market stall. Haggle: '¿Cuánto cuesta?' / '¿Me regala…?'." },
      { minutes: 15, title: "Hablar", instructions: "Order a full meal in Spanish: greet, ask prices, order, ask for the bill." },
    ],
  },
  // ─────────────────────── Stop ③ Barranquilla · party & people ────────────────
  {
    slug: "barranquilla",
    vocab: [
      { es: "La fiesta", en: "The party", example: "¡Vamos a la fiesta!" },
      { es: "Bailar", en: "To dance", example: "Me encanta bailar salsa." },
      { es: "La música", en: "The music", example: "La música está buenísima." },
      { es: "Los amigos", en: "The friends", example: "Vine con mis amigos." },
      { es: "¡Qué chévere!", en: "How cool! (Colombian)", example: "¡Qué chévere esta fiesta!" },
      { es: "¿Bailamos?", en: "Shall we dance?", example: "¿Bailamos esta canción?" },
      { es: "La cerveza", en: "The beer", example: "Dos cervezas, por favor." },
      { es: "¡Salud!", en: "Cheers!", example: "¡Salud, parceros!" },
    ],
    dialogue: {
      title: "En el Carnaval",
      lines: [
        { who: "Amigo", es: "¡Qué chévere el Carnaval! ¿Bailamos?", en: "The Carnival is so cool! Shall we dance?" },
        { who: "Tú", es: "¡Claro! Me encanta esta música.", en: "Of course! I love this music." },
        { who: "Amigo", es: "¡Eres muy buen bailarín!", en: "You're a really good dancer!" },
        { who: "Tú", es: "¡Gracias! ¡Salud!", en: "Thanks! Cheers!" },
      ],
    },
    homework: {
      title: "Tarea: ¡Fiesta y gente!",
      exercises: [
        { type: "multiple_choice", prompt: "'Bailar' means…", answer: "To dance",
          optionsJson: ["To sing", "To eat", "To dance", "To drink"], points: 10 },
        { type: "multiple_choice", prompt: "You raise your glass and say…", answer: "¡Salud!",
          optionsJson: ["¡Chévere!", "¡Salud!", "¡Hola!", "¡Gracias!"], points: 10 },
        { type: "fill_blank", prompt: "Invite someone to dance: ¿____?", answer: "Bailamos",
          optionsJson: null, points: 15 },
        { type: "fill_blank", prompt: "Colombian slang for 'How cool!': ¡Qué ____!", answer: "chévere",
          optionsJson: null, points: 15 },
        { type: "multiple_choice", prompt: "Who do you go to a party with?", answer: "Los amigos",
          optionsJson: ["La cuenta", "La música", "Los amigos", "El mercado"], points: 10 },
      ],
    },
    agenda: [
      { minutes: 10, title: "Calentamiento", instructions: "Review the 8 Barranquilla party words out loud, taking turns." },
      { minutes: 15, title: "Diálogo", instructions: "Act out 'En el Carnaval' — invite each other to dance in Spanish." },
      { minutes: 20, title: "Juego de la fiesta", instructions: "Put on a song. Each person must say one Spanish phrase before the chorus hits." },
      { minutes: 15, title: "Hablar", instructions: "Make small talk at a party: greet, compliment, offer a drink, say cheers." },
    ],
  },
  // ─────────────────────── Stop ④ Santa Marta · getting around & beach ─────────
  {
    slug: "santa-marta",
    vocab: [
      { es: "La playa", en: "The beach", example: "Vamos a la playa hoy." },
      { es: "¿Dónde está…?", en: "Where is…?", example: "¿Dónde está el baño?" },
      { es: "Izquierda", en: "Left", example: "Gire a la izquierda." },
      { es: "Derecha", en: "Right", example: "La playa está a la derecha." },
      { es: "El bus", en: "The bus", example: "¿Dónde tomo el bus?" },
      { es: "Cerca / Lejos", en: "Near / Far", example: "¿Está cerca o lejos?" },
      { es: "El mar", en: "The sea", example: "El mar está calmado hoy." },
      { es: "Derecho", en: "Straight ahead", example: "Siga derecho dos cuadras." },
    ],
    dialogue: {
      title: "Camino a la playa",
      lines: [
        { who: "Tú", es: "Disculpe, ¿dónde está la playa?", en: "Excuse me, where is the beach?" },
        { who: "Local", es: "Siga derecho y gire a la derecha.", en: "Go straight and turn right." },
        { who: "Tú", es: "¿Está cerca?", en: "Is it near?" },
        { who: "Local", es: "Sí, muy cerca. Cinco minutos.", en: "Yes, very near. Five minutes." },
      ],
    },
    homework: {
      title: "Tarea: Moverse & la playa",
      exercises: [
        { type: "multiple_choice", prompt: "How do you ask 'Where is…?'", answer: "¿Dónde está…?",
          optionsJson: ["¿Cuánto cuesta…?", "¿Dónde está…?", "¿Cómo está…?", "¿Qué es…?"], points: 10 },
        { type: "multiple_choice", prompt: "'A la izquierda' means…", answer: "To the left",
          optionsJson: ["To the right", "Straight ahead", "To the left", "Near"], points: 10 },
        { type: "fill_blank", prompt: "'Go straight ahead': Siga ____.", answer: "derecho",
          optionsJson: null, points: 15 },
        { type: "fill_blank", prompt: "Opposite of 'lejos' (far) is ____.", answer: "cerca",
          optionsJson: null, points: 15 },
        { type: "multiple_choice", prompt: "You want to swim. Where do you go?", answer: "La playa",
          optionsJson: ["El bus", "La playa", "El mercado", "La fiesta"], points: 10 },
      ],
    },
    agenda: [
      { minutes: 10, title: "Calentamiento", instructions: "Review the 8 Santa Marta direction words out loud, taking turns." },
      { minutes: 15, title: "Diálogo", instructions: "Act out 'Camino a la playa' — one asks for directions, one gives them." },
      { minutes: 20, title: "Juego de direcciones", instructions: "Hide an object. Guide a blindfolded player using only Spanish: izquierda, derecha, derecho." },
      { minutes: 15, title: "Hablar", instructions: "Ask a stranger for directions to three places, each fully in Spanish." },
    ],
  },
  // ─────────────────── Stop ⑤ Sierra Nevada · nature & adventure ───────────────
  {
    slug: "sierra-nevada",
    vocab: [
      { es: "La montaña", en: "The mountain", example: "La montaña es muy alta." },
      { es: "Caminar", en: "To walk / hike", example: "Vamos a caminar por el sendero." },
      { es: "El río", en: "The river", example: "El río está frío." },
      { es: "El guía", en: "The guide", example: "El guía conoce el camino." },
      { es: "¡Cuidado!", en: "Careful! / Watch out!", example: "¡Cuidado con las piedras!" },
      { es: "Cansado / Cansada", en: "Tired", example: "Estoy muy cansado." },
      { es: "El agua", en: "The water", example: "¿Tienes agua?" },
      { es: "La naturaleza", en: "Nature", example: "Me encanta la naturaleza." },
    ],
    dialogue: {
      title: "En el sendero",
      lines: [
        { who: "Guía", es: "¡Cuidado! El camino está resbaloso.", en: "Careful! The trail is slippery." },
        { who: "Tú", es: "Gracias. Estoy un poco cansado.", en: "Thanks. I'm a little tired." },
        { who: "Guía", es: "Tranquilo. ¿Tienes agua?", en: "No worries. Do you have water?" },
        { who: "Tú", es: "Sí, gracias. ¡Qué linda la naturaleza!", en: "Yes, thanks. Nature is so beautiful!" },
      ],
    },
    homework: {
      title: "Tarea: Naturaleza & aventura",
      exercises: [
        { type: "multiple_choice", prompt: "'Caminar' means…", answer: "To walk / hike",
          optionsJson: ["To swim", "To walk / hike", "To climb a car", "To rest"], points: 10 },
        { type: "multiple_choice", prompt: "Someone shouts '¡Cuidado!'. They mean…", answer: "Watch out!",
          optionsJson: ["Let's go!", "Watch out!", "Well done!", "Hello!"], points: 10 },
        { type: "fill_blank", prompt: "'I am tired' (male speaker): Estoy ____.", answer: "cansado",
          optionsJson: null, points: 15 },
        { type: "fill_blank", prompt: "You're thirsty. Ask: ¿Tienes ____?", answer: "agua",
          optionsJson: null, points: 15 },
        { type: "multiple_choice", prompt: "You hike up a very high…", answer: "Montaña",
          optionsJson: ["Playa", "Montaña", "Fiesta", "Mercado"], points: 10 },
      ],
    },
    agenda: [
      { minutes: 10, title: "Calentamiento", instructions: "Review the 8 Sierra Nevada nature words out loud, taking turns." },
      { minutes: 15, title: "Diálogo", instructions: "Act out 'En el sendero' — one is the guide, one is the hiker." },
      { minutes: 20, title: "Juego de la aventura", instructions: "Describe a photo of a Colombian landscape using only Spanish words you know." },
      { minutes: 15, title: "Hablar", instructions: "Plan a hike together in Spanish: what to bring, warnings ('¡cuidado!'), how you feel." },
    ],
  },
  // ─────────────────── Stop ⑥ Medellín (vuelta) · review / finale ──────────────
  {
    slug: "medellin-finale",
    vocab: [
      { es: "De vuelta", en: "Back (returned)", example: "Estamos de vuelta en Medellín." },
      { es: "El viaje", en: "The trip", example: "¡Qué viaje tan increíble!" },
      { es: "Aprendí", en: "I learned", example: "Aprendí mucho español." },
      { es: "Recuerdo", en: "I remember / A memory", example: "Recuerdo la playa de Santa Marta." },
      { es: "¡Lo logramos!", en: "We did it!", example: "¡Lo logramos, parceros!" },
      { es: "El próximo año", en: "Next year", example: "Volvemos el próximo año." },
      { es: "Extrañar", en: "To miss (something)", example: "Voy a extrañar Colombia." },
      { es: "¡Hasta pronto!", en: "See you soon!", example: "¡Hasta pronto, Colombia!" },
    ],
    dialogue: {
      title: "De vuelta en Medellín",
      lines: [
        { who: "Amigo", es: "¡Qué viaje! ¿Qué aprendiste?", en: "What a trip! What did you learn?" },
        { who: "Tú", es: "Aprendí a pedir comida y a dar direcciones.", en: "I learned to order food and give directions." },
        { who: "Amigo", es: "¡Lo logramos! Hablamos español.", en: "We did it! We spoke Spanish." },
        { who: "Tú", es: "Voy a extrañar Colombia. ¡Hasta pronto!", en: "I'm going to miss Colombia. See you soon!" },
      ],
    },
    homework: {
      title: "Tarea: Repaso del viaje",
      exercises: [
        { type: "multiple_choice", prompt: "At the market you ask the price with…", answer: "¿Cuánto cuesta?",
          optionsJson: ["¿Dónde está?", "¿Cuánto cuesta?", "¿Bailamos?", "¿Cómo está?"], points: 10 },
        { type: "multiple_choice", prompt: "To celebrate, you raise a glass and say…", answer: "¡Salud!",
          optionsJson: ["¡Cuidado!", "¡Salud!", "¡Hasta pronto!", "¡Derecho!"], points: 10 },
        { type: "fill_blank", prompt: "Say goodbye warmly: ¡Hasta ____!", answer: "pronto",
          optionsJson: null, points: 15 },
        { type: "fill_blank", prompt: "'We did it!': ¡Lo ____!", answer: "logramos",
          optionsJson: null, points: 15 },
        { type: "multiple_choice", prompt: "Ask for directions to the beach with…", answer: "¿Dónde está la playa?",
          optionsJson: ["¿Cuánto cuesta la playa?", "¿Dónde está la playa?", "¿Bailamos en la playa?", "¿Me regala la playa?"], points: 15 },
      ],
    },
    agenda: [
      { minutes: 10, title: "Calentamiento", instructions: "Each person shares their favourite Spanish word from the whole trip." },
      { minutes: 15, title: "Diálogo", instructions: "Act out 'De vuelta en Medellín' — reflect on what you learned, in Spanish." },
      { minutes: 20, title: "Repaso relámpago", instructions: "Rapid-fire: one person says English from ANY stop, others race to say the Spanish." },
      { minutes: 15, title: "Hablar", instructions: "Hold a 2-minute conversation entirely in Spanish about your dream Colombia trip." },
    ],
  },
];

/** Idempotent seed of Phase 4 content (Stops ②–⑥) onto the existing placeholder regions. */
export function seedPhase4() {
  for (const c of CONTENT) {
    const region = db.select().from(schema.regions).where(eq(schema.regions.slug, c.slug)).get();
    if (!region) { console.log(`phase4: region '${c.slug}' not found — run seedMedellin first`); continue; }

    const already = db.select().from(schema.lessons).where(eq(schema.lessons.regionId, region.id)).get();
    if (already) { console.log(`phase4: ${c.slug} already has content`); continue; }

    db.transaction((tx) => {
      for (const v of c.vocab) tx.insert(schema.vocab).values({ regionId: region.id, ...v }).run();

      tx.insert(schema.lessons).values({
        regionId: region.id, order: 1, kind: "dialogue", title: c.dialogue.title,
        bodyJson: { lines: c.dialogue.lines },
      }).run();

      const hw = tx.insert(schema.lessons).values({
        regionId: region.id, order: 2, kind: "homework", title: c.homework.title, bodyJson: null,
      }).returning().get();
      c.homework.exercises.forEach((e, i) =>
        tx.insert(schema.exercises).values({ lessonId: hw.id, order: i + 1, ...e }).run());

      tx.insert(schema.schoolSessions).values({ regionId: region.id, agendaJson: c.agenda }).run();
    });
    console.log(`phase4: seeded ${c.slug} content`);
  }
}

// Run only when invoked directly (e.g. `tsx src/seed/phase4.ts`), not on import.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seedPhase4();
}
