import { test } from "node:test";
import assert from "node:assert/strict";
import { canPlant, currentRound, moneyBalances, onDeadline } from "../src/engine/engine.ts";
import type { GameState, Side } from "../src/engine/types.ts";
import { cmd, ids, setup, T0, toVote } from "./helpers.ts";

/** Play rounds 1-4 with fixed votes per player, then arrive at the Town Meeting. */
function toMeeting(n: number, pattern: (id: string, round: number) => Side, seed = 7): GameState {
  const s = setup(n, seed);
  for (let r = 1; r <= 4; r++) {
    toVote(s);
    for (const id of ids(s)) cmd(s, id, { type: "VOTE", side: pattern(id, r) });
    assert.equal(s.phase, "RECAP");
    for (const id of ids(s)) cmd(s, id, { type: "READY_NEXT" });
  }
  assert.equal(s.phase, "PLANT");
  return s;
}

const p0Harms = (id: string, r: number): Side => (id === "p0" && r >= 2 ? "X" : "H");

test("Town Meeting arrives after round 4", () => {
  const s = toMeeting(5, p0Harms);
  assert.equal(s.round, 4);
  assert.ok(s.meeting);
});

test("only residents who have backed HARM can plant a rumour, once, for 1 coin", () => {
  const s = toMeeting(5, p0Harms);
  assert.equal(canPlant(s, "p0"), true);
  assert.equal(canPlant(s, "p1"), false);
  assert.equal(cmd(s, "p1", { type: "PLANT", target: "p2", count: 3 }).ok, false);
  const before = s.players[0].wallet;
  assert.ok(cmd(s, "p0", { type: "PLANT", target: "p2", count: 3 }).ok);
  assert.equal(s.players[0].wallet, before - 1);
  assert.equal(cmd(s, "p0", { type: "PLANT", target: "p3", count: 2 }).ok, false);
  assert.ok(moneyBalances(s));
});

test("Grapevine: everyone hears exactly one rumour, nobody about themselves, everyone is talked about once", () => {
  const s = toMeeting(6, p0Harms);
  for (const id of ids(s)) cmd(s, id, { type: "READY_NEXT" });
  assert.equal(s.phase, "DISCUSS");
  const m = s.meeting!;
  const hearers = Object.keys(m.trueRumours);
  assert.equal(hearers.length, 6);
  const subjects = hearers.map((h) => m.trueRumours[h].subject);
  assert.equal(new Set(subjects).size, 6);
  for (const h of hearers) {
    assert.notEqual(m.trueRumours[h].subject, h);
    const subject = m.trueRumours[h].subject;
    assert.equal(m.trueRumours[h].count, subject === "p0" ? 3 : 0);
  }
});

test("a planted rumour replaces one real rumour, never the planter's or the target's", () => {
  for (let seed = 1; seed < 40; seed++) {
    const s = toMeeting(4, p0Harms, seed);
    cmd(s, "p0", { type: "PLANT", target: "p1", count: 4 });
    for (const id of ids(s)) cmd(s, id, { type: "READY_NEXT" });
    const m = s.meeting!;
    const plant = m.plants[0];
    assert.ok(plant.recipient && plant.recipient !== "p0" && plant.recipient !== "p1");
    assert.deepEqual(m.rumours[plant.recipient!], { subject: "p1", count: 4 });
    for (const id of ids(s)) if (id !== plant.recipient) assert.deepEqual(m.rumours[id], m.trueRumours[id]);
  }
});

function lockUpTarget(s: GameState, target: string) {
  for (const id of ids(s)) cmd(s, id, { type: "READY_NEXT" }); // PLANT -> DISCUSS
  for (const id of ids(s)) cmd(s, id, { type: "READY_NEXT" }); // DISCUSS -> NOMINATE
  assert.equal(s.phase, "NOMINATE");
  for (const id of ids(s)) cmd(s, id, { type: "NOMINATE", target: id === target ? ids(s).find((x) => x !== target)! : target });
  assert.equal(s.phase, "LOCKUP");
}

test("caught skimming: private fine of 3 per HARM vote in the last 3", () => {
  const s = toMeeting(5, p0Harms);
  const before = s.players[0].wallet;
  lockUpTarget(s, "p0");
  const m = s.meeting!;
  assert.equal(m.lockedUp, "p0");
  assert.deepEqual(m.audit, { caught: true, harmCount: 3, amount: 9 });
  assert.equal(s.players[0].wallet, before - 9);
  assert.ok(moneyBalances(s));
});

test("wrongly accused: +2 compensation", () => {
  const s = toMeeting(5, p0Harms);
  const before = s.players[1].wallet;
  lockUpTarget(s, "p1");
  assert.deepEqual(s.meeting!.audit, { caught: false, harmCount: 0, amount: 2 });
  assert.equal(s.players[1].wallet, before + 2);
});

test("the locked-up player misses exactly round 5: no vote, no dividend, not targeted", () => {
  const s = toMeeting(5, p0Harms);
  lockUpTarget(s, "p1");
  for (const id of ids(s)) cmd(s, id, { type: "READY_NEXT" }); // LOCKUP -> round 5
  assert.equal(s.round, 5);
  const rec = currentRound(s)!;
  assert.notEqual(rec.primary, "p1");
  assert.notEqual(rec.secondary, "p1");
  assert.equal(cmd(s, "p1", { type: "OFFER_BRIBE", to: "p2", amount: 1, side: "H" }).ok, false);
  toVote(s);
  assert.ok(!rec.eligible.includes("p1"));
  for (const id of rec.eligible) cmd(s, id, { type: "VOTE", side: "H" });
  assert.equal(rec.result!.settlements["p1"].dividend, 0);
  for (const id of ids(s)) cmd(s, id, { type: "READY_NEXT" }); // -> round 6
  assert.equal(s.round, 6);
  assert.ok(currentRound(s)!.round === 6);
  toVote(s);
  assert.ok(currentRound(s)!.eligible.includes("p1"));
});

test("nobody nominated means nobody is locked up", () => {
  const s = toMeeting(4, p0Harms);
  for (const id of ids(s)) cmd(s, id, { type: "READY_NEXT" });
  for (const id of ids(s)) cmd(s, id, { type: "READY_NEXT" });
  for (const id of ids(s)) cmd(s, id, { type: "NOMINATE", target: null });
  assert.equal(s.phase, "LOCKUP");
  assert.equal(s.meeting!.lockedUp, null);
});

test("nomination ties are broken by the room's random seed, reproducibly", () => {
  const pickFor = (seed: number) => {
    const s = toMeeting(4, p0Harms, seed);
    for (const id of ids(s)) cmd(s, id, { type: "READY_NEXT" });
    for (const id of ids(s)) cmd(s, id, { type: "READY_NEXT" });
    cmd(s, "p0", { type: "NOMINATE", target: "p1" });
    cmd(s, "p1", { type: "NOMINATE", target: "p0" });
    cmd(s, "p2", { type: "NOMINATE", target: null });
    cmd(s, "p3", { type: "NOMINATE", target: null });
    return s.meeting!.lockedUp;
  };
  assert.equal(pickFor(11), pickFor(11));
  assert.ok(["p0", "p1"].includes(pickFor(11)!));
});

test("deadlines move the meeting along even if nobody acts", () => {
  const s = toMeeting(4, p0Harms);
  let t = T0;
  for (const phase of ["PLANT", "DISCUSS", "NOMINATE", "LOCKUP"]) {
    assert.equal(s.phase, phase);
    t = s.deadline! + 1;
    onDeadline(s, t);
  }
  assert.equal(s.round, 5);
  assert.equal(s.phase, "NEGOTIATE");
});
