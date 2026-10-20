import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import type { PublicUser } from "@shared/types";
import { api } from "../api";
import { BottomNav } from "../components/BottomNav";

export function School({ user }: { user: PublicUser }) {
  const school = useQuery({ queryKey: ["school"], queryFn: api.school });
  const sessions = school.data?.sessions ?? [];
  const [week, setWeek] = useState(0);
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const session = sessions[week];
  const agenda = session?.agenda ?? [];
  const current = agenda[step];

  function pickWeek(i: number) {
    setWeek(i);
    setStep(0);
    setDone(false);
    setError("");
  }

  async function finish() {
    if (!session || busy) return;
    setBusy(true);
    setError("");
    try {
      await api.completeSchool(session.id, [user.id]);
      setDone(true);
    } catch {
      setError("Couldn't save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ fontFamily: "system-ui", minHeight: "100dvh", background: "#FFF9E6", display: "flex", flexDirection: "column" }}>
      <header style={{ background: "#0a6e5c", color: "#fff", padding: 14 }}>
        <strong>🏫 Class — {school.data?.regionName}</strong>
      </header>
      <main style={{ flex: 1, padding: 18 }}>
        {sessions.length > 1 && (
          <div role="group" aria-label="Session week" style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {sessions.map((s, i) => (
              <button key={s.id} onClick={() => pickWeek(i)} aria-pressed={i === week}
                style={{ flex: 1, padding: 10, borderRadius: 10, fontWeight: 700, cursor: "pointer",
                  border: i === week ? "2px solid #0a6e5c" : "2px solid #ddd",
                  background: i === week ? "#0a6e5c" : "#fff", color: i === week ? "#fff" : "#555" }}>
                Week {s.order}
              </button>
            ))}
          </div>
        )}

        {done ? (
          <section style={{ background: "#fff", borderRadius: 16, padding: 18 }}>
            <h2>Great job! +100 participation pts 🎉</h2>
            <Link
              to="/arena"
              style={{ display: "block", textAlign: "center", padding: 14, marginTop: 12, background: "#e21b3c", color: "#fff", borderRadius: 12, textDecoration: "none", fontWeight: 700 }}
            >
              🔥 Play El Reto
            </Link>
          </section>
        ) : current ? (
          <section style={{ background: "#fff", borderRadius: 16, padding: 18 }}>
            <div style={{ fontSize: 12, color: "#0a6e5c" }}>Step {step + 1}/{agenda.length} · {current.minutes} min</div>
            <h2>{current.title}</h2>
            <p style={{ fontSize: 18, lineHeight: 1.5 }}>{current.instructions}</p>
            {step < agenda.length - 1 ? (
              <button onClick={() => setStep(step + 1)} style={{ padding: 14, width: "100%", marginTop: 12 }}>Next →</button>
            ) : (
              <button onClick={finish} disabled={busy} style={{ padding: 14, width: "100%", marginTop: 12, background: "#58CC02", color: "#fff", border: 0, borderRadius: 12, opacity: busy ? 0.6 : 1 }}>
                {busy ? "Saving…" : "Finish class (+100)"}
              </button>
            )}
            {error && <p style={{ color: "crimson" }}>{error}</p>}
          </section>
        ) : <p>…</p>}
      </main>
      <BottomNav />
    </div>
  );
}
