import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { PublicUser, QuestResult } from "@shared/types";
import { api } from "../api";
import { BottomNav } from "../components/BottomNav";

interface Msg { role: "user" | "assistant"; content: string }

const OFFLINE = "⚠️ Pablito is offline (practice mode) — he'll chat for real once the AI is back.";

export function Charlar({ user }: { user: PublicUser }) {
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const scenario = params.get("scenario") ?? undefined;
  const questId = params.get("quest");

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  const [claim, setClaim] = useState<QuestResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const userTurns = messages.filter((m) => m.role === "user").length;
  const canClaim = !!scenario && !!questId && userTurns >= 3 && !claim;

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const r = await api.pablito(next, scenario);
      setMessages([...next, { role: "assistant", content: r.reply }]);
      setOffline(!!r.degraded);
    } catch {
      // Network/other error: keep the chat alive with a local practice line.
      setMessages([...next, { role: "assistant", content: "¡Sigue practicando en español! 🦜" }]);
      setOffline(true);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  async function claimReward() {
    if (!questId || claim) return;
    const r = await api.completeQuest(Number(questId));
    setClaim(r);
    qc.invalidateQueries({ queryKey: ["quests"] });
    qc.invalidateQueries({ queryKey: ["leaderboard"] });
    qc.invalidateQueries({ queryKey: ["streak"] });
  }

  return (
    <div style={{ fontFamily: "system-ui", minHeight: "100dvh", background: "#FFF9E6", display: "flex", flexDirection: "column" }}>
      <header style={{ background: "#FFD21E", padding: 14 }}>
        <strong style={{ color: "#0a6e5c" }}>🦜 Chat with Pablito</strong>
        {scenario ? <div style={{ fontSize: 12, color: "#0a6e5c", marginTop: 4 }}>🎭 {scenario}</div> : null}
      </header>

      <main style={{ flex: 1, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.length === 0 ? (
          <p style={{ color: "#888" }}>Hi, {user.name}! Write something to Pablito in Spanish. 🦜</p>
        ) : null}
        {messages.map((m, i) => (
          <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "80%" }}>
            <div style={{
              background: m.role === "user" ? "#0a6e5c" : "#fff",
              color: m.role === "user" ? "#fff" : "#333",
              padding: "10px 14px", borderRadius: 14,
            }}>
              {m.role === "assistant" ? <span aria-hidden>🦜 </span> : null}{m.content}
            </div>
          </div>
        ))}
        {busy ? <div style={{ color: "#888", fontStyle: "italic" }}>Pablito is thinking…</div> : null}
        {offline ? <div style={{ color: "#b26a00", fontWeight: 600, fontSize: 13 }}>{OFFLINE}</div> : null}

        {canClaim ? (
          <button type="button" onClick={claimReward}
            style={{ padding: 12, borderRadius: 10, background: "#e21b3c", color: "#fff", fontWeight: 700, border: "none" }}>
            Finish & claim (+30)
          </button>
        ) : null}
        {claim ? (
          <div style={{ color: "#2e7d32", fontWeight: 700 }}>
            {claim.alreadyDone ? "Already claimed today ✓" : `Mission complete! +${claim.awarded} ⚡`}
          </div>
        ) : null}
      </main>

      <div style={{ padding: 14, display: "flex", gap: 8 }}>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          placeholder="Type in Spanish…"
          aria-label="Message for Pablito"
          style={{ flex: 1, padding: 12, borderRadius: 10, border: "1px solid #ddd" }}
        />
        <button type="button" onClick={send} disabled={busy || !input.trim()}
          style={{ padding: "12px 18px", borderRadius: 10, background: "#0a6e5c", color: "#fff", fontWeight: 700, border: "none" }}>
          Send
        </button>
      </div>

      <div style={{ padding: "0 14px 10px" }}>
        <Link to="/" style={{ fontSize: 13, color: "#0a6e5c", textDecoration: "none" }}>← Home</Link>
      </div>
      <BottomNav />
    </div>
  );
}
