// Thousands of random games with random (valid and invalid) actions. Invariants checked every step.

import { test } from "node:test";
import assert from "node:assert/strict";
import { addPlayer, applyCommand, moneyBalances, newRoom, onDeadline } from "../src/engine/engine.ts";
import { viewFor } from "../src/engine/view.ts";
import type { Command, GameState } from "../src/engine/types.ts";

function rand(seed: number) {
  let x = seed || 1;
  return () => {
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}

function play(seed: number, n: number) {
  const r = rand(seed * 7919 + n);
  const pick = <T>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  let now = 1_000_000;
  const s: GameState = newRoom("FUZZ01", now, seed);
  for (let i = 0; i < n; i++) addPlayer(s, `p${i}`, `P${i}`, `h${i}`).player!.connected = true;
  for (const p of s.players) applyCommand(s, p.id, undefined, { type: "READY", ready: true }, now);
  assert.ok(applyCommand(s, "p0", undefined, { type: "START" }, now).ok);
  const ids = s.players.map((p) => p.id);
  const greed = Object.fromEntries(ids.map((id) => [id, r() * 0.7]));
  let steps = 0;
  while (s.phase !== "END") {
    assert.ok(++steps < 3000, "stalled");
    now += 400;
    if (r() < 0.02) pick(s.players).connected = r() < 0.6;
    const id = pick(ids);
    let c: Command;
    switch (s.phase) {
      case "TALK": {
        const k = r();
        if (k < 0.2) c = { type: "OFFER_BRIBE", to: pick(ids), side: r() < 0.5 ? "H" : "X" };
        else if (k < 0.4) c = { type: "RESPOND_BRIBE", id: pick(s.bribes.map((b) => b.id).concat("x")), accept: r() < 0.7 };
        else c = { type: "READY_NEXT" };
        break;
      }
      case "VOTE": c = { type: "VOTE", side: r() < greed[id] ? "X" : "H" }; break;
      case "ACCUSE": c = { type: "NOMINATE", target: r() < 0.1 ? null : pick(ids) }; break;
      default: c = r() < 0.05 ? { type: "CHAT", text: "it wasn't me" } : { type: "READY_NEXT" };
    }
    applyCommand(s, id, `x${steps}`, c, now);
    if (r() < 0.04 && s.deadline !== null) onDeadline(s, (now = s.deadline + 1));
    assert.ok(moneyBalances(s), `money broke (seed ${seed})`);
    assert.ok(s.town >= 0 && s.town <= s.settings.townMax);
    if (steps % 40 === 0) {
      const v = JSON.stringify(viewFor(s, id).pub);
      assert.ok(!v.includes('"votes"') && !v.includes("tokenHash"));
    }
  }
  assert.equal(new Set(s.rounds.map((x) => x.cardId)).size, s.rounds.length);
  return s;
}

test("2,400 random games from 3 to 8 players: coins balance, games always finish", () => {
  let collapses = 0;
  for (let seed = 1; seed <= 400; seed++) for (let n = 3; n <= 8; n++) if (play(seed, n).outcome!.collapsed) collapses++;
  assert.ok(collapses >= 0);
});
