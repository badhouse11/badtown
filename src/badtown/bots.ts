// Practice-mode opponents. Each bot only uses what its player could know, with one deliberate
// exception: the Rat bot sometimes "overhears" a real digger, standing in for the table talk a
// human Rat would be listening to.

import { actorsFor, cellmates, currentNight, hasActed, inHole, playerById, trustyCandidates, type Command, type GameState, type Player } from "./engine.ts";

type Rand = () => number;

/** Bot temperament. Calibrated so bot-only games land near 50/50 (see test/badtown.test.ts). */
export const BOT = {
  dig: 0.92,
  digAfterHole: 0.8,
  ratDig: 0.25,
  ratOverhear: 0.5,
  followWhisper: 0.65,
  search: 0.5,
  moleTunnel: 0.75,
  becomeMole: 0.7,
};
const choice = <T>(r: Rand, xs: T[]) => xs[Math.floor(r() * xs.length)];
function weighted<T>(r: Rand, xs: T[], w: number[]): T {
  const total = w.reduce((a, b) => a + b, 0);
  let x = r() * total;
  for (let i = 0; i < xs.length; i++) if ((x -= w[i]) <= 0) return xs[i];
  return xs[xs.length - 1];
}

const timesCaught = (s: GameState, id: string) => s.nights.filter((n) => n.caught.includes(id)).length;
const cellName = (p: Player) => `cell ${p.number}`;

/** How Rat-like an inmate looks from the outside: never caught, never in trouble. */
function ratLook(s: GameState, p: Player) {
  if (p.exposed) return 0.05;
  const caught = timesCaught(s, p.id);
  const wronglyVoted = s.count?.target === p.id && s.count.wasRat === false;
  return wronglyVoted ? 0.2 : caught === 0 ? 2 : 0.4 / caught;
}

export function botMove(s: GameState, id: string, r: Rand): Command | null {
  const me = playerById(s, id);
  if (!me) return null;
  const n = currentNight(s);
  switch (s.phase) {
    case "LOBBY":
      return me.ready ? null : { type: "READY", ready: true };
    case "ROLE":
    case "DAY":
    case "COUNT_RESULT":
    case "MORNING":
      return s.readyNext.includes(id) ? null : { type: "READY_NEXT" };
    case "CELLS": {
      if (!actorsFor(s).some((p) => p.id === id) || hasActed(s, id)) return null;
      const others = cellmates(s).filter((p) => p.id !== id && !inHole(s, p));
      if (me.rat && !me.exposed) {
        if (r() < BOT.ratDig || others.length === 0) return { type: "CELL", act: { kind: "DIG" } };
        const diggers = others.filter((p) => n?.cells[p.id]?.kind === "DIG");
        const t = diggers.length && r() < BOT.ratOverhear ? choice(r, diggers) : choice(r, others);
        return { type: "CELL", act: { kind: "WHISPER", target: t.id } };
      }
      if (me.rat) return { type: "CELL", act: { kind: r() < 0.2 ? "DIG" : "SLEEP" } };
      const justOut = s.nights.some((x) => x.night === s.day - 1 && x.caught.includes(id));
      return { type: "CELL", act: { kind: r() < (justOut ? BOT.digAfterHole : BOT.dig) ? "DIG" : "SLEEP" } };
    }
    case "GUARDROOM": {
      if (!n || hasActed(s, id)) return null;
      if (me.allegiance === "mole") return { type: "GUARD", act: r() < BOT.moleTunnel ? { kind: "TUNNEL" } : { kind: "SPOTLIGHT" } };
      const taken = new Set(Object.values(n.guards).flatMap((a) => (a.kind === "SEARCH" ? [a.target] : [])));
      const pool = cellmates(s).filter((p) => !inHole(s, p) && !taken.has(p.id) && p.id !== id);
      const whispered = Object.values(n.cells).flatMap((a) => (a.kind === "WHISPER" ? [a.target] : [])).filter((t) => pool.some((p) => p.id === t));
      if (whispered.length && r() < BOT.followWhisper) return { type: "GUARD", act: { kind: "SEARCH", target: choice(r, whispered) } };
      if (pool.length && r() < BOT.search) {
        const t = weighted(r, pool, pool.map((p) => 0.6 + timesCaught(s, p.id) * 0.8 + (p.exposed ? -0.5 : 0)));
        return { type: "GUARD", act: { kind: "SEARCH", target: t.id } };
      }
      return { type: "GUARD", act: { kind: "SPOTLIGHT" } };
    }
    case "COUNT": {
      if (!cellmates(s).some((p) => p.id === id) || hasActed(s, id)) return null;
      const others = cellmates(s).filter((p) => p.id !== id);
      if (!others.length || r() < 0.1) return { type: "COUNT_VOTE", target: null };
      if (me.rat) {
        const honest = others.filter((p) => !p.rat);
        return { type: "COUNT_VOTE", target: choice(r, honest.length ? honest : others).id };
      }
      return { type: "COUNT_VOTE", target: weighted(r, others, others.map((p) => ratLook(s, p))).id };
    }
    case "TRUSTY_PICK": {
      if (me.uniform !== "guard" || hasActed(s, id)) return null;
      const cands = trustyCandidates(s);
      if (!cands.length) return null;
      return { type: "PICK_TRUSTY", target: weighted(r, cands, cands.map((p) => ratLook(s, p))).id };
    }
    case "TRUSTY_CHOICE": {
      if (s.trusty?.chosen !== id) return null;
      if (s.trusty.allegiance === "rat") return s.readyNext.includes(id) ? null : { type: "READY_NEXT" };
      if (s.trusty.allegiance) return null;
      return { type: "CHOOSE_SIDE", side: r() < BOT.becomeMole ? "mole" : "loyal" };
    }
    default:
      return null;
  }
}

/** One line of yard talk for the day phase, or nothing. Bots lie when it suits them. */
export function botChatter(s: GameState, id: string, r: Rand): string | null {
  const me = playerById(s, id);
  if (!me || s.phase !== "DAY" || r() < 0.35) return null;
  const last = [...s.nights].reverse().find((x) => x.resolved);
  const cells = cellmates(s).filter((p) => p.id !== id);
  const someone = cells.length ? choice(r, cells) : null;
  const lines: string[] = [];
  if (me.uniform === "inmate" && !me.promoted) {
    const dug = last?.cells[id]?.kind === "DIG";
    if (last?.caught.includes(id)) lines.push("Fine, you caught me. Doesn't make me the Rat.", "One night in the hole. Worth it.");
    else if (me.rat) lines.push("Dug all night. My hands are wrecked.", someone ? `${cellName(someone)} is very quiet for someone who says they're digging.` : "Keep digging, lads.", "Somebody in here is talking to the guards. Not me.");
    else if (dug) lines.push("Did my bit last night.", "Another metre from me.", someone ? `Anyone else notice the guards never search ${cellName(someone)}?` : "Keep going.");
    else lines.push("I slept. Someone has to look innocent.", "Laid low last night. They were watching me.");
    if (s.day === s.config.countDay && someone) lines.push(`I'm voting ${cellName(someone)} at the count.`);
  } else if (me.allegiance === "mole") {
    lines.push(someone ? `I searched ${cellName(someone)}. Clean.` : "Quiet night.", "Nothing to report from the guard room.", "I'm one of you lot now. Sort of.");
  } else {
    if (last && last.gain >= 2) lines.push(`${last.gain} metres in one night? Someone's being generous with the truth.`);
    lines.push(someone ? `${cellName(someone)}, we're watching you.` : "We're watching.", "The spotlight doesn't lie.", "Whoever's digging: we know.");
    if (s.day === s.config.trustyAfter) lines.push("Big decision coming. Choose your Trusty carefully.");
  }
  return choice(r, lines);
}
