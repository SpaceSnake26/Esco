import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { AttemptResult, ExerciseDTO, LessonDTO } from "@shared/types";
import { api } from "../api";
import { BottomNav } from "../components/BottomNav";

export function Homework() {
  const regions = useQuery({ queryKey: ["regions"], queryFn: api.regions });
  const current = regions.data?.find((r) => r.status === "current");
  const region = useQuery({
    queryKey: ["region", current?.id], enabled: !!current,
    queryFn: () => api.region(current!.id),
  });
  const homeworks = (region.data?.lessons ?? []).filter((l) => l.kind === "homework");
  const allEx = homeworks.flatMap((l) => l.exercises);
  const done = allEx.filter((e) => e.done).length;

  return (
    <div style={{ fontFamily: "system-ui", minHeight: "100dvh", background: "#FFF9E6", display: "flex", flexDirection: "column" }}>
      <header style={{ background: "#FFD21E", padding: 14 }}>
        <strong style={{ color: "#0a6e5c" }}>📚 Homework — {current?.name ?? ""}</strong>
        {allEx.length > 0 && (
          <div style={{ marginTop: 6 }}>
            <div style={{ fontSize: 12, color: "#0a6e5c", fontWeight: 700 }}>
              {done}/{allEx.length} done · unlock the next stop at {Math.ceil(allEx.length * 0.8)}
            </div>
            <div style={{ height: 8, background: "rgba(10,110,92,0.15)", borderRadius: 999, marginTop: 4 }}>
              <div style={{ height: 8, width: `${allEx.length ? (done / allEx.length) * 100 : 0}%`,
                background: "#58CC02", borderRadius: 999, transition: "width .3s" }} />
            </div>
          </div>
        )}
      </header>
      <main style={{ flex: 1, padding: 14, display: "grid", gap: 18 }}>
        {homeworks.map((lesson) => <HomeworkSet key={lesson.id} lesson={lesson} />)}
        {region.data && homeworks.length === 0 && <p style={{ color: "#888" }}>No homework here yet.</p>}
      </main>
      <BottomNav />
    </div>
  );
}

function HomeworkSet({ lesson }: { lesson: LessonDTO }) {
  const done = lesson.exercises.filter((e) => e.done).length;
  return (
    <section style={{ display: "grid", gap: 10 }}>
      <div style={{ fontWeight: 800, color: "#0a6e5c", display: "flex", justifyContent: "space-between" }}>
        <span>{lesson.title}</span>
        <span style={{ fontSize: 12, color: "#888" }}>{done}/{lesson.exercises.length}</span>
      </div>
      {lesson.exercises.map((ex) => <ExerciseCard key={ex.id} ex={ex} />)}
    </section>
  );
}

function ExerciseCard({ ex }: { ex: ExerciseDTO }) {
  const qc = useQueryClient();
  const [value, setValue] = useState("");
  const [result, setResult] = useState<AttemptResult | null>(null);

  // Already answered in a previous session (from the server) or just now.
  const answered = ex.done || result !== null;

  async function submit(answer: string) {
    const r = await api.attempt(ex.id, answer);
    setResult(r);
    // Points and completion may have changed: refresh leaderboard + region progress.
    qc.invalidateQueries({ queryKey: ["leaderboard"] });
    qc.invalidateQueries({ queryKey: ["region"] });
    qc.invalidateQueries({ queryKey: ["regions"] });
  }

  return (
    <section style={{ background: "#fff", borderRadius: 14, padding: 14, opacity: answered && !result ? 0.75 : 1 }}>
      <p style={{ fontWeight: 600 }}>{ex.prompt}</p>
      {ex.type === "multiple_choice" && ex.options?.map((o) => (
        <button key={o} onClick={() => submit(o)} disabled={answered}
          style={{ display: "block", width: "100%", padding: 12, margin: "6px 0" }}>{o}</button>
      ))}
      {ex.type === "fill_blank" && !answered && (
        <div style={{ display: "flex", gap: 8 }}>
          <input aria-label="answer" value={value} onChange={(e) => setValue(e.target.value)} style={{ flex: 1, padding: 10 }} />
          <button onClick={() => submit(value)} disabled={!value.trim()}>OK</button>
        </div>
      )}
      {result ? (
        <p style={{ color: result.correct ? "#2e7d32" : "crimson", fontWeight: 700 }}>
          {result.correct ? `Correct! +${result.awarded}` : `Almost — it was "${result.correctAnswer}"`}
        </p>
      ) : ex.done ? (
        <p style={{ color: ex.gotCorrect ? "#2e7d32" : "#888", fontWeight: 700 }}>
          {ex.gotCorrect ? "✓ Already answered (correct)" : "✓ Already answered"}
        </p>
      ) : null}
    </section>
  );
}
