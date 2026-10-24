import { test } from "node:test";
import assert from "node:assert/strict";
import { TABLES } from "../src/badtown/config.ts";
import {
  addPlayer, applyCommand, cellmates, currentNight, finalReveal, guardRoom, newRoom, onDeadline, playerById, publicView,
  teamOf, viewFor, type Command, type GameState,
} from "../src/badtown/engine.ts";
import { botChatter, botMove } from "../src/badtown/bots.ts";

const T0 = 1_000_000;
let cid = 0;
const cmd = (s: GameState, id: string, c: Command) => applyCommand(s, id, `c${++cid}`, c, T0);

function setup(n: number, seed = 1) {
  const s = newRoom("TEST01", T0, { seed });
  for (let i = 0; i < n; i++) addPlayer(s, `p${i}`, `P${i}`, `h${i}`).player!.connected = true;
  for (const p of s.players) cmd(s, p.id, { type: "READY", ready: true });
  assert.ok(cmd(s, "p0", { type: "START" }).ok);
  return s;
}
const all = (s: GameState, c: Command) => s.players.forEach((p) => cmd(s, p.id, c));
const toCells = (s: GameState) => { all(s, { type: "READY_NEXT" }); if (s.phase === "DAY") all(s, { type: "READY_NEXT" }); };
const honest = (s: GameState) => cellmates(s).filter((p) => !p.rat);
const rat = (s: GameState) => cellmates(s).find((p) => p.rat)!;
const guards = (s: GameState) => guardRoom(s);

test("table splits and secret rats match the config for 4 to 8 players", () => {
  for (const n of [4, 5, 6, 7, 8]) {
    const s = setup(n, n);
    const t = TABLES[n];
    assert.equal(s.players.filter((p) => p.uniform === "guard").length, t.guards);
    assert.equal(s.players.filter((p) => p.uniform === "inmate").length, t.inmates);
    assert.equal(s.players.filter((p) => p.rat).length, t.rats);
    assert.ok(s.players.filter((p) => p.rat).every((p) => p.uniform === "inmate"));
    assert.equal(s.phase, "ROLE");
  }
});

test("a night: diggers dig, a search catches, the spotlight takes a metre", () => {
  const s = setup(6, 3);
  toCells(s);
  assert.equal(s.phase, "CELLS");
  const [a, b, c] = honest(s);
  cmd(s, a.id, { type: "CELL", act: { kind: "DIG" } });
  cmd(s, b.id, { type: "CELL", act: { kind: "DIG" } });
  cmd(s, c.id, { type: "CELL", act: { kind: "DIG" } });
  cmd(s, rat(s).id, { type: "CELL", act: { kind: "WHISPER", target: a.id } });
  assert.equal(s.phase, "GUARDROOM");
  const [g1, g2] = guards(s);
  assert.deepEqual(viewFor(s, g1.id).me!.whispers, [a.id]);
  assert.deepEqual(viewFor(s, a.id).me!.whispers, []);
  cmd(s, g1.id, { type: "GUARD", act: { kind: "SEARCH", target: a.id } });
  cmd(s, g2.id, { type: "GUARD", act: { kind: "SPOTLIGHT" } });
  assert.equal(s.phase, "MORNING");
  const n = currentNight(s)!;
  assert.deepEqual(n.caught, [a.id]);
  assert.equal(n.gain, 1); // 3 diggers - 1 caught - 1 spotlight
  assert.equal(s.tunnel, 1);
  assert.equal(playerById(s, a.id)!.holeNight, 2);
  assert.deepEqual(viewFor(s, g1.id).me!.searches, [{ night: 1, target: a.id, found: true }]);
});

test("someone in the hole can't dig or be searched", () => {
  const s = setup(6, 3);
  toCells(s);
  const [a] = honest(s);
  for (const p of cellmates(s)) cmd(s, p.id, { type: "CELL", act: { kind: p.id === a.id ? "DIG" : "SLEEP" } });
  for (const g of guards(s)) cmd(s, g.id, { type: "GUARD", act: g === guards(s)[0] ? { kind: "SEARCH", target: a.id } : { kind: "SPOTLIGHT" } });
  all(s, { type: "READY_NEXT" }); // morning -> day 2
  all(s, { type: "READY_NEXT" }); // day -> cells
  assert.equal(cmd(s, a.id, { type: "CELL", act: { kind: "DIG" } }).ok, false);
  for (const p of cellmates(s)) if (p.id !== a.id) cmd(s, p.id, { type: "CELL", act: { kind: "SLEEP" } });
  assert.equal(cmd(s, guards(s)[0].id, { type: "GUARD", act: { kind: "SEARCH", target: a.id } }).ok, false);
});

test("timeouts: inmates sleep, guards spotlight", () => {
  const s = setup(4, 2);
  toCells(s);
  onDeadline(s, s.deadline! + 1);
  assert.equal(s.phase, "GUARDROOM");
  onDeadline(s, s.deadline! + 1);
  assert.equal(s.phase, "MORNING");
  const n = currentNight(s)!;
  assert.ok(Object.values(n.cells).every((a) => a.kind === "SLEEP"));
  assert.ok(Object.values(n.guards).every((a) => a.kind === "SPOTLIGHT"));
});

function playNights(s: GameState, nights: number, cell: (id: string) => "DIG" | "SLEEP" = () => "SLEEP") {
  for (let i = 0; i < nights; i++) {
    while (!["CELLS"].includes(s.phase)) {
      if (s.phase === "COUNT") for (const p of cellmates(s)) cmd(s, p.id, { type: "COUNT_VOTE", target: null });
      else if (s.phase === "TRUSTY_PICK" || s.phase === "TRUSTY_CHOICE" || s.phase === "END") return;
      else all(s, { type: "READY_NEXT" });
    }
    for (const p of cellmates(s)) cmd(s, p.id, { type: "CELL", act: { kind: cell(p.id) } });
    for (const g of guardRoom(s)) cmd(s, g.id, { type: "GUARD", act: { kind: "SPOTLIGHT" } });
  }
}

test("the count on day 3: naming the Rat exposes them; naming an innocent sends them to the hole", () => {
  for (const right of [true, false]) {
    const s = setup(6, 5);
    playNights(s, 2);
    all(s, { type: "READY_NEXT" }); // morning 2 -> day 3
    all(s, { type: "READY_NEXT" }); // day 3 -> count
    assert.equal(s.phase, "COUNT");
    const target = right ? rat(s) : honest(s)[0];
    for (const p of cellmates(s)) cmd(s, p.id, { type: "COUNT_VOTE", target: p.id === target.id ? cellmates(s).find((x) => x.id !== p.id)!.id : target.id });
    assert.equal(s.phase, "COUNT_RESULT");
    assert.equal(publicView(s).count!.wasRat, right);
    if (right) {
      assert.equal(target.exposed, true);
      all(s, { type: "READY_NEXT" });
      assert.equal(cmd(s, target.id, { type: "CELL", act: { kind: "WHISPER", target: honest(s)[0].id } }).ok, false);
    } else {
      assert.equal(target.holeNight, 3);
    }
  }
});

test("the Trusty: guards must appoint one; a Rat joins quietly, anyone else picks a side", () => {
  for (const pickRat of [true, false]) {
    const s = setup(6, 9);
    playNights(s, 3);
    all(s, { type: "READY_NEXT" });
    assert.equal(s.phase, "TRUSTY_PICK");
    const target = pickRat ? rat(s) : honest(s)[0];
    for (const g of s.players.filter((p) => p.uniform === "guard")) cmd(s, g.id, { type: "PICK_TRUSTY", target: target.id });
    assert.equal(s.phase, "TRUSTY_CHOICE");
    assert.equal(publicView(s).trusty!.chosen, target.id);
    if (pickRat) {
      assert.equal(target.allegiance, "rat");
      assert.equal(cmd(s, target.id, { type: "CHOOSE_SIDE", side: "mole" }).ok, false);
      cmd(s, target.id, { type: "READY_NEXT" });
    } else {
      cmd(s, target.id, { type: "CHOOSE_SIDE", side: "mole" });
      assert.equal(teamOf(target), "inmates");
    }
    assert.equal(s.phase, "DAY");
    assert.equal(s.day, 4);
    assert.ok(guardRoom(s).some((p) => p.id === target.id));
    // Nobody else learns the allegiance.
    for (const p of s.players) if (p.id !== target.id) assert.ok(!JSON.stringify(viewFor(s, p.id)).includes(`"allegiance":"${target.allegiance}"`) || p.id === target.id);
  }
});

test("the Mole can dig from inside the guard room", () => {
  const s = setup(6, 9);
  playNights(s, 3);
  all(s, { type: "READY_NEXT" });
  const m = honest(s)[0];
  for (const g of s.players.filter((p) => p.uniform === "guard")) cmd(s, g.id, { type: "PICK_TRUSTY", target: m.id });
  cmd(s, m.id, { type: "CHOOSE_SIDE", side: "mole" });
  const before = s.tunnel;
  playNights(s, 0);
  all(s, { type: "READY_NEXT" });
  for (const p of cellmates(s)) cmd(s, p.id, { type: "CELL", act: { kind: "SLEEP" } });
  for (const g of guardRoom(s)) cmd(s, g.id, { type: "GUARD", act: g.id === m.id ? { kind: "TUNNEL" } : { kind: "SEARCH", target: cellmates(s)[0].id } });
  assert.equal(s.tunnel, before + 1);
});

test("each game gets its own copy of the table settings", () => {
  const a = setup(4, 1);
  a.setup!.wall = 99;
  const b = setup(4, 2);
  assert.equal(b.setup!.wall, TABLES[4].wall);
  assert.notEqual(TABLES[4].wall, 99);
});

test("escape and lockdown endings", () => {
  const s = setup(4, 4);
  s.setup!.wall = 2;
  playNights(s, 1, () => "DIG");
  all(s, { type: "READY_NEXT" });
  assert.equal(s.phase, "END");
  assert.equal(s.outcome!.winner, "inmates");
  const r = finalReveal(s);
  assert.ok(r.players.filter((p) => p.rat).every((p) => !p.won));

  const t = setup(4, 4);
  for (let i = 0; i < 12 && t.phase !== "END"; i++) {
    playNights(t, 1);
    if (t.phase === "TRUSTY_PICK") for (const g of t.players.filter((p) => p.uniform === "guard")) cmd(t, g.id, { type: "PICK_TRUSTY", target: cellmates(t)[0].id });
    if (t.phase === "TRUSTY_CHOICE") { const c = playerById(t, t.trusty!.chosen!)!; cmd(t, c.id, c.rat ? { type: "READY_NEXT" } : { type: "CHOOSE_SIDE", side: "loyal" }); }
    if (t.phase === "MORNING") all(t, { type: "READY_NEXT" });
  }
  assert.equal(t.phase, "END");
  assert.equal(t.outcome!.winner, "guards");
});

test("privacy: nobody sees anyone else's role, actions or whispers", () => {
  const s = setup(7, 12);
  toCells(s);
  const r = rat(s);
  const h = honest(s)[0];
  cmd(s, r.id, { type: "CELL", act: { kind: "WHISPER", target: h.id } });
  cmd(s, h.id, { type: "CELL", act: { kind: "DIG" } });
  const pub = JSON.stringify(publicView(s));
  assert.ok(!pub.includes('"rat":true'));
  assert.ok(!pub.includes("WHISPER") && !pub.includes('"DIG"'));
  const other = JSON.stringify(viewFor(s, honest(s)[1].id));
  assert.ok(!other.includes("WHISPER") && !other.includes('"rat":true') && !other.includes("tokenHash"));
  assert.equal(viewFor(s, r.id).me!.rat, true);
});

test("bots: 3,000 bot-only games finish and land near the simulated balance", () => {
  let seed = 1;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const results: Record<number, number[]> = {};
  for (const n of [4, 5, 6, 7, 8]) {
    let escapes = 0;
    for (let g = 0; g < 600; g++) {
      const s = newRoom("BOTS01", T0, { seed: g * 31 + n, untimed: true });
      for (let i = 0; i < n; i++) addPlayer(s, `b${i}`, `Bot${i}`, "", true);
      applyCommand(s, "b0", undefined, { type: "START" }, T0);
      let guard = 0;
      while (s.phase !== "END") {
        assert.ok(++guard < 2000, `stalled in ${s.phase}`);
        let moved = false;
        for (const p of s.players) {
          botChatter(s, p.id, rand);
          const m = botMove(s, p.id, rand);
          if (m && applyCommand(s, p.id, undefined, m, T0).ok) moved = true;
        }
        if (!moved) throw new Error(`no bot could move in ${s.phase}`);
      }
      if (s.outcome!.winner === "inmates") escapes++;
    }
    results[n] = [escapes / 600];
  }
  for (const [n, [rate]] of Object.entries(results)) {
    assert.ok(rate > 0.3 && rate < 0.75, `${n} players: bot escape rate ${rate}`);
  }
  console.log("bot escape rates:", Object.entries(results).map(([n, [r]]) => `${n}p ${(r * 100).toFixed(0)}%`).join(", "));
});
