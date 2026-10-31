import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { AttemptResult, ExerciseDTO, LessonDTO } from "@shared/types";
import { api } from "../api";
import { BottomNav } from "../components/BottomNav";

export function Homework() {
  const [params] = useSearchParams();
  const regions = useQuery({ queryKey: ["regions"], queryFn: api.regions });
  const firstOpen = regions.data?.find((r) => r.status === "current");
  // ?stop=<id> opens an already-unlocked stop, so finished stops can still be 100%'d.
  const asked = regions.data?.find((r) => r.id === Number(params.get("stop")) && r.status !== "locked");

  // Stay on the stop being worked on when it crosses the unlock line mid-page.
  const [pinned, setPinned] = useState<number | null>(null);
  useEffect(() => { if (pinned === null && firstOpen && !asked) setPinned(firstOpen.id); }, [pinned, firstOpen, asked]);
  const current = asked ?? regions.data?.find((r) => r.id === pinned) ?? firstOpen;
  const nextUp = firstOpen && current && firstOpen.id !== current.id ? firstOpen : null;

  const region = useQuery({
    queryKey: ["region", current?.id], enabled: !!current,
    queryFn: () => api.region(current!.id),
  });
  const homeworks = (region.data?.lessons ?? []).filter((l) => l.kind === "homework");

  return (
    <div style={{ fontFamily: "system-ui", minHeight: "100dvh", background: "#FFF9E6", display: "flex", flexDirection: "column" }}>
      <header style={{ background: "#FFD21E", padding: 14 }}>
        <strong style={{ color: "#0a6e5c" }}>📚 Homework — {current?.name ?? ""}</strong>
        {current && current.total > 0 && (
          <div style={{ marginTop: 6 }}>
            <div style={{ fontSize: 12, color: "#0a6e5c", fontWeight: 700 }}>
              {current.correct}/{current.total} correct · next stop unlocks at {current.needed}
            </div>
            <div style={{ height: 8, background: "rgba(10,110,92,0.15)", borderRadius: 999, marginTop: 4 }}>
              <div style={{ height: 8, width: `${(current.correct / current.total) * 100}%`,
                background: "#58CC02", borderRadius: 999, transition: "width .3s" }} />
            </div>
          </div>
        )}
      </header>
      {nextUp && (
        <Link to={`/stop/${nextUp.id}`} style={{ display: "block", background: "#58CC02", color: "#fff", padding: 14, fontWeight: 800, textDecoration: "none", textAlign: "center" }}>
          🎉 {nextUp.name} is unlocked! Tap to open →
        </Link>
      )}
      <main style={{ flex: 1, padding: 14, display: "grid", gap: 18 }}>
        {homeworks.map((lesson) => <HomeworkSet key={lesson.id} lesson={lesson} />)}
        {region.data && homeworks.length === 0 && <p style={{ color: "#888" }}>No homework here yet.</p>}
      </main>
      <BottomNav />
    </div>
  );
}

function HomeworkSet({ lesson }: { lesson: LessonDTO }) {
  const done = lesson.exercises.filter((e) => e.gotCorrect).length;
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

  // Locked only once correct. A wrong answer can be retried: it earns no points (no
  // farming) but still counts toward unlocking the next stop.
  const solved = result ? result.correct : ex.gotCorrect;
  const missed = !solved && (ex.done || result !== null);

  async function submit(answer: string) {
    const r = await api.attempt(ex.id, answer);
    setResult(r);
    if (!r.correct) setValue("");
    // Points and completion may have changed: refresh leaderboard + region progress.
    qc.invalidateQueries({ queryKey: ["leaderboard"] });
    qc.invalidateQueries({ queryKey: ["region"] });
    qc.invalidateQueries({ queryKey: ["regions"] });
  }

  return (
    <section style={{ background: "#fff", borderRadius: 14, padding: 14, opacity: solved && !result ? 0.75 : 1 }}>
      <p style={{ fontWeight: 600 }}>{ex.prompt}</p>
      {ex.type === "multiple_choice" && ex.options?.map((o) => (
        <button key={o} onClick={() => submit(o)} disabled={solved}
          style={{ display: "block", width: "100%", padding: 12, margin: "6px 0" }}>{o}</button>
      ))}
      {ex.type === "fill_blank" && !solved && (
        <div style={{ display: "flex", gap: 8 }}>
          <input aria-label="answer" value={value} onChange={(e) => setValue(e.target.value)} style={{ flex: 1, padding: 10 }} />
          <button onClick={() => submit(value)} disabled={!value.trim()}>OK</button>
        </div>
      )}
      {solved ? (
        <p style={{ color: "#2e7d32", fontWeight: 700 }}>
          {result?.correct ? (result.awarded > 0 ? `Correct! +${result.awarded}` : "Correct! Counts toward the unlock ✓") : "✓ Already answered (correct)"}
        </p>
      ) : missed ? (
        <p style={{ color: "crimson", fontWeight: 700 }}>
          {result ? `Almost — it was "${result.correctAnswer}". ` : ""}Try again: no points, but it counts toward the unlock.
        </p>
      ) : null}
    </section>
  );
}
