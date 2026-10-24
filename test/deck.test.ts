import { test } from "node:test";
import assert from "node:assert/strict";
import { CARDS } from "../src/engine/cards.ts";
import { TEMPLATES } from "../src/engine/templates.ts";
import { PROFESSIONS } from "../src/engine/types.ts";

test("deck has exactly 100 unique cards", () => {
  assert.equal(CARDS.length, 100);
  assert.equal(new Set(CARDS.map((c) => c.id)).size, 100);
});

test("10 cards per profession and 20 universal", () => {
  for (const prof of PROFESSIONS) assert.equal(CARDS.filter((c) => c.primaryProfession === prof).length, 10, prof);
  assert.equal(CARDS.filter((c) => c.primaryProfession === null).length, 20);
});

test("category totals are 60 BAD / 25 GOOD / 15 MORAL", () => {
  const count = (cat: string) => CARDS.filter((c) => c.category === cat).length;
  assert.equal(count("BAD"), 60);
  assert.equal(count("GOOD"), 25);
  assert.equal(count("MORAL"), 15);
});

test("every card is fully written and uses a valid template within -2..+2", () => {
  for (const c of CARDS) {
    for (const f of ["title", "premise", "helpLabel", "harmLabel", "helpResult", "harmResult"] as const) {
      assert.ok(c[f] && c[f].length > 2, `${c.id} ${f}`);
    }
    assert.ok(c.premise.includes("{P}"), `${c.id} premise names the primary`);
    const t = TEMPLATES[c.template];
    assert.ok(t, `${c.id} template ${c.template}`);
    for (const v of [t.help.p, t.help.s, t.harm.p, t.harm.s]) assert.ok(v >= -2 && v <= 2);
    assert.ok(!/\{[^PS]\}/.test(c.premise + c.helpResult + c.harmResult), `${c.id} only uses {P} and {S}`);
  }
});

test("seed classifications from the v1.0 brief are preserved", () => {
  const moral = ["FAR08", "FAR10", "DOC10", "BUI10", "BAN08", "BAN10", "TEA09", "TEA10", "MAY10", "GRO10", "MEC10", "UNI17", "UNI18", "UNI19", "UNI20"];
  assert.deepEqual(CARDS.filter((c) => c.category === "MORAL").map((c) => c.id).sort(), moral.sort());
});
