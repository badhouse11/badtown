import { test } from "node:test";
import assert from "node:assert/strict";
import { applyCommand, currentRound, moneyBalances, onDeadline } from "../src/engine/engine.ts";
import { cmd, ids, setup, T0, toVote, wallet } from "./helpers.ts";

function vote(s: ReturnType<typeof setup>, sides: Record<string, "H" | "X">) {
  for (const [id, side] of Object.entries(sides)) {
    const r = cmd(s, id, { type: "VOTE", side });
    assert.ok(r.ok, r.ok ? "" : r.error);
  }
}

test("game starts with unique professions, 12 coins each and prosperity 4", () => {
  const s = setup(6);
  assert.equal(s.phase, "NEGOTIATE");
  assert.equal(new Set(s.players.map((p) => p.profession)).size, 6);
  for (const p of s.players) assert.equal(p.wallet, 12);
  assert.equal(s.prosperity, 4);
  assert.ok(moneyBalances(s));
});

test("only cards for professions in play (or universal) are in the deck", () => {
  const s = setup(4);
  const profs = new Set(s.players.map((p) => p.profession));
  assert.equal(s.deck.length, 60);
  for (const id of s.deck) {
    const prof = { FAR: "FARMER", DOC: "DOCTOR", BUI: "BUILDER", BAN: "BANKER", TEA: "TEACHER", MAY: "MAYOR", GRO: "GROCER", MEC: "MECHANIC", UNI: null }[id.slice(0, 3)];
    assert.ok(prof === null || profs.has(prof as any), id);
  }
});

test("HELP 3 vs HARM 2: whole-coin split with leftovers rolled into the pot", () => {
  const s = setup(5);
  toVote(s);
  const [a, b, c, d, e] = ids(s);
  vote(s, { [a]: "H", [b]: "H", [c]: "H", [d]: "X", [e]: "X" });
  const r = currentRound(s)!.result!;
  assert.equal(r.winner, "H");
  for (const id of [a, b, c]) assert.equal(r.settlements[id].payout, 3); // 2 back + floor(4/3)
  for (const id of [d, e]) {
    assert.equal(r.settlements[id].payout, 0);
    assert.equal(r.settlements[id].skim, 3); // skim paid even when HARM loses
  }
  assert.equal(s.pot, 1); // the leftover coin rolls over
  assert.equal(s.prosperity, 5);
  for (const id of ids(s)) assert.equal(r.settlements[id].dividend, 1);
  assert.ok(moneyBalances(s));
});

test("HARM 3 vs HELP 1: harm wins, splits the stake and the town loses prosperity", () => {
  const s = setup(4);
  toVote(s);
  const [a, b, c, d] = ids(s);
  vote(s, { [a]: "X", [b]: "X", [c]: "X", [d]: "H" });
  const r = currentRound(s)!.result!;
  assert.equal(r.winner, "X");
  for (const id of [a, b, c]) assert.equal(r.settlements[id].payout, 2); // 2 back + floor(2/3)=0
  assert.equal(s.pot, 2);
  assert.equal(s.prosperity, 3);
  for (const id of ids(s)) assert.equal(r.settlements[id].dividend, 0);
  assert.ok(moneyBalances(s));
});

test("tie rule: pro-town wins at prosperity 4, anti-town at 3", () => {
  for (const [pros, expected] of [[4, "H"], [3, "X"]] as const) {
    const s = setup(4);
    s.prosperity = pros;
    toVote(s);
    const [a, b, c, d] = ids(s);
    vote(s, { [a]: "H", [b]: "H", [c]: "X", [d]: "X" });
    const r = currentRound(s)!.result!;
    assert.equal(r.winner, expected);
    assert.equal(r.tieBroken, true);
  }
});

test("unanimous HARM: stakes back, everyone skims, prosperity drops", () => {
  const s = setup(4);
  toVote(s);
  vote(s, Object.fromEntries(ids(s).map((id) => [id, "X"])));
  const r = currentRound(s)!.result!;
  assert.equal(r.unanimous, true);
  for (const id of ids(s)) {
    assert.equal(r.settlements[id].payout, 2);
    assert.equal(r.settlements[id].skim, 3);
  }
  assert.equal(s.prosperity, 3);
});

test("collapse: prosperity 0 ends the game and nobody wins", () => {
  const s = setup(4);
  s.prosperity = 1;
  toVote(s);
  vote(s, Object.fromEntries(ids(s).map((id) => [id, "X"])));
  assert.equal(s.phase, "REVEAL");
  assert.equal(s.outcome!.collapsed, true);
  assert.deepEqual(s.outcome!.winners, []);
});

test("timeout abstains: no votes means no stake and no result", () => {
  const s = setup(4);
  toVote(s);
  const before = ids(s).map((id) => wallet(s, id));
  onDeadline(s, s.deadline! + 1);
  const r = s.rounds[0].result!;
  assert.equal(r.winner, null);
  assert.deepEqual(ids(s).map((id) => wallet(s, id)), before);
  assert.equal(s.phase, "RECAP");
});

test("card effects hit the named targets and never go below zero", () => {
  const s = setup(4);
  const rec = currentRound(s)!;
  s.players.find((p) => p.id === rec.primary)!.wallet = 2; // keep enough to stake, nothing after
  s.minted -= 10; // keep the money check honest after the manual edit
  toVote(s);
  vote(s, Object.fromEntries(ids(s).map((id) => [id, "X"])));
  for (const p of s.players) assert.ok(p.wallet >= 0);
  assert.ok(moneyBalances(s));
});

test("bribe: accepted once, coins move once, vote locked, duplicate clicks ignored", () => {
  const s = setup(4);
  const [a, b] = ids(s);
  assert.ok(cmd(s, a, { type: "OFFER_BRIBE", to: b, amount: 3, side: "X" }).ok);
  assert.equal(cmd(s, a, { type: "OFFER_BRIBE", to: b, amount: 1, side: "X" }).ok, false); // one offer per round
  const id = s.bribes[0].id;
  assert.ok(applyCommand(s, b, "dup-1", { type: "RESPOND_BRIBE", id, accept: true }, T0).ok);
  const again = applyCommand(s, b, "dup-1", { type: "RESPOND_BRIBE", id, accept: true }, T0);
  assert.equal((again as any).duplicate, true);
  assert.equal(wallet(s, a), 9);
  assert.equal(wallet(s, b), 15);
  toVote(s);
  assert.equal(currentRound(s)!.votes[b], "X");
  assert.equal(cmd(s, b, { type: "VOTE", side: "H" }).ok, false); // locked
  assert.ok(moneyBalances(s));
});

test("bribe declined moves nothing; unaffordable bribe is refused", () => {
  const s = setup(4);
  const [a, b, c] = ids(s);
  cmd(s, a, { type: "OFFER_BRIBE", to: b, amount: 2, side: "H" });
  assert.ok(cmd(s, b, { type: "RESPOND_BRIBE", id: s.bribes[0].id, accept: false }).ok);
  assert.equal(wallet(s, a), 12);
  s.players.find((p) => p.id === c)!.wallet = 0;
  s.minted -= 12;
  assert.equal(cmd(s, c, { type: "OFFER_BRIBE", to: b, amount: 1, side: "H" }).ok, false);
});

test("a bribed player can't spend their stake on a loan", () => {
  const s = setup(4);
  const [a, b, c] = ids(s);
  s.players.find((p) => p.id === b)!.wallet = 0;
  s.minted -= 12;
  cmd(s, a, { type: "OFFER_BRIBE", to: b, amount: 2, side: "X" });
  assert.ok(cmd(s, b, { type: "RESPOND_BRIBE", id: s.bribes[0].id, accept: true }).ok);
  assert.equal(cmd(s, b, { type: "OFFER_LOAN", to: c, amount: 2 }).ok, false);
});

test("loans transfer on acceptance and repay with interest at the end, capped at the wallet", () => {
  const s = setup(4);
  const [a, b, c] = ids(s);
  assert.ok(cmd(s, a, { type: "OFFER_LOAN", to: b, amount: 4 }).ok);
  assert.ok(cmd(s, b, { type: "RESPOND_LOAN", id: s.loans[0].id, accept: true }).ok);
  assert.equal(wallet(s, a), 8);
  assert.equal(wallet(s, b), 16);
  assert.ok(cmd(s, c, { type: "OFFER_LOAN", to: b, amount: 2 }).ok);
  assert.ok(cmd(s, b, { type: "RESPOND_LOAN", id: s.loans[1].id, accept: true }).ok);
  // Fast-forward to the end with b nearly broke.
  s.players.find((p) => p.id === b)!.wallet = 6;
  s.minted -= 12;
  s.round = s.settings.rounds;
  s.phase = "RECAP";
  s.deadline = T0;
  onDeadline(s, T0 + 1);
  assert.equal(s.phase, "REVEAL");
  assert.equal(s.loans[0].repaid, 5); // first loan: 4 + 1 interest
  assert.equal(s.loans[1].repaid, 1); // second loan gets what's left
  assert.equal(wallet(s, b), 0);
  assert.ok(moneyBalances(s));
});

