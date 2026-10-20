import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { PublicUser } from "@shared/types";
import { api } from "../api";
import { useLiveGame } from "../live/useLiveGame";

const TILES = [
  { color: "#e21b3c", shape: "▲" },
  { color: "#1368ce", shape: "◆" },
  { color: "#d89e00", shape: "●" },
  { color: "#26890c", shape: "■" },
];

const shell = {
  fontFamily: "system-ui",
  minHeight: "100dvh",
  background: "#0a1744",
  color: "#fff",
  display: "flex",
  flexDirection: "column" as const,
  padding: 18,
};

const bigBtn = {
  fontSize: 26, fontWeight: 800, padding: "18px 24px", width: "100%",
  background: "#58CC02", color: "#fff", border: 0, borderRadius: 18, cursor: "pointer",
} as const;

/**
 * El Reto — the live buzzer quiz. ONE screen everyone opens: whoever opens it joins
 * the shared room; the first person's device creates the game. Anyone can press Start,
 * everyone answers on their own device, fastest correct answer scores the most.
 */
export function Arena({ user }: { user: PublicUser }) {
  const regions = useQuery({ queryKey: ["regions"], queryFn: api.regions });
  const region = regions.data?.find((r) => r.status === "current") ?? regions.data?.[0];
  const game = useLiveGame();
  const { enter } = game.actions;
  const enteredRef = useRef(false);
  const [localAnswered, setLocalAnswered] = useState(false);

  // Join/create the shared room once, as soon as the socket is open and we know the region.
  useEffect(() => {
    if (!enteredRef.current && game.connected && region) {
      enteredRef.current = true;
      enter(region.id);
    }
  }, [game.connected, region, enter]);

  useEffect(() => { setLocalAnswered(false); }, [game.question?.index]);
  const answered = localAnswered || game.answeredUserIds.includes(user.id);

  function pick(index: number) {
    if (answered) return;
    setLocalAnswered(true);
    game.actions.answer(index);
  }

  const disconnected = !game.connected && game.status !== "connecting";

  return (
    <div style={shell}>
      {disconnected && (
        <p style={{ background: "#7a1020", padding: "10px 14px", borderRadius: 12, fontSize: 15, textAlign: "center" }}>
          Disconnected — reload the page
        </p>
      )}

      {(game.status === "connecting" || (!region && regions.isLoading)) && (
        <p style={{ fontSize: 22, margin: "auto" }}>Connecting…</p>
      )}

      {/* ---------- LOBBY · Colombian classroom waiting room ---------- */}
      {game.status === "lobby" && (
        <div style={{ margin: "auto", width: "100%", maxWidth: 460 }}>
          <div style={{ background: "#FFF6E0", borderRadius: 22, overflow: "hidden", color: "#0a3d33", boxShadow: "0 14px 44px rgba(0,0,0,.45)" }}>
            {/* chalkboard header */}
            <div style={{ background: "#2f4f3e", color: "#fff", padding: "16px 18px", textAlign: "center", borderBottom: "4px solid #FFD21E" }}>
              <div style={{ fontSize: 12, letterSpacing: 2, opacity: 0.85 }}>🇨🇴 EL SALÓN · SALA DE ESPERA</div>
              <h1 style={{ fontSize: 30, margin: "4px 0 0" }}>🔥 El Reto</h1>
            </div>

            {/* cozy classroom scene */}
            <div style={{ fontSize: 30, textAlign: "center", padding: "12px 0 2px", letterSpacing: 3 }}>☕ 📚 🪑 🛖 🦜</div>
            <p style={{ textAlign: "center", margin: "0 18px 8px", fontSize: 13.5, color: "#6b5b36" }}>
              Grab a tinto, relax in the hamaca — waiting for the class to gather.
            </p>

            {/* players at their desks */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, padding: "8px 16px" }}>
              {game.players.length === 0 && (
                <div style={{ gridColumn: "1 / -1", textAlign: "center", color: "#9a7b3a", padding: "10px 0" }}>Nadie más todavía… 🪑</div>
              )}
              {game.players.map((p) => (
                <div key={p.userId} style={{ background: "#fff", border: "2px solid #e8d7a6", borderRadius: 14, padding: "10px 8px", textAlign: "center" }}>
                  <div style={{ fontSize: 30 }}>{p.avatar}</div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: "#2e7d32", fontWeight: 700 }}>¡listo! ✓</div>
                </div>
              ))}
            </div>

            <div style={{ padding: "8px 16px 18px" }}>
              <button onClick={() => game.actions.start()} style={{ ...bigBtn, fontSize: 24, background: "#e21b3c", borderRadius: 16 }}>
                ¡Empezar! ▶
              </button>
              <p style={{ fontSize: 12.5, color: "#6b7a72", textAlign: "center", marginTop: 10 }}>
                Everyone opens this screen → <b>anyone</b> taps ¡Empezar! No host, no waiting. 🦜
              </p>
              <div style={{ textAlign: "center", marginTop: 6 }}><Link to="/" style={{ color: "#0a6e5c", fontSize: 13 }}>← Home</Link></div>
            </div>
          </div>
        </div>
      )}

      {/* ---------- QUESTION ---------- */}
      {game.status === "question" && game.question && (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 12 }}>
          <div style={{ textAlign: "center", fontSize: 15, color: "#FFD21E" }}>
            Question {game.question.index + 1} / {game.question.total}
          </div>
          <h2 style={{ textAlign: "center", fontSize: 24, margin: "4px 0" }}>{game.question.prompt}</h2>

          {answered ? (
            <div style={{ margin: "auto", textAlign: "center" }}>
              <div style={{ fontSize: 56 }}>⚡</div>
              <h3 style={{ fontSize: 22 }}>Answer sent! Waiting for the others…</h3>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridAutoRows: "1fr", gap: 12, flex: 1 }}>
              {game.question.options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => pick(i)}
                  aria-label={`Option ${i + 1}: ${opt}`}
                  style={{ background: TILES[i % 4].color, border: 0, borderRadius: 18, color: "#fff", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: 10 }}
                >
                  <span style={{ fontSize: 40 }}>{TILES[i % 4].shape}</span>
                  <span style={{ fontSize: 18, fontWeight: 700 }}>{opt}</span>
                </button>
              ))}
            </div>
          )}

          <div style={{ textAlign: "center", fontSize: 14, opacity: 0.8 }}>
            {game.players.map((p) => (
              <span key={p.userId} style={{ margin: "0 6px" }}>
                {game.answeredUserIds.includes(p.userId) ? "✅" : "⏳"} {p.name}
              </span>
            ))}
          </div>
          <button onClick={() => game.actions.reveal()} style={{ ...bigBtn, background: "#FFD21E", color: "#0a1744", fontSize: 18, padding: "12px 20px" }}>
            Reveal answer
          </button>
        </div>
      )}

      {/* ---------- REVEAL ---------- */}
      {game.status === "reveal" && game.reveal && game.question && (() => {
        const mine = game.reveal.round.find((r) => r.userId === user.id);
        return (
          <div style={{ margin: "auto", textAlign: "center", width: "100%", maxWidth: 440 }}>
            <h2 style={{ fontSize: 22, marginTop: 0 }}>{game.question.prompt}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, margin: "12px 0" }}>
              {game.question.options.map((opt, i) => {
                const correct = i === game.reveal!.correctIndex;
                return (
                  <div key={i} style={{ background: TILES[i % 4].color, borderRadius: 14, padding: 12, fontSize: 16, fontWeight: 700, opacity: correct ? 1 : 0.3, outline: correct ? "4px solid #fff" : "none" }}>
                    {TILES[i % 4].shape} {opt} {correct ? "✅" : ""}
                  </div>
                );
              })}
            </div>
            {mine?.correct
              ? <h1 style={{ fontSize: 30, color: "#58CC02" }}>Correct! +{mine.points} ⚡</h1>
              : <h1 style={{ fontSize: 30, color: "#ff9a9a" }}>Not this time (0)</h1>}

            <div style={{ background: "#16235e", borderRadius: 14, padding: 12, margin: "12px 0", textAlign: "left" }}>
              <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 1, opacity: 0.7, marginBottom: 6 }}>Scores</div>
              {game.reveal.totals.map((row, i) => (
                <div key={row.userId} style={{ display: "flex", justifyContent: "space-between", fontSize: 18, padding: "3px 0" }}>
                  <span>{["🥇", "🥈", "🥉"][i] ?? "•"} {row.avatar} {row.name}</span><b>{row.points}</b>
                </div>
              ))}
            </div>
            <button onClick={() => game.actions.next()} style={bigBtn}>Next question →</button>
          </div>
        );
      })()}

      {/* ---------- ENDED ---------- */}
      {game.status === "ended" && (() => {
        const place = game.podium.findIndex((p) => p.userId === user.id) + 1;
        return (
          <div style={{ margin: "auto", textAlign: "center", width: "100%", maxWidth: 440 }}>
            <h1 style={{ fontSize: 44 }}>🏆 Final scores</h1>
            {game.podium.map((row, i) => (
              <div key={row.userId} style={{ display: "flex", justifyContent: "space-between", fontSize: 24, background: "#16235e", borderRadius: 14, padding: "12px 18px", margin: "8px 0" }}>
                <span>{["🥇", "🥈", "🥉"][i] ?? `${i + 1}.`} {row.avatar} {row.name}</span><b>{row.points}</b>
              </div>
            ))}
            {place > 0 && <p style={{ fontSize: 20, marginTop: 10 }}>You finished {place}{["st", "nd", "rd"][place - 1] ?? "th"}!</p>}
            <button onClick={() => region && game.actions.enter(region.id)} style={{ ...bigBtn, marginTop: 14 }}>Play again ↻</button>
            <div style={{ marginTop: 12 }}><Link to="/" style={{ color: "#9fb4ff" }}>← Home</Link></div>
          </div>
        );
      })()}

      {game.error && <p style={{ color: "#ff9a9a", textAlign: "center", fontSize: 15 }}>{game.error}</p>}
    </div>
  );
}
