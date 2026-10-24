import { addPlayer, applyCommand, newRoom } from "../src/engine/engine.ts";
import type { Command, GameState } from "../src/engine/types.ts";

export const T0 = 1_000_000;
let cid = 0;

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
  return s;
}

export function cmd(s: GameState, pid: string, c: Command, now = T0) {
  return applyCommand(s, pid, `c${++cid}`, c, now);
}

/** Skip negotiation by having everyone press "move on". */
export function toVote(s: GameState) {
  for (const p of s.players) if (p.connected) cmd(s, p.id, { type: "READY_NEXT" });
}

export const ids = (s: GameState) => s.players.map((p) => p.id);
export const wallet = (s: GameState, id: string) => s.players.find((p) => p.id === id)!.wallet;
