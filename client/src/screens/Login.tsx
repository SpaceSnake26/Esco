import { useEffect, useState } from "react";
import { api } from "../api";
import type { PublicUser } from "@shared/types";

export function Login({ onLoggedIn }: { onLoggedIn: (u: PublicUser) => void }) {
  const [profiles, setProfiles] = useState<PublicUser[]>([]);
  const [picked, setPicked] = useState<PublicUser | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { api.profiles().then(setProfiles).catch(() => setError("Couldn't load")); }, []);

  async function submit() {
    if (!picked) return;
    try { onLoggedIn(await api.login(picked.id, pin)); }
    catch { setError("Wrong PIN"); setPin(""); }
  }

  function onPinChange(value: string) {
    setPin(value);
    if (error) setError("");
  }

  return (
    <main style={{
      minHeight: "100dvh",
      backgroundImage: "linear-gradient(rgba(10,30,25,0.45), rgba(10,30,25,0.55)), url(/start.webp)",
      backgroundSize: "cover",
      backgroundPosition: "center",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
      fontFamily: "system-ui",
    }}>
      <div style={{
        width: "100%",
        maxWidth: 420,
        background: "rgba(255, 253, 247, 0.94)",
        borderRadius: 22,
        padding: 24,
        boxShadow: "0 12px 44px rgba(0,0,0,0.4)",
      }}>
        <h1 style={{ margin: "0 0 2px", fontSize: 30 }}>🦜 Spanish Quest</h1>
        <p style={{ margin: "0 0 18px", color: "#0a6e5c", fontWeight: 700 }}>Heading to Colombia 🇨🇴</p>

        {!picked ? (
          <>
            <p style={{ fontSize: 16, color: "#444" }}>Who are you?</p>
            {profiles.map((p) => (
              <button
                key={p.id}
                onClick={() => setPicked(p)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  width: "100%", padding: "16px 18px", margin: "10px 0",
                  fontSize: 24, fontWeight: 700, color: "#143b33",
                  background: "#fff", border: "2px solid #0a6e5c33",
                  borderRadius: 14, cursor: "pointer",
                }}
              >
                <span style={{ fontSize: 30 }}>{p.avatar}</span>{p.name}
              </button>
            ))}
          </>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <p style={{ fontSize: 18, fontWeight: 600 }}>
              <span style={{ fontSize: 26 }}>{picked.avatar}</span> PIN for {picked.name}
            </p>
            <input
              inputMode="numeric"
              type="password"
              aria-label="PIN"
              value={pin}
              onChange={(e) => onPinChange(e.target.value)}
              maxLength={6}
              style={{ fontSize: 26, letterSpacing: 6, padding: 12, width: "100%", boxSizing: "border-box", borderRadius: 12, border: "2px solid #0a6e5c55" }}
              autoFocus
            />
            <button type="submit" style={{ padding: 14, marginTop: 14, width: "100%", fontSize: 18, fontWeight: 700, background: "#58CC02", color: "#fff", border: 0, borderRadius: 12, cursor: "pointer" }}>Enter</button>
            <button type="button" onClick={() => { setPicked(null); setPin(""); setError(""); }} style={{ padding: 10, marginTop: 8, width: "100%", background: "transparent", border: 0, color: "#555", cursor: "pointer" }}>← back</button>
          </form>
        )}
        {error && <p style={{ color: "crimson", fontWeight: 600 }}>{error}</p>}
      </div>
    </main>
  );
}
