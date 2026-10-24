// Runs the real Room Durable Object against an in-memory fake of the Cloudflare runtime.

import { test } from "node:test";
import assert from "node:assert/strict";
import { Room } from "../src/room.ts";

class FakeSocket {
  sent: any[] = [];
  closed: number | null = null;
  att: any = null;
  send(d: string) {
    this.sent.push(JSON.parse(d));
  }
  close(code?: number) {
    this.closed = code ?? 1000;
  }
  serializeAttachment(v: unknown) {
    this.att = structuredClone(v);
  }
  deserializeAttachment() {
    return structuredClone(this.att);
  }
  last(type: string) {
    return [...this.sent].reverse().find((m) => m.type === type);
  }
}

function fakeCtx() {
  const store = new Map<string, unknown>();
  const sockets: FakeSocket[] = [];
  return {
    store,
    sockets,
    alarm: null as number | null,
    storage: {
      get: async (k: string) => structuredClone(store.get(k)) as any,
      put: async (k: string, v: unknown) => void store.set(k, structuredClone(v)),
      setAlarm: async function (this: any, t: number) {
        ctx.alarm = t;
      },
      deleteAlarm: async () => {
        ctx.alarm = null;
      },
    },
    acceptWebSocket(ws: FakeSocket) {
      sockets.push(ws);
    },
    getWebSockets() {
      return sockets.filter((s) => s.closed === null);
    },
  };
}
let ctx: ReturnType<typeof fakeCtx>;

const post = (path: string, body: unknown) =>
  new Request(`https://room/${path}`, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });

async function connect(room: Room, token: string) {
  const ws = new FakeSocket();
  ctx.acceptWebSocket(ws);
  ws.serializeAttachment({ pid: null, fails: 0 });
  await room.webSocketMessage(ws as any, JSON.stringify({ type: "HELLO", token }));
  return ws;
}

let cid = 0;
const send = (room: Room, ws: FakeSocket, cmd: unknown) => room.webSocketMessage(ws as any, JSON.stringify({ type: "CMD", cid: `t${++cid}`, cmd }));

test("create, join four players, start, and every socket gets only its own view", async () => {
  ctx = fakeCtx();
  const room = new Room(ctx as any, {});
  assert.equal((await room.fetch(post("init", { code: "ABCDEF" }))).status, 201);
  assert.equal((await room.fetch(post("init", { code: "ABCDEF" }))).status, 409);

  const seats: { playerId: string; token: string; ws?: FakeSocket }[] = [];
  for (const name of ["Ada", "Bo", "Cy", "Di"]) seats.push(await (await room.fetch(post("join", { name }))).json());
  const dup = await room.fetch(post("join", { name: "ada" }));
  assert.equal(dup.status, 400);

  for (const s of seats) s.ws = await connect(room, s.token);
  for (const s of seats) await send(room, s.ws!, { type: "READY", ready: true });
  await send(room, seats[0].ws!, { type: "START" });

  const view = seats[1].ws!.last("STATE");
  assert.equal(view.pub.phase, "NEGOTIATE");
  assert.equal(view.me.id, seats[1].playerId);
  assert.equal(view.me.wallet, 12);
  assert.ok(!JSON.stringify(view).includes(seats[0].token));
  assert.ok(ctx.alarm !== null, "a deadline alarm is set");
});

test("bad tokens are rejected and the socket is closed after three tries", async () => {
  ctx = fakeCtx();
  const room = new Room(ctx as any, {});
  await room.fetch(post("init", { code: "ABCDEF" }));
  const ws = new FakeSocket();
  ctx.acceptWebSocket(ws);
  ws.serializeAttachment({ pid: null, fails: 0 });
  for (let i = 0; i < 3; i++) await room.webSocketMessage(ws as any, JSON.stringify({ type: "HELLO", token: "guess" }));
  assert.equal(ws.last("AUTH_FAILED").type, "AUTH_FAILED");
  assert.equal(ws.closed, 4001);
  await room.webSocketMessage(ws as any, JSON.stringify({ type: "CMD", cmd: { type: "START" } }));
  assert.ok(!ws.sent.some((m) => m.type === "STATE"));
});

test("state survives a restart and players reconnect with their token", async () => {
  ctx = fakeCtx();
  const room = new Room(ctx as any, {});
  await room.fetch(post("init", { code: "ABCDEF" }));
  const seats: any[] = [];
  for (const name of ["Ada", "Bo", "Cy", "Di"]) seats.push(await (await room.fetch(post("join", { name }))).json());
  for (const s of seats) s.ws = await connect(room, s.token);
  for (const s of seats) await send(room, s.ws, { type: "READY", ready: true });
  await send(room, seats[0].ws, { type: "START" });
  await send(room, seats[0].ws, { type: "OFFER_LOAN", to: seats[1].playerId, amount: 4 });

  // Simulate eviction: all sockets drop, a fresh object loads from storage.
  for (const s of seats) s.ws.closed = 1006;
  const reborn = new Room(ctx as any, {});
  const ws = await connect(reborn, seats[1].token);
  const v = ws.last("STATE");
  assert.equal(v.pub.phase, "NEGOTIATE");
  assert.equal(v.me.loans.length, 1);
  assert.equal(v.pub.players.filter((p: any) => p.connected).length, 1);
});

test("the alarm ends a phase even with nobody connected", async () => {
  ctx = fakeCtx();
  const room = new Room(ctx as any, {});
  await room.fetch(post("init", { code: "ABCDEF" }));
  const seats: any[] = [];
  for (const name of ["Ada", "Bo", "Cy", "Di"]) seats.push(await (await room.fetch(post("join", { name }))).json());
  for (const s of seats) s.ws = await connect(room, s.token);
  for (const s of seats) await send(room, s.ws, { type: "READY", ready: true });
  await send(room, seats[0].ws, { type: "START" });
  for (const s of seats) await room.webSocketClose(Object.assign(s.ws, { closed: 1001 }) as any);

  const state = room.state!;
  state.deadline = Date.now() - 1;
  await room.alarm();
  assert.equal(room.state!.phase, "VOTE");
});

test("duplicate command ids are only applied once", async () => {
  ctx = fakeCtx();
  const room = new Room(ctx as any, {});
  await room.fetch(post("init", { code: "ABCDEF" }));
  const seats: any[] = [];
  for (const name of ["Ada", "Bo", "Cy", "Di"]) seats.push(await (await room.fetch(post("join", { name }))).json());
  for (const s of seats) s.ws = await connect(room, s.token);
  for (const s of seats) await send(room, s.ws, { type: "READY", ready: true });
  await send(room, seats[0].ws, { type: "START" });
  await send(room, seats[0].ws, { type: "OFFER_LOAN", to: seats[1].playerId, amount: 2 });
  const loanId = room.state!.loans[0].id;
  const msg = JSON.stringify({ type: "CMD", cid: "same-tap", cmd: { type: "RESPOND_LOAN", id: loanId, accept: true } });
  await room.webSocketMessage(seats[1].ws, msg);
  await room.webSocketMessage(seats[1].ws, msg);
  assert.equal(room.state!.players.find((p) => p.id === seats[1].playerId)!.wallet, 14);
});
