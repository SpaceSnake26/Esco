import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../api";
import { BottomNav } from "../components/BottomNav";

export function Logros() {
  const badges = useQuery({ queryKey: ["badges"], queryFn: api.badges });
  const earnedCount = badges.data?.filter((b) => b.earned).length ?? 0;

  return (
    <div style={{ fontFamily: "system-ui", minHeight: "100dvh", background: "#FFF9E6", display: "flex", flexDirection: "column" }}>
      <header style={{ background: "#FFD21E", padding: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <strong style={{ color: "#0a6e5c" }}>🎖️ Badges</strong>
        {badges.data ? (
          <span style={{ fontSize: 13, fontWeight: 700, color: "#0a6e5c" }}>{earnedCount}/{badges.data.length}</span>
        ) : null}
      </header>
      <main style={{ flex: 1, padding: 14, display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, alignContent: "start" }}>
        {badges.data?.map((b) => (
          <div
            key={b.code}
            aria-label={b.earned ? `${b.name} (earned)` : `${b.name} (locked)`}
            style={{
              background: "#fff", borderRadius: 14, padding: 14, textAlign: "center",
              opacity: b.earned ? 1 : 0.45,
              filter: b.earned ? "none" : "grayscale(1)",
              border: b.earned ? "2px solid #FFD21E" : "2px solid #eee",
            }}
          >
            <div style={{ fontSize: 36 }} aria-hidden>{b.earned ? b.emoji : "🔒"}</div>
            <div style={{ fontWeight: 700, marginTop: 6, color: "#0a6e5c" }}>{b.name}</div>
            <div style={{ fontSize: 11, color: "#999", marginTop: 4 }}>{b.description}</div>
          </div>
        ))}
        {badges.isError ? <p>Couldn't load badges.</p> : null}
      </main>
      <div style={{ padding: "0 14px 10px" }}>
        <Link to="/" style={{ fontSize: 13, color: "#0a6e5c", textDecoration: "none" }}>← Home</Link>
      </div>
      <BottomNav />
    </div>
  );
}
