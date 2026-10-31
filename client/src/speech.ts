import { useCallback, useEffect, useRef, useState } from "react";

export type Gender = "female" | "male";

// Heuristic: the Web Speech API exposes no gender field, so we match known
// Spanish voice names. Covers Apple (iOS/macOS), Google (Android/Chrome) and
// Microsoft (Windows/Edge) Spanish voices.
const FEMALE = /m[oó]nica|paulina|marisol|esperanza|luc[ií]a|sabina|catalina|ang[eé]lica|helena|laura|dalia|salom[eé]|paloma|elena|elvira|ximena|paola|google espa/i;
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
  // Device-voice fallback only; normally the neural /api/tts voices play instead.
  if (gender === "female") return female ?? voices.find((v) => !MALE.test(v.name)) ?? voices[0];
  return male ?? female ?? voices[0];
}

/** True only when the device has a distinctly-named female AND male Spanish voice. */
function hasTwoGenderVoices(voices: SpeechSynthesisVoice[]): boolean {
  return voices.some((v) => FEMALE.test(v.name)) && voices.some((v) => MALE.test(v.name));
}

export const VOICE_LABEL: Record<Gender, string> = { female: "Salomé (Colombia)", male: "Gonzalo (Colombia)" };

/**
 * "Listen & repeat" audio. Plays the server's Colombian neural voices, which sound
 * the same on every device; falls back to the device's own Spanish voice if the
 * server audio fails, so the button always makes a sound.
 */
export function useSpeech() {
  const supported = typeof Audio !== "undefined" || isSupported();
  const [gender, setGender] = useState<Gender>("female");
  const [speaking, setSpeaking] = useState<string | null>(null);
  const genderRef = useRef(gender);
  genderRef.current = gender;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const tapRef = useRef(0);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.onerror = audioRef.current.onended = null;
      audioRef.current.pause();
    }
    if (isSupported()) window.speechSynthesis.cancel();
    setSpeaking(null);
  }, []);
  useEffect(() => stop, [stop]);

  const deviceSpeak = useCallback((text: string, g: Gender) => {
    if (!isSupported()) { setSpeaking(null); return; }
    const u = new SpeechSynthesisUtterance(text);
    const voices = spanishVoices();
    const voice = pickVoice(voices, g);
    if (voice) u.voice = voice;
    u.lang = voice?.lang ?? "es-ES";
    u.rate = 0.85;
    // Two real voices already differ; with one voice, exaggerate the pitch instead.
    u.pitch = hasTwoGenderVoices(voices) ? (g === "female" ? 1.05 : 0.95) : (g === "female" ? 1.4 : 0.7);
    u.onstart = () => setSpeaking(text);
    u.onend = u.onerror = () => setSpeaking((cur) => (cur === text ? null : cur));
    window.speechSynthesis.speak(u);
  }, []);

  const speak = useCallback((text: string) => {
    if (!text) return;
    stop();
    setSpeaking(text);
    // Reuse one element: iOS only allows audio on an element first played from a tap.
    const a = audioRef.current ?? (audioRef.current = new Audio());
    a.onended = () => setSpeaking((cur) => (cur === text ? null : cur));
    const g = genderRef.current;
    const tap = ++tapRef.current;
    let fell = false;
    // Only the latest tap may fall back, in the voice chosen when it was tapped.
    const fallback = () => { if (!fell && tap === tapRef.current) { fell = true; deviceSpeak(text, g); } };
    a.onerror = fallback;
    a.src = `/api/tts?voice=${g}&text=${encodeURIComponent(text)}`;
    // AbortError only means a newer tap interrupted this one: no fallback for that.
    Promise.resolve(a.play()).catch((e) => { if (e?.name !== "AbortError") fallback(); });
  }, [stop, deviceSpeak]);

  return { supported, gender, setGender, speak, stop, speaking, voiceLabel: VOICE_LABEL[gender] };
}
