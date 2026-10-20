import websocket from "@fastify/websocket";
import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";
import { LiveRoom, type LiveEvent } from "./room.js";

// One shared in-memory room + the connected sockets (socket → userId). Module-scoped
// singletons so every websocket connection drives the SAME game, which is the whole
// point of "El Reto" — the three players share one live room.
const room = new LiveRoom();
const sockets = new Map<WebSocket, number>();

// Client→server message shapes we accept over the socket.
interface InMsg {
  t: string;
  regionId?: number;
  index?: number;
}

export async function liveRoutes(app: FastifyInstance) {
  await app.register(websocket);

  function send(socket: WebSocket, ev: LiveEvent) {
    if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(ev));
  }

  function broadcast(ev: LiveEvent) {
    const payload = JSON.stringify(ev);
    for (const s of sockets.keys()) {
      if (s.readyState === s.OPEN) s.send(payload);
    }
  }

  // A room action's result: errors go only to the caller; real events to everyone.
  function result(socket: WebSocket, ev: LiveEvent) {
    if (ev.t === "error") send(socket, ev);
    else broadcast(ev);
  }

  app.get("/api/live/ws", { websocket: true }, async (socket, req) => {
    // Authenticate off the upgrade request's `token` cookie (the jwt cookie plugin
    // reads it). Reject anonymous sockets outright — no live game without a user.
    try {
      await req.jwtVerify();
    } catch {
      socket.close();
      return;
    }
    const userId = req.user.id;
    sockets.set(socket, userId);

    // A (re)connecting socket immediately sees whatever is happening now, so a
    // dropped phone rejoining mid-game lands straight back in the action.
    if (room.hostUserId !== 0) send(socket, room.syncEvent());

    socket.on("close", () => {
      sockets.delete(socket);
    });

    socket.on("message", (raw: unknown) => {
      let msg: InMsg;
      try {
        msg = JSON.parse(String(raw)) as InMsg;
      } catch {
        send(socket, { t: "error", message: "Malformed message." });
        return;
      }

      switch (msg.t) {
        // Create-or-join in one step: if there is no live game yet (fresh or ended),
        // THIS user starts one and is added as a player; otherwise just join. This is
        // what makes El Reto foolproof — everyone taps the same button, no "host" URL.
        case "enter": {
          // No game yet, or the last one ended → THIS user starts a fresh room.
          if (room.hostUserId === 0 || room.status === "ended") {
            const ev = room.create(userId, msg.regionId ?? 0);
            if (ev.t === "error") { send(socket, ev); break; }
            broadcast(room.join(userId));
          } else if (room.status === "lobby") {
            broadcast(room.join(userId)); // still gathering → update the lobby for all
          } else {
            // A game is in progress: add this player quietly and sync ONLY them to
            // the live question — never yank everyone else back to the lobby.
            room.join(userId);
            send(socket, room.syncEvent());
          }
          break;
        }
        case "host:create":
          if (room.status === "question" || room.status === "reveal") {
            send(socket, { t: "error", message: "A game is already in progress." });
          } else {
            result(socket, room.create(userId, msg.regionId ?? 0));
          }
          break;
        case "join":
          broadcast(room.join(userId));
          break;
        // Anyone in the room can drive the game (3 cooperating friends). Pressing
        // Start is ALWAYS safe: from the lobby it begins; if a game ended it starts
        // a fresh one; if one is already running the tapper is just resynced — the
        // "Game already started" dead-end can no longer happen.
        case "host:start": {
          if (room.status === "lobby") {
            broadcast(room.start());
          } else if (room.status === "ended" || room.hostUserId === 0) {
            const regionId = room.regionId || msg.regionId || 0;
            const ev = room.create(userId, regionId);
            if (ev.t === "error") { send(socket, ev); break; }
            room.join(userId);
            broadcast(room.start());
          } else {
            send(socket, room.syncEvent()); // already in progress → snap caller to it
          }
          break;
        }
        case "host:next":
          result(socket, room.next());
          break;
        case "host:reveal":
          if (room.status !== "question") {
            send(socket, { t: "error", message: "Nothing to reveal." });
          } else {
            broadcast(room.reveal());
          }
          break;
        case "answer": {
          const ev = room.answer(userId, msg.index ?? -1);
          if (ev.t === "error") {
            send(socket, ev);
          } else {
            broadcast(ev);
            if (room.allAnswered()) broadcast(room.reveal());
          }
          break;
        }
        default:
          send(socket, { t: "error", message: `Unknown message type: ${msg.t}` });
      }
    });
  });
}
