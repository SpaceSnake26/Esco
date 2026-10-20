import { pathToFileURL } from "node:url";
import { barranquillaContent } from "./barranquilla.js";
import { cartagenaContent } from "./cartagena.js";
import { challengeContent } from "./challenge.js";
import { medellinContent } from "./medellin.js";
import { medellinFinaleContent } from "./medellin-finale.js";
import { santaMartaContent } from "./santa-marta.js";
import { sierraNevadaContent } from "./sierra-nevada.js";
import { upsertStopContent } from "./upsert.js";

// Full-curriculum enrichment, applied additively on top of the base seeds.
// All 6 stops carry a full ~2-week unit + a 4th challenge homework set.
const STOPS = [
  medellinContent, cartagenaContent, barranquillaContent,
  santaMartaContent, sierraNevadaContent, medellinFinaleContent,
  ...challengeContent,
];

export function seedCurriculum() {
  for (const stop of STOPS) console.log(upsertStopContent(stop));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seedCurriculum();
}
