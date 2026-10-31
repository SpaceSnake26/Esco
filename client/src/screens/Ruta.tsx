import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../api";
import { BottomNav } from "../components/BottomNav";

const ICON = { complete: "✅", current: "🧭", locked: "🔒" } as const;

// The whole map is shown uncropped (so nothing like the Santa Marta pin is cut).
// On desktop the menu overlays the map under "JUNGLE ROADS"; on phones it stacks
// neatly below the map (where a tiny overlay would be unreadable).
const CSS = `
.route-wrap { position: relative; }
.route-img { display: block; width: 100%; height: auto; }
.route-menu {
  background: rgba(6,40,33,0.80); backdrop-filter: blur(3px);
  border-radius: 16px; padding: 14px; margin: 12px;
  display: grid; gap: 10px; align-content: start;
  box-shadow: 0 8px 26px rgba(0,0,0,0.45);
}
@media (min-width: 760px) {
  .route-menu {
    position: absolute; top: 35%; left: 20%;
    width: min(42%, 420px); max-height: 58%; overflow-y: auto; margin: 0;
  }
}
`;

export function Ruta() {
  const regions = useQuery({ queryKey: ["regions"], queryFn: api.regions });
  return (
    <div style={{ fontFamily: "system-ui", minHeight: "100dvh", background: "#0a6e5c", display: "flex", flexDirection: "column" }}>
      <style>{CSS}</style>
      <main className="route-wrap" style={{ flex: 1 }}>
        <img className="route-img" src="/route.webp" alt="Map of the Colombia route" />
        <div className="route-menu">
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 19, padding: "0 2px 4px", textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>
            🧭 Your route
          </div>
          {regions.data?.map((r, i) => {
            const prev = regions.data![i - 1];
            const inner = (
              <>
                <div style={{ fontSize: 24 }}>{ICON[r.status]}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ color: "#fff", fontSize: 17 }}>{r.order}. {r.name}</b>
                  <div style={{ fontSize: 13, color: "#e3f4ef" }}>{r.theme}</div>
                  {r.status === "locked" && prev && (
                    <div style={{ fontSize: 12, color: "#ffd0b0" }}>🔒 Get {prev.needed} correct in {prev.name}</div>
                  )}
                  {r.status === "current" && (
                    <div style={{ fontSize: 12, color: "#ffe08a", fontWeight: 700 }}>You're here · {r.correct}/{r.needed} correct to unlock next</div>
                  )}
                  {r.status === "complete" && (
                    <div style={{ fontSize: 12, color: "#aef0b8", fontWeight: 700 }}>Done · tap →</div>
                  )}
                </div>
              </>
            );
            const cardStyle = {
              display: "flex", gap: 10, alignItems: "center", borderRadius: 12,
              padding: "10px 11px", textDecoration: "none",
              background: r.status === "locked" ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.20)",
            } as const;
            return r.status === "locked" ? (
              <div key={r.id} style={{ ...cardStyle, opacity: 0.9 }}>{inner}</div>
            ) : (
              <Link key={r.id} to={`/stop/${r.id}`} style={cardStyle}>{inner}</Link>
            );
          })}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
