import { useCallback, useEffect, useRef, useState } from "react";

export type Gender = "female" | "male";

// Heuristic: the Web Speech API exposes no gender field, so we match known
// Spanish voice names. Covers Apple (iOS/macOS), Google (Android/Chrome) and
// Microsoft (Windows/Edge) Spanish voices.
const FEMALE = /m[oó]nica|paulina|marisol|esperanza|luc[ií]a|sabina|catalina|ang[eé]lica|helena|laura|dalia|salom[eé]|paloma|elena|google espa/i;
const MALE = /jorge|diego|juan|carlos|pablo|ra[uú]l|miguel|pedro|gonzalo|dar[ií]o|enrique|andr[eé]s/i;

function isSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

function spanishVoices(): SpeechSynthesisVoice[] {
  if (!isSupported()) return [];
  return window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith("es"));
}

/** Pick the best voice for a gender; prefer a name match, else fall back by index, else any es voice. */
function pickVoice(voices: SpeechSynthesisVoice[], gender: Gender): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;
  const female = voices.find((v) => FEMALE.test(v.name)) ?? null;
  const male = voices.find((v) => MALE.test(v.name)) ?? null;
  // Only ever return a voice we can actually identify as the requested gender.
  // If that gender isn't present, fall back to the SAME single base voice for
  // both toggles (differentiated by pitch below) — never guess by list order,
  // which is what made the labels appear swapped on some devices.
  if (gender === "female") return female ?? male ?? voices[0];
  return male ?? female ?? voices[0];
}

/** True only when the device has a distinctly-named female AND male Spanish voice. */
function hasTwoGenderVoices(voices: SpeechSynthesisVoice[]): boolean {
  return voices.some((v) => FEMALE.test(v.name)) && voices.some((v) => MALE.test(v.name));
}

/**
 * Text-to-speech for the "Listen & repeat" drill. Reads Spanish slowly and warmly.
 * `gender` swaps between a female / male Spanish voice where the device provides them;
 * if only one voice exists it stays usable and nudges the pitch to differentiate.
 */
export function useSpeech() {
  const supported = isSupported();
  const [gender, setGender] = useState<Gender>("female");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => spanishVoices());
  const [speaking, setSpeaking] = useState<string | null>(null);
  const genderRef = useRef(gender);
  genderRef.current = gender;

  useEffect(() => {
    if (!supported) return;
    const load = () => setVoices(spanishVoices());
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", load);
      window.speechSynthesis.cancel();
    };
  }, [supported]);

  const speak = useCallback((text: string) => {
    if (!supported || !text) return;
    const synth = window.speechSynthesis;
    synth.cancel(); // stop anything already playing
    const u = new SpeechSynthesisUtterance(text);
    const g = genderRef.current;
    const voicesNow = spanishVoices();
    const bothReal = hasTwoGenderVoices(voicesNow);
    const voice = pickVoice(voicesNow, g);
    if (voice) u.voice = voice;
    u.lang = voice?.lang ?? "es-ES";
    u.rate = 0.85; // slow enough to repeat after
    // Two real voices already differ, so keep pitch near-natural. With only one
    // voice, exaggerate the pitch so male clearly sounds lower than female.
    if (bothReal) u.pitch = g === "female" ? 1.05 : 0.95;
    else u.pitch = g === "female" ? 1.25 : 0.7;
    u.onstart = () => setSpeaking(text);
    u.onend = () => setSpeaking((cur) => (cur === text ? null : cur));
    u.onerror = () => setSpeaking((cur) => (cur === text ? null : cur));
    synth.speak(u);
  }, [supported]);

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeaking(null);
  }, [supported]);

  const hasBothGenders = hasTwoGenderVoices(voices);
  // The voice name actually used for the current gender (for a transparent UI label).
  const activeVoiceName = pickVoice(voices, gender)?.name ?? null;

  return { supported, gender, setGender, speak, stop, speaking, voiceCount: voices.length, hasBothGenders, activeVoiceName };
}
