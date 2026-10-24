import { test } from "node:test";
import assert from "node:assert/strict";
import { CARDS } from "../src/engine/cards.ts";
import { currentRound, moneyBalances, onDeadline, scoreOf } from "../src/engine/engine.ts";
import type { Agenda } from "../src/engine/types.ts";
import { cmd, coins, everyoneNext, ids, playRound, setup, T0 } from "./helpers.ts";

test("deck: 36 unique, fully written cards", () => {
  assert.equal(CARDS.length, 36);
  assert.equal(new Set(CARDS.map((c) => c.id)).size, 36);
  for (const c of CARDS) for (const k of ["title", "premise", "helpLabel", "harmLabel", "helpResult", "harmResult", "icon"] as const) assert.ok(c[k].length > 2, `${c.id}.${k}`);
});

test("works with 3 players: unique agendas, 3 starting coins, town at 5", () => {
  const s = setup(3);
  assert.equal(s.phase, "TALK");
  assert.equal(new Set(s.players.map((p) => p.agenda)).size, 3);
  for (const p of s.players) assert.equal(p.coins, 3);
  assert.equal(s.town, 5);
});

test("HELP majority: town +1, everyone gets the dividend, HARM voters still skim", () => {
  const s = setup(4);
  playRound(s, (id) => (id === "p3" ? "X" : "H"));
  const r = currentRound(s)!.result!;
  assert.equal(s.phase, "RESULT");
  assert.equal(r.winner, "H");
  assert.equal(s.town, 6);
  assert.equal(coins(s, "p0"), 4);
  assert.equal(coins(s, "p3"), 3 + 2 + 1);
  assert.equal(r.flips.length, 4);
  assert.equal(r.flips.filter((f) => f === "X").length, 1);
  assert.ok(moneyBalances(s));
});

test("HARM majority: town -2, no dividend", () => {
  const s = setup(3);
  playRound(s, (id) => (id === "p0" ? "H" : "X"));
  assert.equal(currentRound(s)!.result!.winner, "X");
  assert.equal(s.town, 3);
  assert.equal(coins(s, "p0"), 3);
  assert.equal(coins(s, "p1"), 5);
});

test("tie: town unchanged, no dividend", () => {
  const s = setup(4);
  playRound(s, (id) => (id === "p0" || id === "p1" ? "H" : "X"));
  assert.equal(currentRound(s)!.result!.winner, null);
  assert.equal(s.town, 5);
});

test("collapse shows the reveal first, then ends with no winner", () => {
  const s = setup(3);
  s.town = 2;
  playRound(s, () => "X");
  assert.equal(s.phase, "RESULT");
  assert.equal(s.town, 0);
  everyoneNext(s);
  assert.equal(s.phase, "END");
  assert.equal(s.outcome!.collapsed, true);
  assert.deepEqual(s.outcome!.winners, []);
});

test("timeouts: unvoted players simply don't vote", () => {
  const s = setup(3);
  everyoneNext(s);
  cmd(s, "p0", { type: "VOTE", side: "H" });
  onDeadline(s, s.deadline! + 1);
  const r = currentRound(s)!.result!;
  assert.equal(r.help, 1);
  assert.equal(r.harm, 0);
});

test("bribe: 2 coins move once, the vote is locked, duplicates ignored", () => {
  const s = setup(4);
  assert.ok(cmd(s, "p0", { type: "OFFER_BRIBE", to: "p1", side: "X" }).ok);
  assert.equal(cmd(s, "p0", { type: "OFFER_BRIBE", to: "p2", side: "X" }).ok, false);
  const id = s.bribes[0].id;
  assert.ok(cmd(s, "p1", { type: "RESPOND_BRIBE", id, accept: true }).ok);
  assert.equal(cmd(s, "p1", { type: "RESPOND_BRIBE", id, accept: true }).ok, false);
  assert.equal(coins(s, "p0"), 1);
  assert.equal(coins(s, "p1"), 5);
  everyoneNext(s);
  assert.equal(currentRound(s)!.votes["p1"], "X");
  assert.equal(cmd(s, "p1", { type: "VOTE", side: "H" }).ok, false);
  assert.ok(moneyBalances(s));
});

test("can't bribe without the coins", () => {
  const s = setup(3);
  s.players[0].coins = 1;
  s.minted -= 2;
  assert.equal(cmd(s, "p0", { type: "OFFER_BRIBE", to: "p1", side: "H" }).ok, false);
});

function toAccusation(n: number, harmer = "p0") {
  const s = setup(n);
  for (let r = 1; r <= 3; r++) {
    playRound(s, (id) => (id === harmer && r >= 2 ? "X" : "H"));
    everyoneNext(s);
  }
  assert.equal(s.phase, "GOSSIP");
  return s;
}

test("accusation after round 3: everyone hears one true rumour about someone else", () => {
  const s = toAccusation(5);
  const a = s.accusation!;
  assert.equal(Object.keys(a.rumours).length, 5);
  assert.equal(new Set(Object.values(a.rumours).map((r) => r.subject)).size, 5);
  for (const [h, r] of Object.entries(a.rumours)) {
    assert.notEqual(h, r.subject);
    assert.equal(r.count, r.subject === "p0" ? 2 : 0);
  }
});

test("the accused sits out the next round and their agenda is revealed to everyone", async () => {
  const { publicView } = await import("../src/engine/view.ts");
  const s = toAccusation(4);
  everyoneNext(s); // GOSSIP -> ACCUSE
  for (const id of ids(s)) cmd(s, id, { type: "NOMINATE", target: id === "p0" ? "p1" : "p0" });
  assert.equal(s.phase, "VERDICT");
  assert.equal(s.accusation!.accused, "p0");
  const v = publicView(s);
  assert.equal(v.players.find((p) => p.id === "p0")!.agenda, s.players[0].agenda);
  assert.equal(v.players.find((p) => p.id === "p1")!.agenda, null);
  everyoneNext(s);
  assert.equal(s.round, 4);
  everyoneNext(s);
  assert.ok(!currentRound(s)!.eligible.includes("p0"));
  assert.equal(cmd(s, "p0", { type: "VOTE", side: "H" }).ok, false);
});

function scoreWith(agenda: Agenda, setupFn: (s: ReturnType<typeof setup>) => void) {
  const s = setup(4);
  s.players[0].agenda = agenda;
  setupFn(s);
  return scoreOf(s, "p0");
}

test("agenda scoring", () => {
  assert.equal(scoreWith("pillar", (s) => (s.town = 8)).bonus, 8);
  assert.equal(scoreWith("pillar", (s) => (s.town = 7)).bonus, 0);
  assert.equal(scoreWith("martyr", (s) => playRound(s, () => "H")).bonus, 8);
  assert.equal(scoreWith("martyr", (s) => playRound(s, () => "X")).bonus, 0);
  assert.equal(scoreWith("developer", (s) => playRound(s, () => "X")).bonus, 2);
  assert.equal(scoreWith("snake", (s) => playRound(s, (id) => (id === "p0" ? "X" : "H"))).bonus, 1);
  assert.equal(scoreWith("chameleon", (s) => {
    for (let i = 0; i < 2; i++) { playRound(s, (id) => (id === "p0" ? "X" : "H")); everyoneNext(s); }
  }).bonus, 3);
  assert.equal(scoreWith("fixer", (s) => {
    cmd(s, "p0", { type: "OFFER_BRIBE", to: "p1", side: "H" });
    cmd(s, "p1", { type: "RESPOND_BRIBE", id: s.bribes[0].id, accept: true });
  }).bonus, 4);
});

test("gossip and neighbour agendas read the accusation", () => {
  const s = toAccusation(4, "p2");
  s.players[0].agenda = "gossip";
  s.players[1].agenda = "neighbour";
  everyoneNext(s);
  cmd(s, "p0", { type: "NOMINATE", target: "p2" });
  cmd(s, "p1", { type: "NOMINATE", target: "p2" });
  cmd(s, "p2", { type: "NOMINATE", target: "p0" });
  cmd(s, "p3", { type: "NOMINATE", target: "p2" });
  assert.equal(scoreOf(s, "p0").bonus, 5);
  assert.equal(scoreOf(s, "p1").bonus, 8);
});

test("a full game ends after 6 rounds with scores and a winner", () => {
  const s = setup(3);
  let guard = 0;
  while (s.phase !== "END" && guard++ < 100) {
    if (s.phase === "TALK" || s.phase === "RESULT" || s.phase === "GOSSIP" || s.phase === "VERDICT") everyoneNext(s);
    else if (s.phase === "VOTE") for (const id of ids(s)) cmd(s, id, { type: "VOTE", side: "H" });
    else if (s.phase === "ACCUSE") for (const id of ids(s)) cmd(s, id, { type: "NOMINATE", target: null });
  }
  assert.equal(s.phase, "END");
  assert.equal(s.rounds.length, 6);
  assert.equal(new Set(s.rounds.map((r) => r.cardId)).size, 6);
  assert.ok(s.outcome!.winners.length >= 1);
  assert.ok(moneyBalances(s));
  void T0;
});
