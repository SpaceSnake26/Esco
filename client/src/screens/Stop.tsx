import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import type { DialogueBody, GrammarBody, LessonDTO } from "@shared/types";
import { api } from "../api";
import { BottomNav } from "../components/BottomNav";

export function Stop() {
  const { id } = useParams();
  const regionId = Number(id);
  const regions = useQuery({ queryKey: ["regions"], queryFn: api.regions });
  const region = regions.data?.find((r) => r.id === regionId);
  const detail = useQuery({
    queryKey: ["region", regionId], enabled: Number.isFinite(regionId),
    queryFn: () => api.region(regionId),
  });

  const lessons = detail.data?.lessons ?? [];
  const dialogues = lessons.filter((l) => l.kind === "dialogue");
  const grammar = lessons.filter((l) => l.kind === "grammar");
  const hasHomework = lessons.some((l) => l.kind === "homework");
  const locked = region?.status === "locked";

  return (
    <div style={{ fontFamily: "system-ui", minHeight: "100dvh", background: "#FFF9E6", display: "flex", flexDirection: "column" }}>
      <header style={{ background: "#0a6e5c", color: "#fff", padding: 14 }}>
        <strong>{region ? `${region.order}. ${region.name}` : "Stop"}</strong>
        {region && <div style={{ fontSize: 12, opacity: 0.9 }}>{region.theme}</div>}
      </header>

      <main style={{ flex: 1, padding: 14, display: "grid", gap: 14 }}>
        {locked ? (
          <section style={{ background: "#fff", borderRadius: 14, padding: 16 }}>
            <p>🔒 This stop is locked. Finish the previous stop (80% of its homework) to open it.</p>
            <Link to="/ruta" style={{ color: "#0a6e5c", fontWeight: 700 }}>← Back to the route</Link>
          </section>
        ) : (
          <>
            {grammar.map((g) => <GrammarCard key={g.id} lesson={g} />)}
            {dialogues.map((d) => <DialogueCard key={d.id} lesson={d} />)}

            <section style={{ display: "grid", gap: 10 }}>
              <Link to="/escuchar" style={cardLink}>
                <span style={{ fontWeight: 700 }}>🔊 Listen & repeat</span>
                <span style={{ fontSize: 13, color: "#999" }}>Hear these words →</span>
              </Link>
              {hasHomework && (
                <Link to="/tarea" style={cardLink}>
                  <span style={{ fontWeight: 700 }}>📚 Homework</span>
                  <span style={{ fontSize: 13, color: "#999" }}>Practice & earn points →</span>
                </Link>
              )}
            </section>

            {lessons.length === 0 && !detail.isLoading && (
              <section style={{ background: "#fff", borderRadius: 14, padding: 16, color: "#555" }}>
                No lessons here yet.
              </section>
            )}
          </>
        )}
      </main>
      <BottomNav />
    </div>
  );
}

const cardLink = {
  background: "#fff", borderRadius: 14, padding: 14, textDecoration: "none", color: "#0a6e5c",
  display: "flex", alignItems: "center", justifyContent: "space-between",
} as const;

function GrammarCard({ lesson }: { lesson: LessonDTO }) {
  const body = lesson.body as GrammarBody | null;
  return (
    <section style={{ background: "#fff", borderRadius: 14, padding: 16 }}>
      <div style={{ fontSize: 12, color: "#0a6e5c", fontWeight: 700 }}>📝 Grammar</div>
      <h3 style={{ margin: "4px 0 8px" }}>{lesson.title}</h3>
      {body?.intro && <p style={{ fontSize: 14, color: "#444", marginTop: 0 }}>{body.intro}</p>}
      <div style={{ display: "grid", gap: 6 }}>
        {body?.points?.map((p, i) => (
          <div key={i} style={{ display: "flex", gap: 8, fontSize: 15 }}>
            <b style={{ color: "#0a3d33" }}>{p.es}</b>
            <span style={{ color: "#777" }}>— {p.en}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function DialogueCard({ lesson }: { lesson: LessonDTO }) {
  const body = lesson.body as DialogueBody | null;
  return (
    <section style={{ background: "#fff", borderRadius: 14, padding: 16 }}>
      <div style={{ fontSize: 12, color: "#0a6e5c", fontWeight: 700 }}>💬 Dialogue</div>
      <h3 style={{ margin: "4px 0 10px" }}>{lesson.title}</h3>
      <div style={{ display: "grid", gap: 10 }}>
        {body?.lines?.map((ln, i) => (
          <div key={i}>
            <div style={{ fontSize: 11, color: "#0a6e5c", fontWeight: 700 }}>{ln.who}</div>
            <div style={{ fontSize: 16, color: "#0a3d33" }}>{ln.es}</div>
            <div style={{ fontSize: 13, color: "#888" }}>{ln.en}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
