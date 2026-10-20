import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import type { PublicUser } from "@shared/types";
import { api } from "../api";
import { BottomNav } from "../components/BottomNav";

export function Home({ user }: { user: PublicUser }) {
  const qc = useQueryClient();
  async function logout() {
    try { await api.logout(); } finally {
      qc.clear();
      qc.setQueryData(["me"], null); // flip RequireAuth back to the login screen
    }
  }
  const regions = useQuery({ queryKey: ["regions"], queryFn: api.regions });
  const board = useQuery({ queryKey: ["leaderboard"], queryFn: api.leaderboard });
  const streak = useQuery({ queryKey: ["streak"], queryFn: api.streak });
  const quests = useQuery({ queryKey: ["quests"], queryFn: api.questsToday });
  const current = regions.data?.find((r) => r.status === "current");
  const questsLeft = quests.data?.filter((q) => !q.done).length ?? 0;

  return (
    <div style={{ fontFamily: "system-ui", minHeight: "100dvh", background: "#FFF9E6", display: "flex", flexDirection: "column" }}>
      <header style={{ background: "#FFD21E", padding: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <strong style={{ color: "#0a6e5c" }}>🦜 Hey, {user.name}!</strong>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {streak.data ? (
            <span style={{ fontSize: 13, fontWeight: 700, color: "#0a6e5c" }} title="Day streak">🔥 {streak.data.current}</span>
          ) : null}
          <button onClick={logout} style={{ background: "rgba(10,110,92,0.12)", color: "#0a6e5c", border: "1px solid rgba(10,110,92,0.3)", borderRadius: 10, padding: "5px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            Log out
          </button>
        </div>
      </header>
      <main style={{ flex: 1, padding: 14, display: "grid", gap: 12 }}>
        {current ? (
          <Link to={`/stop/${current.id}`} style={{ background: "#fff", borderRadius: 14, padding: 14, textDecoration: "none", color: "inherit", display: "block" }}>
            <div style={{ fontSize: 12, color: "#0a6e5c", fontWeight: 700 }}>🧭 Your current stop · tap to open →</div>
            <h2 style={{ margin: "6px 0" }}>{current.name} — {current.theme}</h2>
          </Link>
        ) : (
          <section style={{ background: "#fff", borderRadius: 14, padding: 14 }}>
            <div style={{ fontSize: 12, color: "#0a6e5c", fontWeight: 700 }}>🧭 Your current stop</div>
            <p>…</p>
          </section>
        )}
        <Link
          to="/arena"
          style={{ background: "#e21b3c", borderRadius: 14, padding: 16, textDecoration: "none", color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between" }}
        >
          <span style={{ fontWeight: 800, fontSize: 17 }}>🔥 Play El Reto</span>
          <span style={{ fontSize: 13, opacity: 0.9 }}>Live quiz, together →</span>
        </Link>
        <Link
          to="/misiones"
          style={{ background: "#fff", borderRadius: 14, padding: 14, textDecoration: "none", color: "#0a6e5c", display: "flex", alignItems: "center", justifyContent: "space-between" }}
        >
          <span style={{ fontWeight: 700 }}>🎯 Today's mission</span>
          <span style={{ fontSize: 13, color: questsLeft > 0 ? "#e21b3c" : "#2e7d32", fontWeight: 700 }}>
            {quests.data ? (questsLeft > 0 ? `${questsLeft} to do →` : "All done! ✓") : "→"}
          </span>
        </Link>
        <Link
          to="/charlar"
          style={{ background: "#fff", borderRadius: 14, padding: 14, textDecoration: "none", color: "#0a6e5c", display: "flex", alignItems: "center", justifyContent: "space-between" }}
        >
          <span style={{ fontWeight: 700 }}>🦜 Chat with Pablito</span>
          <span style={{ fontSize: 13, color: "#999" }}>Practice speaking →</span>
        </Link>
        <Link
          to="/escuchar"
          style={{ background: "#fff", borderRadius: 14, padding: 14, textDecoration: "none", color: "#0a6e5c", display: "flex", alignItems: "center", justifyContent: "space-between" }}
        >
          <span style={{ fontWeight: 700 }}>🔊 Listen & repeat</span>
          <span style={{ fontSize: 13, color: "#999" }}>Hear the words →</span>
        </Link>
        <Link
          to="/logros"
          style={{ background: "#fff", borderRadius: 14, padding: 14, textDecoration: "none", color: "#0a6e5c", display: "flex", alignItems: "center", justifyContent: "space-between" }}
        >
          <span style={{ fontWeight: 700 }}>🎖️ Badges</span>
          <span style={{ fontSize: 13, color: "#999" }}>See your shelf →</span>
        </Link>
        <section style={{ background: "#fff", borderRadius: 14, padding: 14 }}>
          <div style={{ fontSize: 12, color: "#0a6e5c", fontWeight: 700 }}>🏆 Leaderboard</div>
          {board.data?.map((row, i) => (
            <div key={row.userId} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
              <span>{["🥇", "🥈", "🥉"][i] ?? "•"} {row.name}</span><b>{row.points}</b>
            </div>
          ))}
          <div style={{ fontSize: 10, color: "#999", marginTop: 6 }}>Grand champion crowned 31 Jan 2027 🇨🇴</div>
        </section>
      </main>
      <BottomNav />
    </div>
  );
}
