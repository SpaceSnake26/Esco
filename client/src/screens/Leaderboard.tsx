import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { BottomNav } from "../components/BottomNav";

export function Leaderboard() {
  const board = useQuery({ queryKey: ["leaderboard"], queryFn: api.leaderboard });
  return (
    <div style={{ fontFamily: "system-ui", minHeight: "100dvh", background: "#FFF9E6", display: "flex", flexDirection: "column" }}>
      <header style={{ background: "#FFD21E", padding: 14 }}><strong style={{ color: "#0a6e5c" }}>🏆 Leaderboard — Season</strong></header>
      <main style={{ flex: 1, padding: 14 }}>
        {board.data?.map((row, i) => (
          <div key={row.userId} style={{ display: "flex", justifyContent: "space-between", background: "#fff",
            borderRadius: 12, padding: 14, margin: "8px 0", fontSize: 18 }}>
            <span>{["🥇", "🥈", "🥉"][i] ?? `${i + 1}.`} {row.avatar} {row.name}</span>
            <b style={{ color: "#e8590c" }}>{row.points}</b>
          </div>
        ))}
        <p style={{ textAlign: "center", fontSize: 12, color: "#999" }}>Grand champion crowned 31 Jan 2027 🇨🇴</p>
      </main>
      <BottomNav />
    </div>
  );
}
