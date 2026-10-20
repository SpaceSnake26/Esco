import type { StopContent } from "./upsert.js";

// Stop ⑥ Medellín (vuelta) — Review & real conversation (A2). Grammar: simple
// past (pretérito), future plans (voy a + inf), connectors. Pulls together the
// whole trip. ADDED on top of the base 8 vocab / 5 ex.
export const medellinFinaleContent: StopContent = {
  slug: "medellin-finale",
  vocab: [
    // Time words
    { es: "Ayer", en: "Yesterday", example: "Ayer fuimos a la playa." },
    { es: "Hoy", en: "Today", example: "Hoy descansamos." },
    { es: "Mañana", en: "Tomorrow", example: "Mañana volvemos a casa." },
    { es: "La semana pasada", en: "Last week", example: "La semana pasada estuvimos en Cartagena." },
    { es: "Antes", en: "Before", example: "Antes no hablaba español." },
    { es: "Ahora", en: "Now", example: "Ahora hablo un poco." },
    // Past tense (I did)
    { es: "Fui", en: "I went", example: "Fui a Santa Marta." },
    { es: "Comí", en: "I ate", example: "Comí ceviche en Cartagena." },
    { es: "Vi", en: "I saw", example: "Vi la cascada en la Sierra." },
    { es: "Bailé", en: "I danced", example: "Bailé salsa en Barranquilla." },
    { es: "Caminé", en: "I walked", example: "Caminé por el sendero." },
    { es: "Me gustó", en: "I liked (it)", example: "Me gustó mucho el viaje." },
    { es: "Fue increíble", en: "It was incredible", example: "¡Fue increíble!" },
    { es: "Aprendimos", en: "We learned", example: "Aprendimos mucho español." },
    // Future & plans
    { es: "Voy a…", en: "I'm going to…", example: "Voy a volver el próximo año." },
    { es: "Vamos a volver", en: "We're going to come back", example: "Vamos a volver a Colombia." },
    { es: "Quiero volver", en: "I want to come back", example: "Quiero volver pronto." },
    { es: "El próximo viaje", en: "The next trip", example: "El próximo viaje será mejor." },
    // Connectors
    { es: "Primero", en: "First", example: "Primero fuimos a Medellín." },
    { es: "Luego", en: "Then", example: "Luego a Cartagena." },
    { es: "Después", en: "Afterwards", example: "Después a la playa." },
    { es: "También", en: "Also / too", example: "También vi delfines." },
    { es: "Pero", en: "But", example: "Fue corto, pero increíble." },
    { es: "Porque", en: "Because", example: "Me gustó porque la gente es alegre." },
    { es: "Muy", en: "Very", example: "Muy bonito todo." },
    { es: "Un poco", en: "A little", example: "Hablo un poco de español." },
    // Reflection
    { es: "El mejor", en: "The best", example: "El mejor viaje de mi vida." },
    { es: "Inolvidable", en: "Unforgettable", example: "Un viaje inolvidable." },
    { es: "Los recuerdos", en: "The memories", example: "Me llevo muchos recuerdos." },
    { es: "Gracias por todo", en: "Thanks for everything", example: "Gracias por todo, Colombia." },
    { es: "Ya sé", en: "I already know", example: "Ya sé pedir comida en español." },
    { es: "¡Hablo español!", en: "I speak Spanish!", example: "¡Ahora hablo español!" },
  ],
  grammar: [
    {
      title: "Talking about the past (pretérito)",
      intro: "To say what you DID: -ar verbs → -é, -er/-ir verbs → -í. A few are irregular.",
      points: [
        { es: "bailé, caminé", en: "I danced, I walked (-ar)" },
        { es: "comí, viví", en: "I ate, I lived (-er/-ir)" },
        { es: "fui", en: "I went / I was (irregular)" },
        { es: "vi", en: "I saw (irregular)" },
        { es: "Ayer comí arepa.", en: "Yesterday I ate arepa." },
      ],
    },
    {
      title: "Future plans: voy a + infinitive",
      intro: "Say what you're GOING to do with ir (voy/vas/va) + a + a verb.",
      points: [
        { es: "Voy a volver.", en: "I'm going to come back." },
        { es: "Vamos a aprender más.", en: "We're going to learn more." },
        { es: "¿Qué vas a hacer?", en: "What are you going to do?" },
        { es: "Van a viajar.", en: "They're going to travel." },
      ],
    },
    {
      title: "Linking words (connectors)",
      intro: "Join ideas to tell a real story, not just single words.",
      points: [
        { es: "primero… luego… después", en: "first… then… afterwards" },
        { es: "y / también", en: "and / also" },
        { es: "pero", en: "but" },
        { es: "porque", en: "because" },
      ],
    },
  ],
  dialogues: [
    {
      title: "¿Qué hiciste en el viaje?",
      lines: [
        { who: "Ana", es: "¿Qué hiciste en el viaje?", en: "What did you do on the trip?" },
        { who: "Tú", es: "Primero fui a Medellín y tomé un tinto.", en: "First I went to Medellín and had a coffee." },
        { who: "Ana", es: "¿Y después?", en: "And afterwards?" },
        { who: "Tú", es: "Luego comí ceviche en Cartagena y bailé en Barranquilla.", en: "Then I ate ceviche in Cartagena and danced in Barranquilla." },
        { who: "Ana", es: "¡Qué bien! ¿Te gustó?", en: "How nice! Did you like it?" },
        { who: "Tú", es: "Me gustó mucho. Fue inolvidable.", en: "I liked it a lot. It was unforgettable." },
      ],
    },
    {
      title: "El próximo viaje",
      lines: [
        { who: "Aleks", es: "¿Vas a volver a Colombia?", en: "Are you going to come back to Colombia?" },
        { who: "Tú", es: "¡Claro! Voy a volver el próximo año.", en: "Of course! I'm going to come back next year." },
        { who: "Aleks", es: "¿Qué vas a hacer?", en: "What are you going to do?" },
        { who: "Tú", es: "Voy a hablar más español y ver la Sierra otra vez.", en: "I'm going to speak more Spanish and see the Sierra again." },
        { who: "Aleks", es: "¡Lo logramos, parcero!", en: "We did it, buddy!" },
        { who: "Tú", es: "Gracias por todo. ¡Hasta pronto!", en: "Thanks for everything. See you soon!" },
      ],
    },
  ],
  homeworks: [
    {
      title: "Tarea 2: El pasado del viaje",
      exercises: [
        { type: "multiple_choice", prompt: "'I went to the beach' =", answer: "Fui a la playa",
          optionsJson: ["Voy a la playa", "Fui a la playa", "Soy a la playa", "Vi a la playa"], points: 15 },
        { type: "multiple_choice", prompt: "'I ate ceviche' =", answer: "Comí ceviche",
          optionsJson: ["Como ceviche", "Comí ceviche", "Comer ceviche", "Comemos ceviche"], points: 15 },
        { type: "multiple_choice", prompt: "'I danced salsa' =", answer: "Bailé salsa",
          optionsJson: ["Bailo salsa", "Bailé salsa", "Bailar salsa", "Bailamos salsa"], points: 15 },
        { type: "multiple_choice", prompt: "Past of 'ver' (I saw) is…", answer: "Vi",
          optionsJson: ["Veo", "Vi", "Ver", "Vía"], points: 15 },
        { type: "fill_blank", prompt: "'Yesterday': ____.", answer: "Ayer", optionsJson: null, points: 10 },
        { type: "fill_blank", prompt: "'I walked' (caminar, past): ____.", answer: "caminé", optionsJson: null, points: 15 },
        { type: "fill_blank", prompt: "'I liked it a lot': Me ____ mucho.", answer: "gustó", optionsJson: null, points: 10 },
        { type: "multiple_choice", prompt: "'La semana pasada' means…", answer: "Last week",
          optionsJson: ["Next week", "Last week", "This week", "Every week"], points: 10 },
        { type: "multiple_choice", prompt: "Which tells a story in order?", answer: "Primero… luego… después",
          optionsJson: ["Aquí… allí… acá", "Primero… luego… después", "Sí… no… tal vez", "Uno… dos… tres"], points: 10 },
        { type: "fill_blank", prompt: "Join two ideas with contrast: 'corto ____ increíble'.", answer: "pero", optionsJson: null, points: 10 },
        { type: "multiple_choice", prompt: "'Fue increíble' means…", answer: "It was incredible",
          optionsJson: ["It is incredible", "It was incredible", "It will be incredible", "I am incredible"], points: 10 },
        { type: "fill_blank", prompt: "Give a reason with 'because': me gustó ____ la gente es alegre.", answer: "porque", optionsJson: null, points: 10 },
      ],
    },
    {
      title: "Tarea 3: Planes y repaso",
      exercises: [
        { type: "multiple_choice", prompt: "'I'm going to come back' =", answer: "Voy a volver",
          optionsJson: ["Fui a volver", "Voy a volver", "Vuelvo ayer", "Voy volver a"], points: 15 },
        { type: "multiple_choice", prompt: "'What are you going to do?' =", answer: "¿Qué vas a hacer?",
          optionsJson: ["¿Qué haces?", "¿Qué vas a hacer?", "¿Qué hiciste?", "¿Qué quieres?"], points: 15 },
        { type: "fill_blank", prompt: "Plan: 'We're going to learn more': Vamos ____ aprender más.", answer: "a", optionsJson: null, points: 10 },
        // Mixed review across the whole trip
        { type: "multiple_choice", prompt: "Review — order coffee in Medellín:", answer: "Un tinto, por favor",
          optionsJson: ["Un tinto, por favor", "¿Dónde está el tinto?", "Me gusta tinto", "Fui al tinto"], points: 10 },
        { type: "multiple_choice", prompt: "Review — ask the price at the market:", answer: "¿Cuánto cuesta?",
          optionsJson: ["¿Cómo estás?", "¿Cuánto cuesta?", "¿Dónde está?", "¿Qué más?"], points: 10 },
        { type: "multiple_choice", prompt: "Review — ask for directions to the beach:", answer: "¿Dónde está la playa?",
          optionsJson: ["¿Cuánto cuesta la playa?", "¿Dónde está la playa?", "¿Te gusta la playa?", "Fui a la playa"], points: 10 },
        { type: "multiple_choice", prompt: "Review — say you like to dance:", answer: "Me gusta bailar",
          optionsJson: ["Me gusta bailar", "Tengo bailar", "Voy bailar", "Soy bailar"], points: 10 },
        { type: "multiple_choice", prompt: "Review — say you're thirsty on the hike:", answer: "Tengo sed",
          optionsJson: ["Estoy sed", "Tengo sed", "Soy sed", "Quiero sed"], points: 10 },
        { type: "fill_blank", prompt: "'Thanks for everything': Gracias por ____.", answer: "todo", optionsJson: null, points: 10 },
        { type: "fill_blank", prompt: "Proud finish: ¡Hablo ____!", answer: "español", optionsJson: null, points: 10 },
        { type: "multiple_choice", prompt: "'Inolvidable' means…", answer: "Unforgettable",
          optionsJson: ["Forgettable", "Unforgettable", "Incredible", "Unbelievable"], points: 10 },
        { type: "multiple_choice", prompt: "Warm goodbye for now:", answer: "¡Hasta pronto!",
          optionsJson: ["¡Buenos días!", "¡Hasta pronto!", "¿Cómo está?", "¡Cuidado!"], points: 10 },
      ],
    },
  ],
  agendas: [
    // Week 1 already seeded by phase4; add Week 2 here.
    {
      order: 2,
      steps: [
        { minutes: 10, title: "Repaso relámpago", instructions: "Lightning review: each person says one thing they can now do in Spanish from each stop." },
        { minutes: 15, title: "Mi viaje (pasado)", instructions: "Each person tells the trip story in Spanish using the past: 'Fui… comí… bailé… vi…' with primero/luego/después." },
        { minutes: 20, title: "El próximo viaje", instructions: "Plan the dream next trip in Spanish using 'voy a / vamos a' — where, what you'll eat, do and see." },
        { minutes: 15, title: "Conversación libre", instructions: "Hold a 3-minute free conversation entirely in Spanish. No English allowed — ¡celebren lo que lograron!" },
      ],
    },
  ],
};
