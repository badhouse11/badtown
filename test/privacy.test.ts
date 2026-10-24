import { test } from "node:test";
import assert from "node:assert/strict";
import { viewFor } from "../src/engine/view.ts";
import { cmd, everyoneNext, ids, setup } from "./helpers.ts";

test("nobody can see anyone else's agenda, coins, vote or bribe", () => {
  const s = setup(4);
  cmd(s, "p0", { type: "OFFER_BRIBE", to: "p1", side: "X" });
  s.players[2].coins = 777;
  s.minted += 774;
  everyoneNext(s);
  cmd(s, "p2", { type: "VOTE", side: "X" });
  const v = viewFor(s, "p3");
  const json = JSON.stringify(v);
  for (const other of s.players.filter((p) => p.id !== "p3")) {
    assert.ok(!json.includes(`"${other.agenda}"`) || (v.pub.agendas.some((a) => a.key === other.agenda)), "agenda only appears in the public catalogue");
  }
  assert.ok(!json.includes("777"));
  assert.equal(v.me!.bribes.length, 0);
  assert.equal(v.me!.myVote, null);
  assert.ok(!json.includes("hash"));
  assert.equal(v.reveal, null);
  for (const p of v.pub.players) assert.equal(p.agenda, null);
});

test("the host sees nothing extra", () => {
  const s = setup(3);
  everyoneNext(s);
  cmd(s, "p1", { type: "VOTE", side: "X" });
  const v = viewFor(s, "p0");
  assert.equal(v.me!.myVote, null);
  assert.ok(!JSON.stringify(v.pub).includes('"votes"'));
});

test("your own agenda is visible only to you", () => {
  const s = setup(3);
  for (const id of ids(s)) {
    const me = viewFor(s, id).me!;
    assert.equal(me.agenda!.key, s.players.find((p) => p.id === id)!.agenda);
  }
});
