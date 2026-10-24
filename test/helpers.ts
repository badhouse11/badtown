import { addPlayer, applyCommand, newRoom } from "../src/engine/engine.ts";
import type { Command, GameState, Side } from "../src/engine/types.ts";

export const T0 = 1_000_000;
let cid = 0;

/** A started game, already past the agenda screen, in round 1's TALK phase. */
export function setup(n: number, seed = 42): GameState {
  const s = newRoom("TESTGG", T0, seed);
  for (let i = 0; i < n; i++) {
    const r = addPlayer(s, `p${i}`, `Player${i}`, `hash${i}`);
    if (!r.ok) throw new Error(r.error);
    r.player!.connected = true;
  }
  for (const p of s.players) cmd(s, p.id, { type: "READY", ready: true });
  const res = cmd(s, "p0", { type: "START" });
  if (!res.ok) throw new Error(res.error);
  everyoneNext(s); // AGENDA -> TALK
  return s;
}

export function cmd(s: GameState, pid: string, c: Command, now = T0) {
  return applyCommand(s, pid, `c${++cid}`, c, now);
}

export function everyoneNext(s: GameState) {
  for (const p of s.players) if (p.connected) cmd(s, p.id, { type: "READY_NEXT" });
}

/** From TALK: open voting, cast these votes, land on RESULT. */
export function playRound(s: GameState, votes: (id: string) => Side) {
  everyoneNext(s);
  for (const p of s.players) cmd(s, p.id, { type: "VOTE", side: votes(p.id) });
}

export const ids = (s: GameState) => s.players.map((p) => p.id);
export const coins = (s: GameState, id: string) => s.players.find((p) => p.id === id)!.coins;
