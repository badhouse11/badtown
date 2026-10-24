// One Durable Object per room. It is the single referee: every command for a room runs here,
// one at a time, and the full game state is saved to the object's built-in SQLite storage
// after every change. Sockets use the hibernation API, so idle rooms cost nothing.

import { addPlayer, applyCommand, maybeAdvance, newRoom, onDeadline } from "./engine/engine.ts";
import type { Command, GameState } from "./engine/types.ts";
import { viewFor } from "./engine/view.ts";

interface Attachment {
  pid: string | null;
  fails: number;
}

// Minimal shapes of the Cloudflare APIs we use (full types come from @cloudflare/workers-types).
interface Socket {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  serializeAttachment(value: unknown): void;
  deserializeAttachment(): any;
}
interface RoomCtx {
  storage: {
    get<T>(key: string): Promise<T | undefined>;
    put(key: string, value: unknown): Promise<void>;
    setAlarm(when: number): Promise<void>;
    deleteAlarm(): Promise<void>;
  };
  acceptWebSocket(ws: Socket): void;
  getWebSockets(): Socket[];
}

const MAX_MESSAGE = 4096;
const JOIN_LIMIT_PER_MINUTE = 30;

export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export class Room {
  ctx: RoomCtx;
  env: unknown;
  state: GameState | null = null;
  joins: number[] = [];
  lastChat = new Map<string, number>();

  constructor(ctx: RoomCtx, env: unknown) {
    this.ctx = ctx;
    this.env = env;
  }

  /** Load from storage once per wake-up, and work out who is really connected. */
  async load(): Promise<GameState | null> {
    if (!this.state) {
      this.state = (await this.ctx.storage.get<GameState>("state")) ?? null;
      if (this.state) {
        const live = new Set(this.sockets().map(([, a]) => a.pid).filter(Boolean));
        for (const p of this.state.players) p.connected = live.has(p.id);
      }
    }
    return this.state;
  }

  async save(): Promise<void> {
    if (!this.state) return;
    await this.ctx.storage.put("state", this.state);
    if (this.state.deadline) await this.ctx.storage.setAlarm(this.state.deadline);
    else await this.ctx.storage.deleteAlarm();
  }

  sockets(): [Socket, Attachment][] {
    return this.ctx.getWebSockets().map((ws) => [ws, (ws.deserializeAttachment() ?? { pid: null, fails: 0 }) as Attachment]);
  }

  send(ws: Socket, data: unknown): void {
    try {
      ws.send(JSON.stringify(data));
    } catch {
      /* socket already gone */
    }
  }

  /** Every connected player gets their own filtered view. Nothing else ever leaves the room. */
  broadcast(): void {
    if (!this.state) return;
    const serverNow = Date.now();
    for (const [ws, att] of this.sockets()) {
      if (att.pid) this.send(ws, { type: "STATE", serverNow, ...viewFor(this.state, att.pid) });
    }
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/+/, "");

    if (path === "init" && req.method === "POST") {
      if (await this.load()) return json({ error: "taken" }, 409);
      const { code } = (await req.json()) as { code: string };
      this.state = newRoom(code, Date.now());
      await this.save();
      return json({ code }, 201);
    }

    const state = await this.load();
    if (!state) return json({ error: "No room with that code." }, 404);

    if (path === "info") {
      return json({ code: state.code, phase: state.phase, players: state.players.length, max: state.settings.maxPlayers });
    }

    if (path === "join" && req.method === "POST") {
      const now = Date.now();
      this.joins = this.joins.filter((t) => now - t < 60_000);
      if (this.joins.length >= JOIN_LIMIT_PER_MINUTE) return json({ error: "Too many attempts. Wait a minute." }, 429);
      this.joins.push(now);
      let body: { name?: string } = {};
      try {
        body = await req.json();
      } catch {
        return json({ error: "Bad request." }, 400);
      }
      const id = crypto.randomUUID();
      const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
      const res = addPlayer(state, id, String(body.name ?? ""), await sha256(token));
      if (!res.ok) return json({ error: res.error }, 400);
      await this.save();
      this.broadcast();
      return json({ playerId: id, token, code: state.code });
    }

    if (path === "ws") {
      if (req.headers.get("Upgrade") !== "websocket") return json({ error: "Expected a WebSocket." }, 426);
      const pair = new (globalThis as any).WebSocketPair();
      const [client, server] = Object.values(pair) as [Socket, Socket];
      this.ctx.acceptWebSocket(server);
      server.serializeAttachment({ pid: null, fails: 0 } satisfies Attachment);
      return new Response(null, { status: 101, webSocket: client } as any);
    }

    return json({ error: "Not found." }, 404);
  }

  async webSocketMessage(ws: Socket, raw: string | ArrayBuffer): Promise<void> {
    const state = await this.load();
    if (!state) return ws.close(1011, "Room not found");
    if (typeof raw !== "string" || raw.length > MAX_MESSAGE) return this.send(ws, { type: "ERROR", error: "Message too large." });
    let msg: any;
    try {
      msg = JSON.parse(raw);
    } catch {
      return this.send(ws, { type: "ERROR", error: "Bad message." });
    }
    const att: Attachment = ws.deserializeAttachment() ?? { pid: null, fails: 0 };

    if (msg?.type === "HELLO") {
      const hash = await sha256(String(msg.token ?? ""));
      const p = state.players.find((x) => x.tokenHash === hash);
      if (!p) {
        att.fails += 1;
        ws.serializeAttachment(att);
        this.send(ws, { type: "AUTH_FAILED", error: "We couldn't find your seat in this room." });
        if (att.fails >= 3) ws.close(4001, "Too many failed attempts");
        return;
      }
      att.pid = p.id;
      ws.serializeAttachment(att);
      p.connected = true;
      await this.save();
      this.broadcast();
      return;
    }

    if (!att.pid) return this.send(ws, { type: "ERROR", error: "Say hello first." });
    if (msg?.type === "PING") return this.send(ws, { type: "PONG", serverNow: Date.now() });

    if (msg?.type === "CMD") {
      const cmd = msg.cmd as Command;
      if (cmd?.type === "CHAT") {
        const last = this.lastChat.get(att.pid) ?? 0;
        if (Date.now() - last < 1000) return this.send(ws, { type: "ACK", cid: msg.cid, ok: false, error: "Slow down." });
        this.lastChat.set(att.pid, Date.now());
      }
      const res = applyCommand(state, att.pid, typeof msg.cid === "string" ? msg.cid.slice(0, 64) : undefined, cmd, Date.now());
      this.send(ws, { type: "ACK", cid: msg.cid, ok: res.ok, error: res.ok ? undefined : res.error });
      if (res.ok && !res.duplicate) {
        await this.save();
        this.broadcast();
      }
      return;
    }
    this.send(ws, { type: "ERROR", error: "Unknown message." });
  }

  async webSocketClose(ws: Socket): Promise<void> {
    await this.onSocketGone(ws);
  }

  async webSocketError(ws: Socket): Promise<void> {
    await this.onSocketGone(ws);
  }

  async onSocketGone(ws: Socket): Promise<void> {
    const state = await this.load();
    const att: Attachment | null = ws.deserializeAttachment();
    if (!state || !att?.pid) return;
    const stillHere = this.sockets().some(([other, a]) => other !== ws && a.pid === att.pid);
    const p = state.players.find((x) => x.id === att.pid);
    if (p && !stillHere) {
      p.connected = false;
      maybeAdvance(state, Date.now()); // the leaver may have been the last one everyone was waiting on
      await this.save();
      this.broadcast();
    }
  }

  /** Phase deadlines. Runs even if every player has gone, so a game can never stall. */
  async alarm(): Promise<void> {
    const state = await this.load();
    if (!state) return;
    if (onDeadline(state, Date.now())) {
      await this.save();
      this.broadcast();
    } else if (state.deadline) {
      await this.ctx.storage.setAlarm(state.deadline);
    }
  }
}
