import { test } from "node:test";
import assert from "node:assert/strict";
import { publicView, viewFor } from "../src/engine/view.ts";
import { cmd, ids, setup, toVote } from "./helpers.ts";

test("public view never contains wallets, votes, bribes, loans or rumours", () => {
  const s = setup(5);
  const [a, b, c] = ids(s);
  cmd(s, a, { type: "OFFER_BRIBE", to: b, amount: 2, side: "X" });
  cmd(s, b, { type: "RESPOND_BRIBE", id: s.bribes[0].id, accept: true });
  cmd(s, c, { type: "OFFER_LOAN", to: a, amount: 4 });
  cmd(s, a, { type: "RESPOND_LOAN", id: s.loans[0].id, accept: true });
  toVote(s);
  cmd(s, a, { type: "VOTE", side: "H" });
  const { rules, ...rest } = publicView(s); // rules are public settings like "bribeMin", not data
  assert.ok(rules);
  const json = JSON.stringify(rest);
  for (const word of ["wallet", "votes", "bribe", "loan", "rumour", "tokenHash", "lender", "skim\":3"]) {
    assert.ok(!json.includes(word), `public view leaked "${word}"`);
  }
});

test("a player sees only their own secrets", () => {
  const s = setup(5);
  const [a, b, c, d] = ids(s);
  cmd(s, a, { type: "OFFER_BRIBE", to: b, amount: 2, side: "X" });
  cmd(s, c, { type: "OFFER_LOAN", to: a, amount: 2 });
  const vd = viewFor(s, d);
  assert.equal(vd.me!.bribes.length, 0);
  assert.equal(vd.me!.loans.length, 0);
  assert.equal(vd.reveal, null);
  const vb = viewFor(s, b);
  assert.equal(vb.me!.bribes.length, 1);
  assert.equal(vb.me!.wallet, 12);
  // No other player's wallet value appears anywhere in someone else's payload.
  s.players.find((p) => p.id === c)!.wallet = 777;
  assert.ok(!JSON.stringify(viewFor(s, d)).includes("777"));
});

test("the host gets no extra information", () => {
  const s = setup(4);
  const host = s.players.find((p) => p.isHost)!;
  const other = s.players.find((p) => !p.isHost)!;
  toVote(s);
  cmd(s, other.id, { type: "VOTE", side: "X" });
  const hv = viewFor(s, host.id);
  assert.equal(hv.me!.myVote, null);
  assert.ok(!JSON.stringify(hv).includes('"X"'));
});

test("token hashes are never sent to anyone, even at the reveal", () => {
  const s = setup(4);
  s.phase = "REVEAL";
  s.outcome = { collapsed: false, winners: [], reason: "rounds" };
  for (const id of ids(s)) assert.ok(!JSON.stringify(viewFor(s, id)).includes("hash"));
});

test("everything is revealed at the end", () => {
  const s = setup(4);
  toVote(s);
  for (const id of ids(s)) cmd(s, id, { type: "VOTE", side: "X" });
  s.phase = "REVEAL";
  s.outcome = { collapsed: false, winners: [], reason: "rounds" };
  const v = viewFor(s, ids(s)[0]);
  assert.ok(v.reveal);
  assert.equal(v.reveal!.rounds[0].votes[ids(s)[1]], "X");
});
