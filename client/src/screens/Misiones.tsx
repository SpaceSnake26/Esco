import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import type { QuestResult, RoleplayPayload, SideQuestDTO, VocabBlastPayload, WordOfDayPayload } from "@shared/types";
import { api } from "../api";
import { BottomNav } from "../components/BottomNav";

export function Misiones() {
  const quests = useQuery({ queryKey: ["quests"], queryFn: api.questsToday });

  return (
    <div style={{ fontFamily: "system-ui", minHeight: "100dvh", background: "#FFF9E6", display: "flex", flexDirection: "column" }}>
      <header style={{ background: "#FFD21E", padding: 14 }}>
        <strong style={{ color: "#0a6e5c" }}>🎯 Today's mission</strong>
      </header>
      <main style={{ flex: 1, padding: 14, display: "grid", gap: 14 }}>
        {quests.data?.map((q) =>
          q.type === "vocab_blast"
            ? <VocabBlastCard key={q.id} quest={q} />
            : q.type === "roleplay"
              ? <RoleplayCard key={q.id} quest={q} />
              : <WordOfDayCard key={q.id} quest={q} />)}
        {quests.isError ? <p>Couldn't load missions.</p> : null}
      </main>
      <div style={{ padding: "0 14px 10px" }}>
        <Link to="/" style={{ fontSize: 13, color: "#0a6e5c", textDecoration: "none" }}>← Home</Link>
      </div>
      <BottomNav />
    </div>
  );
}

function useComplete() {
  const qc = useQueryClient();
  return async (id: number, answers?: number[]): Promise<QuestResult> => {
    const r = await api.completeQuest(id, answers);
    qc.invalidateQueries({ queryKey: ["quests"] });
    qc.invalidateQueries({ queryKey: ["leaderboard"] });
    qc.invalidateQueries({ queryKey: ["streak"] });
    return r;
  };
}

function VocabBlastCard({ quest }: { quest: SideQuestDTO }) {
  const complete = useComplete();
  const { questions } = quest.payload as VocabBlastPayload;
  const [picks, setPicks] = useState<(number | null)[]>(() => questions.map(() => null));
  const [result, setResult] = useState<QuestResult | null>(null);

  const allPicked = picks.every((p) => p !== null);
  const done = quest.done || result !== null;

  async function submit() {
    const r = await complete(quest.id, picks.map((p) => p ?? -1));
    setResult(r);
  }

  return (
    <section style={{ background: "#fff", borderRadius: 14, padding: 14 }}>
      <div style={{ fontSize: 12, color: "#0a6e5c", fontWeight: 700 }}>⚡ Vocab Blast · {quest.points} pts</div>
      {quest.done && !result ? <p style={{ color: "#2e7d32", fontWeight: 700 }}>✓ Completed today</p> : null}
      {!done && questions.map((qq, qi) => (
        <div key={qi} style={{ margin: "10px 0" }}>
          <p style={{ fontWeight: 600 }}>{qi + 1}. {qq.prompt}</p>
          {qq.options.map((o, oi) => (
            <button key={oi} type="button"
              aria-pressed={picks[qi] === oi}
              onClick={() => setPicks((prev) => prev.map((p, i) => (i === qi ? oi : p)))}
              style={{
                display: "block", width: "100%", padding: 12, margin: "6px 0", borderRadius: 10,
                border: picks[qi] === oi ? "2px solid #0a6e5c" : "1px solid #ddd",
                background: picks[qi] === oi ? "#eafaf3" : "#fff",
              }}>{o}</button>
          ))}
        </div>
      ))}
      {!done ? (
        <button type="button" onClick={submit} disabled={!allPicked}
          style={{ width: "100%", padding: 12, borderRadius: 10, background: allPicked ? "#e21b3c" : "#f3b8c1", color: "#fff", fontWeight: 700, border: "none" }}>
          Submit answers
        </button>
      ) : null}
      {result ? (
        <div style={{ marginTop: 10 }}>
          <p style={{ color: "#2e7d32", fontWeight: 700 }}>
            {result.alreadyDone ? "Already completed." : `+${result.awarded} ⚡`}
          </p>
          {result.results?.map((r, i) => (
            <p key={i} style={{ color: r.correct ? "#2e7d32" : "crimson", fontSize: 13 }}>
              {i + 1}. {r.correct ? "✓ Correct" : `✗ Was option ${r.answerIndex + 1}`}
            </p>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function RoleplayCard({ quest }: { quest: SideQuestDTO }) {
  const { title, scenario } = quest.payload as RoleplayPayload;
  const to = `/charlar?scenario=${encodeURIComponent(scenario)}&quest=${quest.id}`;
  return (
    <section style={{ background: "#fff", borderRadius: 14, padding: 14 }}>
      <div style={{ fontSize: 12, color: "#0a6e5c", fontWeight: 700 }}>🎭 Roleplay · {quest.points} pts</div>
      <h2 style={{ margin: "6px 0" }}>{title}</h2>
      <p style={{ color: "#555" }}>{scenario}</p>
      {quest.done ? (
        <p style={{ color: "#2e7d32", fontWeight: 700 }}>✓ Completed today</p>
      ) : (
        <Link to={to}
          style={{ display: "block", textAlign: "center", padding: 12, borderRadius: 10, background: "#0a6e5c", color: "#fff", fontWeight: 700, textDecoration: "none" }}>
          🦜 Chat with Pablito (+{quest.points})
        </Link>
      )}
    </section>
  );
}

function WordOfDayCard({ quest }: { quest: SideQuestDTO }) {
  const complete = useComplete();
  const word = quest.payload as WordOfDayPayload;
  const [result, setResult] = useState<QuestResult | null>(null);
  const done = quest.done || result !== null;

  async function learn() {
    setResult(await complete(quest.id));
  }

  return (
    <section style={{ background: "#fff", borderRadius: 14, padding: 14 }}>
      <div style={{ fontSize: 12, color: "#0a6e5c", fontWeight: 700 }}>📖 Word of the day · {quest.points} pts</div>
      <h2 style={{ margin: "6px 0" }}>{word.es}</h2>
      <p style={{ color: "#555" }}>{word.en}</p>
      {word.example ? <p style={{ fontStyle: "italic", color: "#888" }}>“{word.example}”</p> : null}
      {done ? (
        <p style={{ color: "#2e7d32", fontWeight: 700 }}>
          {result && !result.alreadyDone ? `Learned! +${result.awarded}` : "✓ Completed today"}
        </p>
      ) : (
        <button type="button" onClick={learn}
          style={{ width: "100%", padding: 12, borderRadius: 10, background: "#0a6e5c", color: "#fff", fontWeight: 700, border: "none" }}>
          Learned! (+{quest.points})
        </button>
      )}
    </section>
  );
}
