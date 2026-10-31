export interface PublicUser {
  id: number;
  name: string;
  avatar: string;
}

export interface RegionDTO {
  id: number; order: number; slug: string; name: string; theme: string;
  status: "locked" | "current" | "complete";
  correct: number; total: number; needed: number; // homework progress toward unlocking the next stop
}
export interface ExerciseDTO {
  id: number; type: "multiple_choice" | "fill_blank"; prompt: string;
  options: string[] | null; points: number; done: boolean; gotCorrect: boolean;
}
export interface LessonDTO {
  id: number; kind: "dialogue" | "homework" | "grammar"; title: string; body: unknown;
  exercises: ExerciseDTO[];
}
// Shapes stored in a lesson's `body` (dialogue / grammar). Rendered by the Stop screen.
export interface DialogueBody { lines: { who: string; es: string; en: string }[]; }
export interface GrammarBody { intro?: string; points: { es: string; en: string }[]; }
export interface VocabDTO { es: string; en: string; example: string | null; }
export interface AttemptResult { correct: boolean; awarded: number; correctAnswer: string; }
export interface LeaderboardRow { userId: number; name: string; avatar: string; points: number; }
export interface StreakDTO { current: number; longest: number; }
export interface AgendaStepDTO { minutes: number; title: string; instructions: string; }
export interface EarnedBadge { code: string; name: string; emoji: string; description: string; }
export interface BadgeDTO { code: string; name: string; emoji: string; description: string; earned: boolean; earnedAt: number | null; }
export interface SchoolSessionDTO { id: number; order: number; agenda: AgendaStepDTO[]; }
export interface SchoolCurrentDTO { regionName: string; sessions: SchoolSessionDTO[]; }

// --- Daily side quests --------------------------------------------------------
// A vocab_blast question never carries its answerIndex before completion — the
// server strips it. word_of_day payload carries the vocab word + example.
export interface VocabBlastQuestion { prompt: string; options: string[]; }
export interface VocabBlastPayload { questions: VocabBlastQuestion[]; }
export interface WordOfDayPayload { es: string; en: string; example: string | null; }
export interface RoleplayPayload { title: string; scenario: string; }
export interface SideQuestDTO {
  id: number;
  type: "vocab_blast" | "word_of_day" | "roleplay";
  points: number;
  done: boolean;
  payload: VocabBlastPayload | WordOfDayPayload | RoleplayPayload;
}
export interface QuestResult {
  awarded: number;
  multiplier: number;
  alreadyDone?: boolean;
  results?: { correct: boolean; answerIndex: number }[];
}

// --- El Reto (live buzzer quiz) wire protocol ---------------------------------
// Mirrors the server's LiveEvent union (server/src/live/room.ts). The question
// event never carries correctIndex — the client only learns it on reveal.
export interface LivePlayerDTO { userId: number; name: string; avatar: string; }
export interface LiveRoundRow { userId: number; points: number; ms: number; correct: boolean; }
export interface LiveTotalRow { userId: number; name: string; avatar: string; points: number; }

export type LiveServerEvent =
  | { t: "lobby"; hostUserId: number; players: LivePlayerDTO[] }
  | { t: "question"; index: number; total: number; questionId: number; prompt: string; options: string[]; timeLimitMs: number }
  | { t: "answered"; userId: number }
  | { t: "reveal"; correctIndex: number; round: LiveRoundRow[]; totals: LiveTotalRow[] }
  | { t: "end"; podium: LiveTotalRow[] }
  | { t: "error"; message: string };

export type LiveClientMsg =
  | { t: "enter"; regionId: number }
  | { t: "host:reset"; regionId: number }
  | { t: "host:create"; regionId: number }
  | { t: "join" }
  | { t: "host:start" }
  | { t: "host:next" }
  | { t: "host:reveal" }
  | { t: "answer"; index: number };
