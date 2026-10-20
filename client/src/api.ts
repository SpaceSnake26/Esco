import type {
  AttemptResult,
  BadgeDTO,
  LeaderboardRow,
  LessonDTO,
  PublicUser,
  QuestResult,
  RegionDTO,
  SchoolCurrentDTO,
  SideQuestDTO,
  StreakDTO,
  VocabDTO,
} from "@shared/types";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? res.statusText);
  return res.json() as Promise<T>;
}

export const api = {
  profiles: () => fetch("/api/profiles").then((r) => json<PublicUser[]>(r)),
  login: (userId: number, pin: string) =>
    fetch("/api/auth/login", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId, pin }),
    }).then((r) => json<PublicUser>(r)),
  me: () => fetch("/api/me").then((r) => json<PublicUser>(r)),
  logout: () => fetch("/api/auth/logout", { method: "POST" }).then((r) => json<{ ok: true }>(r)),
  regions: () => fetch("/api/regions").then((r) => json<RegionDTO[]>(r)),
  region: (id: number) => fetch(`/api/regions/${id}`).then((r) => json<{ lessons: LessonDTO[] }>(r)),
  vocab: (id: number) => fetch(`/api/regions/${id}/vocab`).then((r) => json<VocabDTO[]>(r)),
  attempt: (exerciseId: number, answer: string) =>
    fetch("/api/attempts", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ exerciseId, answer }),
    }).then((r) => json<AttemptResult>(r)),
  leaderboard: () => fetch("/api/leaderboard").then((r) => json<LeaderboardRow[]>(r)),
  streak: () => fetch("/api/streak").then((r) => json<StreakDTO>(r)),
  badges: () => fetch("/api/badges").then((r) => json<BadgeDTO[]>(r)),
  school: () => fetch("/api/school/current").then((r) => json<SchoolCurrentDTO>(r)),
  completeSchool: (id: number, presentUserIds: number[]) =>
    fetch(`/api/school/${id}/complete`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ presentUserIds }),
    }).then((r) => json<{ awarded: { userId: number; points: number }[] }>(r)),
  questsToday: () => fetch("/api/quests/today").then((r) => json<SideQuestDTO[]>(r)),
  completeQuest: (id: number, answers?: number[]) =>
    fetch(`/api/quests/${id}/complete`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ answers }),
    }).then((r) => json<QuestResult>(r)),
  pablito: (messages: { role: "user" | "assistant"; content: string }[], scenario?: string) =>
    fetch("/api/pablito/chat", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages, scenario }),
    }).then((r) => json<{ reply: string; degraded?: boolean }>(r)),
};
