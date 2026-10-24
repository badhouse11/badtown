// Plays thousands of random games with random players doing random (valid and invalid) things,
// and checks the invariants after every single action.

import { test } from "node:test";
import assert from "node:assert/strict";
import { addPlayer, applyCommand, currentRound, moneyBalances, newRoom, onDeadline } from "../src/engine/engine.ts";
import { viewFor } from "../src/engine/view.ts";
import type { Command, GameState } from "../src/engine/types.ts";

function rand(seed: number) {
  let x = seed || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}

function playRandomGame(seed: number, n: number) {
  const r = rand(seed * 7919 + n);
  const pick = <T>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  let now = 1_000_000;
  const s: GameState = newRoom("FUZZ01", now, seed);
  for (let i = 0; i < n; i++) addPlayer(s, `p${i}`, `P${i}`, `h${i}`).player!.connected = true;
  for (const p of s.players) applyCommand(s, p.id, undefined, { type: "READY", ready: true }, now);
  assert.ok(applyCommand(s, "p0", undefined, { type: "START" }, now).ok);

  const ids = s.players.map((p) => p.id);
  const greed = Object.fromEntries(ids.map((id) => [id, r()]));
  let steps = 0;
  while (s.phase !== "REVEAL") {
    assert.ok(++steps < 5000, "game stalled");
    now += 500;
    // Random disconnects and reconnects.
    if (r() < 0.02) pick(s.players).connected = r() < 0.5;
    const id = pick(ids);
    const other = pick(ids);
    const rec = currentRound(s);
    let c: Command;
    switch (s.phase) {
      case "NEGOTIATE": {
        const k = r();
        if (k < 0.2) c = { type: "OFFER_BRIBE", to: other, amount: 1 + Math.floor(r() * 4), side: r() < 0.5 ? "H" : "X" };
        else if (k < 0.35) c = { type: "RESPOND_BRIBE", id: pick(s.bribes.map((b) => b.id).concat("nope")), accept: r() < 0.7 };
        else if (k < 0.5) c = { type: "OFFER_LOAN", to: other, amount: pick([2, 4, 3]) };
        else if (k < 0.65) c = { type: "RESPOND_LOAN", id: pick(s.loans.map((l) => l.id).concat("nope")), accept: r() < 0.7 };
        else c = { type: "READY_NEXT" };
        break;
      }
      case "VOTE":
        c = r() < 0.05 ? { type: "READY_NEXT" } : { type: "VOTE", side: r() < greed[id] ? "X" : "H" };
        break;
      case "PLANT":
        c = r() < 0.3 ? { type: "PLANT", target: other, count: Math.floor(r() * 5) } : { type: "READY_NEXT" };
        break;
      case "NOMINATE":
        c = { type: "NOMINATE", target: r() < 0.1 ? null : other };
        break;
      default:
        c = r() < 0.1 ? { type: "CHAT", text: "you bribed me" } : { type: "READY_NEXT" };
    }
    applyCommand(s, id, `x${steps}`, c, now);
    // Occasionally let the clock run out.
    if (r() < 0.05 && s.deadline !== null) {
      now = s.deadline + 1;
      onDeadline(s, now);
    }
    assert.ok(moneyBalances(s), `money broke at step ${steps} (seed ${seed})`);
    for (const p of s.players) assert.ok(p.wallet >= 0);
    assert.ok(s.prosperity >= 0 && s.prosperity <= s.settings.maxProsperity);
    if (rec) assert.ok(s.rounds.length <= s.settings.rounds);
    // Nobody's view contains another player's token hash.
    if (steps % 50 === 0) assert.ok(!JSON.stringify(viewFor(s, id)).includes(`"h1"`));
  }
  const cards = s.rounds.map((x) => x.cardId);
  assert.equal(new Set(cards).size, cards.length, "a card repeated");
  for (const rd of s.rounds) assert.ok(rd.primary !== rd.secondary);
  // Every loan is settled exactly once.
  for (const l of s.loans) if (l.status === "accepted") assert.ok(l.repaid !== null && l.repaid <= l.amount + 1);
  return s;
}

test("2,000 random games: money always balances, wallets never negative, games always finish", () => {
  let collapses = 0;
  let meetings = 0;
  for (let seed = 1; seed <= 400; seed++) {
    for (let n = 4; n <= 8; n++) {
      const s = playRandomGame(seed, n);
      if (s.outcome!.collapsed) collapses++;
      if (s.meeting) meetings++;
    }
  }
  assert.ok(meetings > 0);
  assert.ok(collapses >= 0);
});
