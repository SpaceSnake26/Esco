import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { BottomNav } from "../components/BottomNav";
import { useSpeech } from "../speech";

export function Pronunciation() {
  const regions = useQuery({ queryKey: ["regions"], queryFn: api.regions });
  // Practice the current stop; if the whole season is done, fall back to the last stop.
  const region =
    regions.data?.find((r) => r.status === "current") ??
    regions.data?.[regions.data.length - 1];
  const vocab = useQuery({
    queryKey: ["vocab", region?.id], enabled: !!region,
    queryFn: () => api.vocab(region!.id),
  });

  const { supported, gender, setGender, speak, stop, speaking, hasBothGenders, activeVoiceName } = useSpeech();
  const [playingAll, setPlayingAll] = useState(false);
  const timers = useRef<number[]>([]);

  function clearTimers() {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current = [];
  }
  useEffect(() => () => clearTimers(), []);

  // "Repeat after me" drill: say each word, leaving a gap to repeat it aloud.
  function playAll() {
    const words = vocab.data ?? [];
    if (words.length === 0) return;
    clearTimers();
    stop();
    setPlayingAll(true);
    words.forEach((w, i) => {
      timers.current.push(window.setTimeout(() => speak(w.es), i * 3500));
    });
    timers.current.push(window.setTimeout(() => setPlayingAll(false), words.length * 3500));
  }
  function stopAll() {
    clearTimers();
    stop();
    setPlayingAll(false);
  }

  return (
    <div style={{ fontFamily: "system-ui", minHeight: "100dvh", background: "#FFF9E6", display: "flex", flexDirection: "column" }}>
      <header style={{ background: "#0a6e5c", color: "#fff", padding: 14 }}>
        <strong>🔊 Listen & repeat{region ? ` — ${region.name}` : ""}</strong>
      </header>

      <main style={{ flex: 1, padding: 14, display: "grid", gap: 12 }}>
        {!supported ? (
          <section style={{ background: "#fff", borderRadius: 14, padding: 16 }}>
            <p>🔇 This device's browser can't read text aloud. Try the installed app on your phone, or Chrome/Safari.</p>
          </section>
        ) : (
          <>
            <section style={{ background: "#fff", borderRadius: 14, padding: 14, display: "grid", gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: "#0a6e5c", fontWeight: 700, marginBottom: 6 }}>Voice</div>
                <div role="group" aria-label="Voice" style={{ display: "flex", gap: 8 }}>
                  <VoiceBtn active={gender === "female"} onClick={() => setGender("female")} label="🚺 Female" />
                  <VoiceBtn active={gender === "male"} onClick={() => setGender("male")} label="🚹 Male" />
                </div>
                <div style={{ fontSize: 11, color: "#999", marginTop: 6 }}>
                  {activeVoiceName ? `Voice: ${activeVoiceName}` : "Using the default Spanish voice"}
                  {!hasBothGenders && (
                    <> · only one Spanish voice on this device, so the toggle shifts the tone. Add a 2nd voice: iPhone → Settings › Accessibility › Spoken Content › Voices › Spanish; Android → Settings › Text-to-speech.</>
                  )}
                </div>
              </div>
              <button
                onClick={playingAll ? stopAll : playAll}
                style={{ padding: 14, border: 0, borderRadius: 12, fontWeight: 800, fontSize: 16,
                  background: playingAll ? "#e21b3c" : "#58CC02", color: "#fff" }}
              >
                {playingAll ? "■ Stop" : "▶ Play all · repeat after each word"}
              </button>
            </section>

            <section style={{ display: "grid", gap: 10 }}>
              {vocab.data?.map((w) => (
                <div key={w.es} style={{ background: "#fff", borderRadius: 14, padding: 14,
                  display: "flex", alignItems: "center", gap: 12,
                  outline: speaking === w.es ? "3px solid #58CC02" : "none" }}>
                  <button
                    aria-label={`Play ${w.es}`}
                    onClick={() => speak(w.es)}
                    style={{ flexShrink: 0, width: 48, height: 48, borderRadius: 999, border: 0,
                      background: "#0a6e5c", color: "#fff", fontSize: 20, cursor: "pointer" }}
                  >
                    {speaking === w.es ? "🔊" : "▶"}
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#0a3d33" }}>{w.es}</div>
                    <div style={{ fontSize: 13, color: "#555" }}>{w.en}</div>
                    {w.example && (
                      <button
                        aria-label={`Play example: ${w.example}`}
                        onClick={() => speak(w.example!)}
                        style={{ marginTop: 4, padding: 0, border: 0, background: "none", color: "#0a6e5c",
                          fontSize: 12, fontStyle: "italic", textAlign: "left", cursor: "pointer" }}
                      >
                        ▶ “{w.example}”
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {vocab.data && vocab.data.length === 0 && (
                <div style={{ background: "#fff", borderRadius: 14, padding: 16, color: "#555" }}>
                  No words here yet.
                </div>
              )}
            </section>
          </>
        )}
      </main>
      <BottomNav />
    </div>
  );
}

function VoiceBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      style={{ flex: 1, padding: 12, borderRadius: 10, fontWeight: 700, cursor: "pointer",
        border: active ? "2px solid #0a6e5c" : "2px solid #ddd",
        background: active ? "#0a6e5c" : "#fff", color: active ? "#fff" : "#555" }}
    >
      {label}
    </button>
  );
}
