import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  LiveClientMsg,
  LivePlayerDTO,
  LiveServerEvent,
  LiveTotalRow,
} from "@shared/types";

export type LiveStatus = "connecting" | "lobby" | "question" | "reveal" | "ended";

export type LiveQuestion = Extract<LiveServerEvent, { t: "question" }>;
export type LiveReveal = Extract<LiveServerEvent, { t: "reveal" }>;

export interface LiveActions {
  enter: (regionId: number) => void;
  reset: (regionId: number) => void;
  create: (regionId: number) => void;
  join: () => void;
  start: () => void;
  next: () => void;
  reveal: () => void;
  answer: (index: number) => void;
}

export interface LiveGame {
  connected: boolean;
  status: LiveStatus;
  hostUserId: number;
  players: LivePlayerDTO[];
  question: LiveQuestion | null;
  answeredUserIds: number[];
  reveal: LiveReveal | null;
  podium: LiveTotalRow[];
  error: string | null;
  actions: LiveActions;
}

function wsUrl(): string {
  const scheme = location.protocol === "https:" ? "wss" : "ws";
  return `${scheme}://${location.host}/api/live/ws`;
}

/**
 * Owns a single live-game WebSocket. Opens on mount, closes on unmount, and keeps
 * derived state in sync with the server's event stream. Outgoing messages are queued
 * until the socket is OPEN so a screen can call create()/join() immediately on mount.
 */
export function useLiveGame(): LiveGame {
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState<LiveStatus>("connecting");
  const [hostUserId, setHostUserId] = useState(0);
  const [players, setPlayers] = useState<LivePlayerDTO[]>([]);
  const [question, setQuestion] = useState<LiveQuestion | null>(null);
  const [answeredUserIds, setAnsweredUserIds] = useState<number[]>([]);
  const [reveal, setReveal] = useState<LiveReveal | null>(null);
  const [podium, setPodium] = useState<LiveTotalRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const queueRef = useRef<LiveClientMsg[]>([]);

  const sendMsg = useCallback((msg: LiveClientMsg) => {
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(msg));
    } else {
      queueRef.current.push(msg);
    }
  }, []);

  useEffect(() => {
    const socket = new WebSocket(wsUrl());
    socketRef.current = socket;

    socket.onopen = () => {
      setConnected(true);
      const queued = queueRef.current;
      queueRef.current = [];
      for (const msg of queued) socket.send(JSON.stringify(msg));
    };

    socket.onclose = () => setConnected(false);

    socket.onmessage = (ev: MessageEvent) => {
      let event: LiveServerEvent;
      try {
        event = JSON.parse(String(ev.data)) as LiveServerEvent;
      } catch {
        return;
      }
      switch (event.t) {
        case "lobby":
          setStatus("lobby");
          setHostUserId(event.hostUserId);
          setPlayers(event.players);
          setError(null);
          break;
        case "question":
          setStatus("question");
          setQuestion(event);
          setAnsweredUserIds([]);
          setReveal(null);
          setError(null);
          break;
        case "answered":
          setAnsweredUserIds((prev) => (prev.includes(event.userId) ? prev : [...prev, event.userId]));
          break;
        case "reveal":
          setStatus("reveal");
          setReveal(event);
          break;
        case "end":
          setStatus("ended");
          setPodium(event.podium);
          break;
        case "error":
          setError(event.message);
          break;
      }
    };

    return () => {
      socketRef.current = null;
      socket.close();
    };
  }, []);

  const enter = useCallback((regionId: number) => sendMsg({ t: "enter", regionId }), [sendMsg]);
  const reset = useCallback((regionId: number) => sendMsg({ t: "host:reset", regionId }), [sendMsg]);
  const create = useCallback((regionId: number) => sendMsg({ t: "host:create", regionId }), [sendMsg]);
  const join = useCallback(() => sendMsg({ t: "join" }), [sendMsg]);
  const start = useCallback(() => sendMsg({ t: "host:start" }), [sendMsg]);
  const next = useCallback(() => sendMsg({ t: "host:next" }), [sendMsg]);
  const revealAction = useCallback(() => sendMsg({ t: "host:reveal" }), [sendMsg]);
  const answer = useCallback((index: number) => sendMsg({ t: "answer", index }), [sendMsg]);

  const actions = useMemo<LiveActions>(
    () => ({ enter, reset, create, join, start, next, reveal: revealAction, answer }),
    [enter, reset, create, join, start, next, revealAction, answer],
  );

  return {
    connected,
    status,
    hostUserId,
    players,
    question,
    answeredUserIds,
    reveal,
    podium,
    error,
    actions,
  };
}
