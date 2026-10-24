// GOOD NEIGHBOURS v2 engine. Pure and deterministic: no I/O, no clocks.
// The room server passes in `now` and saves the state after every call.

import { CARDS, CARD_BY_ID } from "./cards.ts";
import { derangement, next, int, pick, randomSeed, shuffle } from "./rng.ts";
import { DEFAULT_SETTINGS, type Settings } from "./settings.ts";
import { AGENDA_INFO } from "./agendas.ts";
import { AGENDAS, type Command, type GameState, type Phase, type Player, type Result, type RoundRecord, type Score, type Side } from "./types.ts";

const OK: Result = { ok: true };
const fail = (error: string): Result => ({ ok: false, error });

const TIMER: Partial<Record<Phase, keyof Settings["timers"]>> = {
  AGENDA: "agenda", TALK: "talk", VOTE: "vote", RESULT: "result", GOSSIP: "gossip", ACCUSE: "accuse", VERDICT: "verdict",
};

// ---------------------------------------------------------------------------------------
// Construction

export function newRoom(code: string, now: number, seed: number = randomSeed(), settings?: Partial<Settings>): GameState {
  const s: Settings = { ...structuredClone(DEFAULT_SETTINGS), ...(settings ?? {}) };
  return {
    v: 2, code, createdAt: now, gameNo: 0, phase: "LOBBY", deadline: null, round: 0, town: s.townStart, settings: s,
    seed, rng: seed, players: [], deck: [], deckPos: 0, rounds: [], bribes: [], accusation: null, minted: 0,
    outcome: null, readyNext: [], chat: [], seq: 0, seen: {},
  };
}

export function addPlayer(state: GameState, id: string, rawName: string, tokenHash: string): Result & { player?: Player } {
  if (state.phase !== "LOBBY") return fail("This game has already started.");
  const name = String(rawName ?? "").replace(/\s+/g, " ").trim();
  if (name.length < 1 || name.length > 16) return fail("Names must be 1 to 16 characters.");
  if (state.players.length >= state.settings.maxPlayers) return fail("This town is full.");
  if (state.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) return fail("Someone here already has that name.");
  const seat = state.players.reduce((m, p) => Math.max(m, p.seat + 1), 0);
  const player: Player = { id, name, tokenHash, seat, isHost: state.players.length === 0, ready: false, connected: false, agenda: null, coins: 0, sitOutRound: null };
  state.players.push(player);
  return { ok: true, player };
}

// ---------------------------------------------------------------------------------------
// Helpers

export const player = (state: GameState, id: string) => state.players.find((p) => p.id === id);
export const currentRound = (state: GameState): RoundRecord | undefined => state.rounds[state.rounds.length - 1];
export const sittingOut = (state: GameState, id: string) => player(state, id)?.sitOutRound === state.round;
const isInt = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n);

export function harmCount(state: GameState, id: string, upToRound = Infinity): number {
  return state.rounds.filter((r) => r.round <= upToRound && r.votes[id] === "X").length;
}

function mint(state: GameState, id: string, amount: number) {
  player(state, id)!.coins += amount;
  state.minted += amount;
}

function setPhase(state: GameState, phase: Phase, now: number) {
  state.phase = phase;
  state.readyNext = [];
  const key = TIMER[phase];
  state.deadline = key ? now + state.settings.timers[key] * 1000 : null;
}

function allConnectedIn(state: GameState, ids: Iterable<string>) {
  const set = new Set(ids);
  const conn = state.players.filter((p) => p.connected);
  return conn.length > 0 && conn.every((p) => set.has(p.id));
}

// ---------------------------------------------------------------------------------------
// Flow

function startGame(state: GameState, now: number) {
  const s = state.settings;
  Object.assign(state, { round: 0, town: s.townStart, rounds: [], bribes: [], accusation: null, outcome: null, minted: 0 });
  const agendas = shuffle(state, AGENDAS);
  shuffle(state, state.players.map((p) => p.id)).forEach((id, i) => {
    const p = player(state, id)!;
    p.agenda = agendas[i];
    p.coins = 0;
    p.sitOutRound = null;
    mint(state, id, s.startCoins);
  });
  state.deck = shuffle(state, CARDS.map((c) => c.id));
  state.deckPos = 0;
  setPhase(state, "AGENDA", now);
}

function startRound(state: GameState, now: number) {
  state.round += 1;
  if (state.round > state.settings.rounds) {
    state.round = state.settings.rounds;
    return endGame(state, false);
  }
  const out = state.players.find((p) => p.sitOutRound === state.round)?.id ?? null;
  state.rounds.push({ round: state.round, cardId: state.deck[state.deckPos++], sittingOut: out, eligible: [], votes: {}, bribeLocked: {}, result: null });
  setPhase(state, "TALK", now);
}

function openVote(state: GameState, now: number) {
  const rec = currentRound(state)!;
  for (const b of state.bribes) if (b.round === state.round && b.status === "pending") b.status = "expired";
  rec.eligible = state.players.filter((p) => !sittingOut(state, p.id)).map((p) => p.id);
  for (const b of state.bribes) {
    if (b.round === state.round && b.status === "accepted" && rec.eligible.includes(b.to)) {
      rec.votes[b.to] = b.side;
      rec.bribeLocked[b.to] = b.side;
    }
  }
  setPhase(state, "VOTE", now);
}

function resolve(state: GameState, now: number) {
  const s = state.settings;
  const rec = currentRound(state)!;
  const voters = rec.eligible.filter((id) => rec.votes[id]);
  const help = voters.filter((id) => rec.votes[id] === "H").length;
  const harm = voters.length - help;
  const before = state.town;
  const gains: Record<string, { skim: number; dividend: number }> = {};
  for (const p of state.players) gains[p.id] = { skim: 0, dividend: 0 };

  for (const id of voters) {
    if (rec.votes[id] === "X") {
      mint(state, id, s.skim);
      gains[id].skim = s.skim;
    }
  }
  const winner: Side | null = help > harm ? "H" : harm > help ? "X" : null;
  if (winner === "H") {
    state.town = Math.min(s.townMax, state.town + s.helpUp);
    for (const p of state.players) {
      if (sittingOut(state, p.id)) continue;
      mint(state, p.id, s.dividend);
      gains[p.id].dividend = s.dividend;
    }
  } else if (winner === "X") {
    state.town = Math.max(0, state.town - s.harmDrop);
  }
  rec.result = {
    winner, help, harm,
    flips: shuffle(state, voters.map((id) => rec.votes[id])),
    townBefore: before, townAfter: state.town, gains,
  };
  setPhase(state, "RESULT", now);
}

function afterResult(state: GameState, now: number) {
  if (state.town <= 0) return endGame(state, true);
  const s = state.settings;
  if (state.round === s.accuseAfter && state.round < s.rounds && !state.accusation) {
    const ids = state.players.map((p) => p.id);
    const map = derangement(state, ids);
    const rumours: Record<string, { subject: string; count: number }> = {};
    for (const [hearer, subject] of map) rumours[hearer] = { subject, count: harmCount(state, subject) };
    state.accusation = {
      afterRound: state.round,
      rumours,
      harmAtAccusation: Object.fromEntries(ids.map((id) => [id, harmCount(state, id)])),
      nominations: {},
      tally: {},
      accused: null,
    };
    return setPhase(state, "GOSSIP", now);
  }
  startRound(state, now);
}

function verdict(state: GameState, now: number) {
  const a = state.accusation!;
  const tally: Record<string, number> = {};
  for (const t of Object.values(a.nominations)) if (t) tally[t] = (tally[t] ?? 0) + 1;
  a.tally = tally;
  const top = Math.max(0, ...Object.values(tally));
  if (top > 0) {
    const tied = Object.keys(tally).filter((id) => tally[id] === top).sort();
    a.accused = tied.length === 1 ? tied[0] : pick(state, tied);
    player(state, a.accused)!.sitOutRound = state.round + 1;
  }
  setPhase(state, "VERDICT", now);
}

export function scoreOf(state: GameState, id: string): Score {
  const s = state.settings;
  const b = s.bonus;
  const p = player(state, id)!;
  const harms = harmCount(state, id);
  const voted = state.rounds.some((r) => r.votes[id] && r.eligible.includes(id));
  const a = state.accusation;
  let bonus = 0;
  let reason = "";
  switch (p.agenda) {
    case "pillar":
      if (state.town >= b.pillarTown) [bonus, reason] = [b.pillar, `The town ended at ${state.town}.`];
      else reason = `The town ended at ${state.town}, short of ${b.pillarTown}.`;
      break;
    case "developer": {
      const n = state.rounds.filter((r) => r.result?.winner === "X").length;
      [bonus, reason] = [b.developer * n, `HARM won ${n} round${n === 1 ? "" : "s"}.`];
      break;
    }
    case "gossip": {
      const target = a?.nominations[id];
      const worst = a ? Math.max(...Object.values(a.harmAtAccusation)) : 0;
      if (a && target && worst > 0 && a.harmAtAccusation[target] === worst) [bonus, reason] = [b.gossip, "You pointed at the worst offender."];
      else reason = "You didn't point at the worst offender.";
      break;
    }
    case "chameleon":
      if (harms === 2 || harms === 3) [bonus, reason] = [b.chameleon, `You backed HARM ${harms} times.`];
      else reason = `You backed HARM ${harms} time${harms === 1 ? "" : "s"}.`;
      break;
    case "martyr":
      if (harms === 0 && voted) [bonus, reason] = [b.martyr, "You never backed HARM."];
      else reason = voted ? "You backed HARM." : "You never voted.";
      break;
    case "fixer": {
      const n = state.bribes.filter((x) => x.from === id && x.status === "accepted").length;
      [bonus, reason] = [b.fixer * n, `${n} bribe${n === 1 ? "" : "s"} accepted.`];
      break;
    }
    case "snake": {
      const n = state.rounds.filter((r) => r.votes[id] === "X" && r.result?.winner === "H").length;
      [bonus, reason] = [Math.min(b.snakeCap, b.snake * n), `You harmed unnoticed ${n} time${n === 1 ? "" : "s"}.`];
      break;
    }
    case "neighbour":
      if (a && !Object.values(a.nominations).includes(id)) [bonus, reason] = [b.neighbour, "Nobody pointed at you."];
      else reason = a ? "Someone pointed at you." : "There was no accusation.";
      break;
  }
  return { coins: p.coins, bonus, total: p.coins + bonus, bonusReason: reason };
}

function endGame(state: GameState, collapsed: boolean) {
  const scores: Record<string, Score> = {};
  for (const p of state.players) scores[p.id] = scoreOf(state, p.id);
  const top = Math.max(...Object.values(scores).map((x) => x.total));
  state.outcome = { collapsed, winners: collapsed ? [] : state.players.filter((p) => scores[p.id].total === top).map((p) => p.id), scores };
  state.phase = "END";
  state.deadline = null;
  state.readyNext = [];
}

function forceAdvance(state: GameState, now: number) {
  switch (state.phase) {
    case "AGENDA": return startRound(state, now);
    case "TALK": return openVote(state, now);
    case "VOTE": return resolve(state, now);
    case "RESULT": return afterResult(state, now);
    case "GOSSIP": return setPhase(state, "ACCUSE", now);
    case "ACCUSE": return verdict(state, now);
    case "VERDICT": return startRound(state, now);
  }
}

export function maybeAdvance(state: GameState, now: number): boolean {
  let changed = false;
  for (let guard = 0; guard < 20; guard++) {
    let ready = false;
    if (["AGENDA", "TALK", "RESULT", "GOSSIP", "VERDICT"].includes(state.phase)) ready = allConnectedIn(state, state.readyNext);
    else if (state.phase === "VOTE") {
      const rec = currentRound(state)!;
      ready = rec.eligible.every((id) => rec.votes[id]);
    } else if (state.phase === "ACCUSE") ready = allConnectedIn(state, Object.keys(state.accusation!.nominations));
    if (!ready) break;
    forceAdvance(state, now);
    changed = true;
  }
  return changed;
}

export function onDeadline(state: GameState, now: number): boolean {
  if (state.deadline === null || now < state.deadline) return false;
  forceAdvance(state, now);
  maybeAdvance(state, now);
  return true;
}

// ---------------------------------------------------------------------------------------
// Commands

export function applyCommand(state: GameState, pid: string, cid: string | undefined, cmd: Command, now: number): Result & { duplicate?: boolean } {
  const p = player(state, pid);
  if (!p) return fail("You're not in this town.");
  if (cid) {
    const seen = (state.seen[pid] ??= []);
    if (seen.includes(cid)) return { ok: true, duplicate: true };
    seen.push(cid);
    if (seen.length > 50) seen.shift();
  }
  const res = handle(state, p, cmd, now);
  if (res.ok) maybeAdvance(state, now);
  return res;
}

function hostCanAct(state: GameState, p: Player) {
  const host = state.players.find((x) => x.isHost);
  return p.isHost || !host || !host.connected;
}

function handle(state: GameState, p: Player, cmd: Command, now: number): Result {
  const s = state.settings;
  const rec = currentRound(state);
  switch (cmd?.type) {
    case "READY":
      if (state.phase !== "LOBBY") return fail("The game has started.");
      p.ready = !!cmd.ready;
      return OK;
    case "LEAVE":
      if (state.phase !== "LOBBY") return fail("You can only leave from the lobby.");
      state.players = state.players.filter((x) => x.id !== p.id);
      if (p.isHost && state.players.length) state.players.sort((a, b) => a.seat - b.seat)[0].isHost = true;
      return OK;
    case "START": {
      if (state.phase !== "LOBBY") return fail("The game has started.");
      if (!hostCanAct(state, p)) return fail("Only the host can start.");
      const n = state.players.length;
      if (n < s.minPlayers || n > s.maxPlayers) return fail(`You need ${s.minPlayers} to ${s.maxPlayers} players.`);
      if (!state.players.every((x) => x.ready)) return fail("Everyone needs to be ready.");
      startGame(state, now);
      return OK;
    }
    case "OFFER_BRIBE": {
      if (state.phase !== "TALK") return fail("Bribes happen while you talk.");
      if (sittingOut(state, p.id)) return fail("You're sitting this round out.");
      const to = player(state, cmd.to);
      if (!to || to.id === p.id) return fail("Pick someone else.");
      if (sittingOut(state, to.id)) return fail("They're sitting this round out.");
      if (cmd.side !== "H" && cmd.side !== "X") return fail("Pick a side.");
      if (state.bribes.some((b) => b.round === state.round && b.from === p.id)) return fail("One bribe offer per round.");
      if (p.coins < s.bribe) return fail(`A bribe costs ${s.bribe} coins.`);
      state.bribes.push({ id: `b${++state.seq}`, round: state.round, from: p.id, to: to.id, side: cmd.side, status: "pending" });
      return OK;
    }
    case "RESPOND_BRIBE": {
      if (state.phase !== "TALK") return fail("Too late.");
      const b = state.bribes.find((x) => x.id === cmd.id);
      if (!b || b.to !== p.id || b.round !== state.round || b.status !== "pending") return fail("That offer isn't open.");
      if (!cmd.accept) {
        b.status = "declined";
        return OK;
      }
      if (state.bribes.some((x) => x.round === state.round && x.to === p.id && x.status === "accepted")) return fail("You've already taken one this round.");
      const from = player(state, b.from)!;
      if (from.coins < s.bribe) {
        b.status = "expired";
        return fail("They can't afford it any more.");
      }
      from.coins -= s.bribe;
      p.coins += s.bribe;
      b.status = "accepted";
      return OK;
    }
    case "VOTE":
      if (state.phase !== "VOTE" || !rec) return fail("Voting isn't open.");
      if (!rec.eligible.includes(p.id)) return fail("You're sitting this round out.");
      if (rec.bribeLocked[p.id]) return fail("You took a bribe. Your vote is locked.");
      if (cmd.side !== "H" && cmd.side !== "X") return fail("Pick a side.");
      rec.votes[p.id] = cmd.side;
      return OK;
    case "READY_NEXT":
      if (!["AGENDA", "TALK", "RESULT", "GOSSIP", "VERDICT"].includes(state.phase)) return fail("Nothing to skip.");
      if (!state.readyNext.includes(p.id)) state.readyNext.push(p.id);
      return OK;
    case "NOMINATE":
      if (state.phase !== "ACCUSE") return fail("The accusation isn't open.");
      if (cmd.target !== null) {
        const t = player(state, cmd.target);
        if (!t || t.id === p.id) return fail("Point at someone else.");
      }
      state.accusation!.nominations[p.id] = cmd.target;
      return OK;
    case "CHAT": {
      const text = String(cmd.text ?? "").replace(/\s+/g, " ").trim().slice(0, s.chatMaxLength);
      if (!text) return fail("Say something.");
      state.chat.push({ pid: p.id, name: p.name, text, at: now });
      if (state.chat.length > s.chatHistory) state.chat.splice(0, state.chat.length - s.chatHistory);
      return OK;
    }
    case "REMATCH":
      if (state.phase !== "END") return fail("The game isn't over.");
      if (!hostCanAct(state, p)) return fail("Only the host can start a rematch.");
      rematch(state);
      return OK;
    default:
      return fail("Unknown command.");
  }
}

function rematch(state: GameState) {
  state.gameNo += 1;
  state.seed = (int(state, 2 ** 31) ^ Math.floor(next(state) * 2 ** 31)) | 0;
  state.rng = state.seed;
  Object.assign(state, {
    phase: "LOBBY", deadline: null, round: 0, town: state.settings.townStart, deck: [], deckPos: 0, rounds: [], bribes: [],
    accusation: null, minted: 0, outcome: null, readyNext: [],
  });
  for (const p of state.players) Object.assign(p, { ready: false, agenda: null, coins: 0, sitOutRound: null });
}

/** Coins only enter the game through the rules, and bribes only move them between players. */
export function moneyBalances(state: GameState): boolean {
  return state.players.reduce((t, p) => t + p.coins, 0) === state.minted && state.players.every((p) => p.coins >= 0);
}

export { AGENDA_INFO, CARD_BY_ID };
