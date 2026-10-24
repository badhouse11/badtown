// BADTOWN rules engine. Pure and deterministic: no I/O, no clocks, no globals.
// The same engine runs the multiplayer room server and the in-browser practice mode.

import { CONFIG, TABLES, type Config, type TableSetup } from "./config.ts";
import { pick, randomSeed, shuffle } from "./rng.ts";

// ---------------------------------------------------------------------------------------
// Types

export type Uniform = "guard" | "inmate";
export type Allegiance = "loyal" | "mole" | "rat";
export type Team = "inmates" | "guards";
export type Phase =
  | "LOBBY" | "ROLE" | "DAY" | "COUNT" | "COUNT_RESULT" | "CELLS" | "GUARDROOM" | "MORNING"
  | "TRUSTY_PICK" | "TRUSTY_CHOICE" | "END";

export type CellAct = { kind: "DIG" } | { kind: "SLEEP" } | { kind: "WHISPER"; target: string };
export type GuardAct = { kind: "SEARCH"; target: string } | { kind: "SPOTLIGHT" } | { kind: "TUNNEL" };

export interface Player {
  id: string;
  name: string;
  tokenHash: string;
  seat: number;
  isHost: boolean;
  isBot: boolean;
  ready: boolean;
  connected: boolean;
  uniform: Uniform | null;
  /** Cell number for inmates, badge number for guards. */
  number: number | null;
  rat: boolean;
  promoted: boolean;
  allegiance: Allegiance | null;
  /** The night this player spends in the hole (no digging). */
  holeNight: number | null;
  exposed: boolean;
}

export interface NightRecord {
  night: number;
  cells: Record<string, CellAct>;
  guards: Record<string, GuardAct>;
  inHole: string[];
  diggers: string[];
  caught: string[];
  searches: Record<string, { target: string; found: boolean }>;
  gain: number;
  tunnelAfter: number;
  resolved: boolean;
}

export interface CountVote {
  day: number;
  votes: Record<string, string | null>;
  target: string | null;
  wasRat: boolean | null;
  done: boolean;
}

export interface TrustyPick {
  votes: Record<string, string>;
  chosen: string | null;
  byWarden: boolean;
  allegiance: Allegiance | null;
}

export interface Outcome {
  winner: Team;
  reason: "escape" | "lockdown";
  night: number;
}

export interface ChatLine {
  pid: string;
  name: string;
  text: string;
  at: number;
}

export interface GameState {
  v: "badtown-1";
  code: string;
  createdAt: number;
  gameNo: number;
  phase: Phase;
  deadline: number | null;
  /** Practice mode: no timers, phases advance when everyone has acted. */
  untimed: boolean;
  day: number;
  tunnel: number;
  setup: TableSetup | null;
  config: Config;
  seed: number;
  rng: number;
  players: Player[];
  nights: NightRecord[];
  count: CountVote | null;
  trusty: TrustyPick | null;
  outcome: Outcome | null;
  readyNext: string[];
  chat: ChatLine[];
  seq: number;
  seen: Record<string, string[]>;
}

export type Command =
  | { type: "READY"; ready: boolean }
  | { type: "LEAVE" }
  | { type: "START" }
  | { type: "READY_NEXT" }
  | { type: "CELL"; act: CellAct }
  | { type: "GUARD"; act: GuardAct }
  | { type: "COUNT_VOTE"; target: string | null }
  | { type: "PICK_TRUSTY"; target: string }
  | { type: "CHOOSE_SIDE"; side: "loyal" | "mole" }
  | { type: "CHAT"; text: string }
  | { type: "REMATCH" };

export type Result = { ok: true; duplicate?: boolean } | { ok: false; error: string };

const OK: Result = { ok: true };
const fail = (error: string): Result => ({ ok: false, error });

// ---------------------------------------------------------------------------------------
// Construction

export function newRoom(code: string, now: number, opts: { seed?: number; untimed?: boolean; config?: Partial<Config> } = {}): GameState {
  const seed = opts.seed ?? randomSeed();
  return {
    v: "badtown-1", code, createdAt: now, gameNo: 0, phase: "LOBBY", deadline: null, untimed: !!opts.untimed,
    day: 0, tunnel: 0, setup: null, config: { ...structuredClone(CONFIG), ...(opts.config ?? {}) }, seed, rng: seed,
    players: [], nights: [], count: null, trusty: null, outcome: null, readyNext: [], chat: [], seq: 0, seen: {},
  };
}

export function addPlayer(state: GameState, id: string, rawName: string, tokenHash: string, isBot = false): Result & { player?: Player } {
  if (state.phase !== "LOBBY") return fail("This game has already started.");
  const name = String(rawName ?? "").replace(/\s+/g, " ").trim();
  if (name.length < 1 || name.length > 16) return fail("Names must be 1 to 16 characters.");
  if (state.players.length >= state.config.maxPlayers) return fail("This block is full.");
  if (state.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) return fail("Someone here already has that name.");
  const seat = state.players.reduce((m, p) => Math.max(m, p.seat + 1), 0);
  const player: Player = {
    id, name, tokenHash, seat, isHost: state.players.length === 0, isBot, ready: isBot, connected: isBot,
    uniform: null, number: null, rat: false, promoted: false, allegiance: null, holeNight: null, exposed: false,
  };
  state.players.push(player);
  return { ok: true, player };
}

// ---------------------------------------------------------------------------------------
// Who is who

export const playerById = (s: GameState, id: string) => s.players.find((p) => p.id === id);

export function teamOf(p: Player): Team {
  if (p.promoted) return p.allegiance === "mole" ? "inmates" : "guards";
  if (p.uniform === "guard") return "guards";
  return p.rat ? "guards" : "inmates";
}

/** Players in the cells: inmates who haven't been promoted. */
export const cellmates = (s: GameState) => s.players.filter((p) => p.uniform === "inmate" && !p.promoted);
/** Players in the guard room: guards plus the Trusty. */
export const guardRoom = (s: GameState) => s.players.filter((p) => p.uniform === "guard" || p.promoted);
export const inHole = (s: GameState, p: Player) => p.holeNight === s.day;
export const currentNight = (s: GameState) => s.nights.find((n) => n.night === s.day);

export function actorsFor(s: GameState): Player[] {
  switch (s.phase) {
    case "CELLS": return cellmates(s).filter((p) => !inHole(s, p));
    case "GUARDROOM": return guardRoom(s);
    case "COUNT": return cellmates(s);
    case "TRUSTY_PICK": return s.players.filter((p) => p.uniform === "guard");
    case "TRUSTY_CHOICE": return s.trusty?.chosen ? s.players.filter((p) => p.id === s.trusty!.chosen) : [];
    default: return [];
  }
}

export function hasActed(s: GameState, id: string): boolean {
  const n = currentNight(s);
  switch (s.phase) {
    case "CELLS": return !!n?.cells[id];
    case "GUARDROOM": return !!n?.guards[id];
    case "COUNT": return !!s.count && id in s.count.votes;
    case "TRUSTY_PICK": return !!s.trusty && id in s.trusty.votes;
    case "TRUSTY_CHOICE": return !!s.trusty?.allegiance;
    default: return s.readyNext.includes(id);
  }
}

// ---------------------------------------------------------------------------------------
// Flow

const TIMER: Partial<Record<Phase, keyof Config["timers"]>> = {
  ROLE: "role", DAY: "day", COUNT: "count", COUNT_RESULT: "morning", CELLS: "cells", GUARDROOM: "guardroom",
  MORNING: "morning", TRUSTY_PICK: "trustyPick", TRUSTY_CHOICE: "trustyChoice",
};

function setPhase(s: GameState, phase: Phase, now: number) {
  s.phase = phase;
  s.readyNext = [];
  const key = TIMER[phase];
  s.deadline = key && !s.untimed ? now + s.config.timers[key] * 1000 : null;
}

function startGame(s: GameState, now: number) {
  const setup = { ...TABLES[s.players.length] }; // a copy: rooms must never share or mutate the table
  s.setup = setup;
  Object.assign(s, { day: 0, tunnel: 0, nights: [], count: null, trusty: null, outcome: null });
  const order = shuffle(s, s.players.map((p) => p.id));
  const cells = shuffle(s, Array.from({ length: setup.inmates }, (_, i) => i + 1));
  const badges = shuffle(s, Array.from({ length: setup.guards }, (_, i) => 101 + i * 7));
  order.forEach((id, i) => {
    const p = playerById(s, id)!;
    Object.assign(p, { rat: false, promoted: false, allegiance: null, holeNight: null, exposed: false });
    if (i < setup.guards) {
      p.uniform = "guard";
      p.number = badges[i];
    } else {
      p.uniform = "inmate";
      p.number = cells[i - setup.guards];
    }
  });
  const inmates = s.players.filter((p) => p.uniform === "inmate").map((p) => p.id);
  for (const id of shuffle(s, inmates).slice(0, setup.rats)) playerById(s, id)!.rat = true;
  setPhase(s, "ROLE", now);
}

function startDay(s: GameState, now: number) {
  s.day += 1;
  setPhase(s, "DAY", now);
}

function afterDay(s: GameState, now: number) {
  if (s.config.countDay > 0 && s.day === s.config.countDay && !s.count) {
    s.count = { day: s.day, votes: {}, target: null, wasRat: null, done: false };
    return setPhase(s, "COUNT", now);
  }
  startNight(s, now);
}

function resolveCount(s: GameState, now: number) {
  const c = s.count!;
  const tally: Record<string, number> = {};
  for (const t of Object.values(c.votes)) if (t) tally[t] = (tally[t] ?? 0) + 1;
  const top = Math.max(0, ...Object.values(tally));
  const leaders = Object.keys(tally).filter((id) => tally[id] === top);
  if (top > 0 && leaders.length === 1) {
    const target = playerById(s, leaders[0])!;
    c.target = target.id;
    c.wasRat = target.rat;
    if (target.rat) target.exposed = true;
    else target.holeNight = s.day; // the wrongly accused spends tonight in the hole
  }
  c.done = true;
  setPhase(s, "COUNT_RESULT", now);
}

function startNight(s: GameState, now: number) {
  s.nights.push({
    night: s.day, cells: {}, guards: {}, inHole: cellmates(s).filter((p) => inHole(s, p)).map((p) => p.id),
    diggers: [], caught: [], searches: {}, gain: 0, tunnelAfter: s.tunnel, resolved: false,
  });
  setPhase(s, "CELLS", now);
}

function closeCells(s: GameState, now: number) {
  const n = currentNight(s)!;
  for (const p of actorsFor(s)) if (!n.cells[p.id]) n.cells[p.id] = { kind: "SLEEP" };
  setPhase(s, "GUARDROOM", now);
}

function resolveNight(s: GameState, now: number) {
  const n = currentNight(s)!;
  for (const p of guardRoom(s)) if (!n.guards[p.id]) n.guards[p.id] = { kind: "SPOTLIGHT" };
  const diggers = Object.entries(n.cells).filter(([, a]) => a.kind === "DIG").map(([id]) => id);
  const searched = new Set<string>();
  for (const [gid, a] of Object.entries(n.guards)) {
    if (a.kind === "SEARCH") {
      searched.add(a.target);
      n.searches[gid] = { target: a.target, found: diggers.includes(a.target) };
    }
  }
  n.diggers = diggers;
  n.caught = diggers.filter((id) => searched.has(id));
  for (const id of n.caught) playerById(s, id)!.holeNight = s.day + 1;
  const tunnels = Object.values(n.guards).filter((a) => a.kind === "TUNNEL").length;
  const spots = Object.values(n.guards).filter((a) => a.kind === "SPOTLIGHT").length;
  n.gain = Math.max(0, diggers.length - n.caught.length + tunnels - spots);
  s.tunnel = Math.min(s.setup!.wall, s.tunnel + n.gain);
  n.tunnelAfter = s.tunnel;
  n.resolved = true;
  setPhase(s, "MORNING", now);
}

function afterMorning(s: GameState, now: number) {
  if (s.tunnel >= s.setup!.wall) return endGame(s, "inmates", "escape");
  if (s.day >= s.config.nights) return endGame(s, "guards", "lockdown");
  if (s.day === s.config.trustyAfter && !s.trusty) {
    s.trusty = { votes: {}, chosen: null, byWarden: false, allegiance: null };
    return setPhase(s, "TRUSTY_PICK", now);
  }
  startDay(s, now);
}

export function trustyCandidates(s: GameState): Player[] {
  return cellmates(s).filter((p) => !p.exposed);
}

function appointTrusty(s: GameState, now: number) {
  const t = s.trusty!;
  const cands = trustyCandidates(s);
  if (cands.length === 0) {
    t.chosen = null;
    return startDay(s, now);
  }
  const tally: Record<string, number> = {};
  for (const id of Object.values(t.votes)) tally[id] = (tally[id] ?? 0) + 1;
  const top = Math.max(0, ...Object.values(tally));
  let chosenId: string;
  if (top === 0) {
    chosenId = pick(s, cands.map((p) => p.id).sort());
    t.byWarden = true;
  } else {
    const leaders = Object.keys(tally).filter((id) => tally[id] === top).sort();
    chosenId = leaders.length === 1 ? leaders[0] : pick(s, leaders);
    t.byWarden = leaders.length > 1;
  }
  t.chosen = chosenId;
  const p = playerById(s, chosenId)!;
  p.promoted = true;
  p.holeNight = null;
  if (p.rat) {
    p.allegiance = "rat";
    t.allegiance = "rat";
  }
  setPhase(s, "TRUSTY_CHOICE", now);
}

function closeTrustyChoice(s: GameState, now: number) {
  const t = s.trusty!;
  if (t.chosen && !t.allegiance) {
    playerById(s, t.chosen)!.allegiance = "loyal";
    t.allegiance = "loyal";
  }
  startDay(s, now);
}

function endGame(s: GameState, winner: Team, reason: "escape" | "lockdown") {
  s.outcome = { winner, reason, night: s.day };
  s.phase = "END";
  s.deadline = null;
  s.readyNext = [];
}

function forceAdvance(s: GameState, now: number) {
  switch (s.phase) {
    case "ROLE": return startDay(s, now);
    case "DAY": return afterDay(s, now);
    case "COUNT": return resolveCount(s, now);
    case "COUNT_RESULT": return startNight(s, now);
    case "CELLS": return closeCells(s, now);
    case "GUARDROOM": return resolveNight(s, now);
    case "MORNING": return afterMorning(s, now);
    case "TRUSTY_PICK": return appointTrusty(s, now);
    case "TRUSTY_CHOICE": return closeTrustyChoice(s, now);
  }
}

/** Phases where everyone just presses "ready" to move on. */
const READY_PHASES = new Set<Phase>(["ROLE", "DAY", "COUNT_RESULT", "MORNING"]);

function everyoneReady(s: GameState): boolean {
  // Bots and connected humans both count; disconnected humans never hold the game up.
  const live = s.players.filter((p) => p.connected || p.isBot);
  return live.length > 0 && live.every((p) => s.readyNext.includes(p.id));
}

export function maybeAdvance(s: GameState, now: number): boolean {
  let changed = false;
  for (let guard = 0; guard < 30; guard++) {
    let ready: boolean;
    if (READY_PHASES.has(s.phase)) ready = everyoneReady(s);
    else if (["CELLS", "GUARDROOM", "COUNT", "TRUSTY_PICK", "TRUSTY_CHOICE"].includes(s.phase)) {
      const actors = actorsFor(s);
      ready = actors.every((p) => hasActed(s, p.id) || (!p.connected && !p.isBot && !s.untimed));
      // In the trusty choice, a promoted Rat has nothing to choose; they just confirm.
      if (s.phase === "TRUSTY_CHOICE" && s.trusty?.allegiance === "rat") ready = actors.every((p) => s.readyNext.includes(p.id) || !p.connected);
    } else ready = false;
    if (!ready) break;
    forceAdvance(s, now);
    changed = true;
  }
  return changed;
}

export function onDeadline(s: GameState, now: number): boolean {
  if (s.deadline === null || now < s.deadline) return false;
  forceAdvance(s, now);
  maybeAdvance(s, now);
  return true;
}

// ---------------------------------------------------------------------------------------
// Commands

export function applyCommand(s: GameState, pid: string, cid: string | undefined, cmd: Command, now: number): Result {
  const p = playerById(s, pid);
  if (!p) return fail("You're not in this game.");
  if (cid) {
    const seen = (s.seen[pid] ??= []);
    if (seen.includes(cid)) return { ok: true, duplicate: true };
    seen.push(cid);
    if (seen.length > 50) seen.shift();
  }
  const res = handle(s, p, cmd, now);
  if (res.ok) maybeAdvance(s, now);
  return res;
}

function hostCanAct(s: GameState, p: Player) {
  const host = s.players.find((x) => x.isHost);
  return p.isHost || !host || (!host.connected && !host.isBot);
}

function validCellTarget(s: GameState, actor: Player, id: string) {
  const t = playerById(s, id);
  return !!t && t.id !== actor.id && t.uniform === "inmate" && !t.promoted;
}

function handle(s: GameState, p: Player, cmd: Command, now: number): Result {
  const n = currentNight(s);
  switch (cmd?.type) {
    case "READY":
      if (s.phase !== "LOBBY") return fail("The game has started.");
      p.ready = !!cmd.ready;
      return OK;
    case "LEAVE":
      if (s.phase !== "LOBBY") return fail("You can only leave from the lobby.");
      s.players = s.players.filter((x) => x.id !== p.id);
      if (p.isHost && s.players.length) s.players.sort((a, b) => a.seat - b.seat)[0].isHost = true;
      return OK;
    case "START": {
      if (s.phase !== "LOBBY") return fail("The game has started.");
      if (!hostCanAct(s, p)) return fail("Only the host can start.");
      const count = s.players.length;
      if (!TABLES[count]) return fail(`You need ${s.config.minPlayers} to ${s.config.maxPlayers} players.`);
      if (!s.players.every((x) => x.ready)) return fail("Everyone needs to be ready.");
      startGame(s, now);
      return OK;
    }
    case "READY_NEXT":
      if (!READY_PHASES.has(s.phase) && !(s.phase === "TRUSTY_CHOICE" && s.trusty?.allegiance === "rat")) return fail("Nothing to skip.");
      if (!s.readyNext.includes(p.id)) s.readyNext.push(p.id);
      return OK;
    case "CELL": {
      if (s.phase !== "CELLS" || !n) return fail("It's not lights out in the cells.");
      if (!actorsFor(s).some((x) => x.id === p.id)) return fail(inHole(s, p) ? "You're in the hole tonight." : "You're not in the cells.");
      if (n.cells[p.id]) return fail("You've already made your move tonight.");
      const a = cmd.act;
      if (a?.kind === "DIG" || a?.kind === "SLEEP") n.cells[p.id] = { kind: a.kind };
      else if (a?.kind === "WHISPER") {
        if (!p.rat || p.exposed) return fail("Only the Rat can whisper.");
        if (!validCellTarget(s, p, a.target)) return fail("Pick another cell.");
        n.cells[p.id] = { kind: "WHISPER", target: a.target };
      } else return fail("Pick dig or sleep.");
      return OK;
    }
    case "GUARD": {
      if (s.phase !== "GUARDROOM" || !n) return fail("It's not your watch.");
      if (!guardRoom(s).some((x) => x.id === p.id)) return fail("You're not a guard.");
      if (n.guards[p.id]) return fail("You've already made your move tonight.");
      const a = cmd.act;
      if (a?.kind === "SPOTLIGHT") n.guards[p.id] = { kind: "SPOTLIGHT" };
      else if (a?.kind === "TUNNEL") {
        if (p.allegiance !== "mole") return fail("Only the Mole can do that.");
        n.guards[p.id] = { kind: "TUNNEL" };
      } else if (a?.kind === "SEARCH") {
        const t = playerById(s, a.target);
        if (!t || !validCellTarget(s, p, t.id)) return fail("Pick a cell to search.");
        if (inHole(s, t)) return fail("That cell is empty tonight. They're in the hole.");
        n.guards[p.id] = { kind: "SEARCH", target: t.id };
      } else return fail("Pick search or spotlight.");
      return OK;
    }
    case "COUNT_VOTE":
      if (s.phase !== "COUNT" || !s.count) return fail("The vote isn't open.");
      if (!cellmates(s).some((x) => x.id === p.id)) return fail("Only the cells vote.");
      if (p.id in s.count.votes) return fail("You've already voted.");
      if (cmd.target !== null && !validCellTarget(s, p, cmd.target)) return fail("Pick another cell.");
      s.count.votes[p.id] = cmd.target;
      return OK;
    case "PICK_TRUSTY":
      if (s.phase !== "TRUSTY_PICK" || !s.trusty) return fail("The appointment isn't open.");
      if (p.uniform !== "guard") return fail("Only the guards appoint the Trusty.");
      if (p.id in s.trusty.votes) return fail("You've already chosen.");
      if (!trustyCandidates(s).some((x) => x.id === cmd.target)) return fail("Pick an inmate.");
      s.trusty.votes[p.id] = cmd.target;
      return OK;
    case "CHOOSE_SIDE":
      if (s.phase !== "TRUSTY_CHOICE" || !s.trusty) return fail("There's nothing to choose.");
      if (s.trusty.chosen !== p.id) return fail("You're not the Trusty.");
      if (s.trusty.allegiance) return fail("You've already chosen.");
      if (cmd.side !== "loyal" && cmd.side !== "mole") return fail("Pick a side.");
      p.allegiance = cmd.side;
      s.trusty.allegiance = cmd.side;
      return OK;
    case "CHAT": {
      const text = String(cmd.text ?? "").replace(/\s+/g, " ").trim().slice(0, s.config.chatMaxLength);
      if (!text) return fail("Say something.");
      s.chat.push({ pid: p.id, name: p.name, text, at: now });
      if (s.chat.length > s.config.chatHistory) s.chat.splice(0, s.chat.length - s.config.chatHistory);
      return OK;
    }
    case "REMATCH":
      if (s.phase !== "END") return fail("The game isn't over.");
      if (!hostCanAct(s, p)) return fail("Only the host can start a rematch.");
      s.gameNo += 1;
      s.seed = (s.seed * 1103515245 + 12345) | 0;
      s.rng = s.seed;
      Object.assign(s, { phase: "LOBBY", deadline: null, day: 0, tunnel: 0, setup: null, nights: [], count: null, trusty: null, outcome: null, readyNext: [], chat: [] });
      for (const x of s.players) Object.assign(x, { ready: x.isBot, uniform: null, number: null, rat: false, promoted: false, allegiance: null, holeNight: null, exposed: false });
      return OK;
    default:
      return fail("Unknown command.");
  }
}

// ---------------------------------------------------------------------------------------
// Views: the ONLY data that leaves the server. Every secret is filtered here.

export function publicView(s: GameState) {
  const n = currentNight(s);
  const last = [...s.nights].reverse().find((x) => x.resolved);
  const showHole = ["CELLS", "GUARDROOM", "COUNT_RESULT"].includes(s.phase);
  return {
    code: s.code,
    gameNo: s.gameNo,
    phase: s.phase,
    deadline: s.deadline,
    untimed: s.untimed,
    day: s.day,
    nights: s.config.nights,
    tunnel: s.tunnel,
    wall: s.setup?.wall ?? null,
    setup: s.setup,
    countDay: s.config.countDay,
    trustyAfter: s.config.trustyAfter,
    players: s.players.slice().sort((a, b) => a.seat - b.seat).map((p) => ({
      id: p.id,
      name: p.name,
      isHost: p.isHost,
      isBot: p.isBot,
      ready: p.ready,
      connected: p.connected,
      uniform: p.uniform,
      number: p.number,
      promoted: p.promoted,
      exposed: p.exposed,
      inHole: showHole && inHole(s, p),
      acted: actorsFor(s).some((a) => a.id === p.id) ? hasActed(s, p.id) : null,
      movedOn: s.readyNext.includes(p.id),
    })),
    morning: last && s.phase === "MORNING" ? { night: last.night, gain: last.gain, tunnel: last.tunnelAfter, caught: last.caught } : null,
    history: s.nights.filter((x) => x.resolved).map((x) => ({ night: x.night, gain: x.gain, tunnel: x.tunnelAfter, caught: x.caught })),
    count: s.count ? { day: s.count.day, votesIn: Object.keys(s.count.votes).length, done: s.count.done, target: s.count.done ? s.count.target : null, wasRat: s.count.done ? s.count.wasRat : null } : null,
    trusty: s.trusty ? { chosen: s.trusty.chosen, byWarden: s.trusty.byWarden, picksIn: Object.keys(s.trusty.votes).length } : null,
    chat: s.chat,
    outcome: s.phase === "END" ? s.outcome : null,
  };
}

export function privateView(s: GameState, pid: string) {
  const p = playerById(s, pid);
  if (!p) return null;
  const n = currentNight(s);
  const inGuardRoom = p.uniform === "guard" || p.promoted;
  const actors = actorsFor(s);
  return {
    id: p.id,
    name: p.name,
    isHost: p.isHost,
    uniform: p.uniform,
    number: p.number,
    rat: p.rat,
    exposed: p.exposed,
    promoted: p.promoted,
    allegiance: p.allegiance,
    team: p.uniform ? teamOf(p) : null,
    inHole: inHole(s, p) && ["CELLS", "GUARDROOM", "COUNT_RESULT"].includes(s.phase),
    mustAct: actors.some((a) => a.id === p.id) && !hasActed(s, p.id),
    cellAct: n?.cells[p.id] ?? null,
    guardAct: n?.guards[p.id] ?? null,
    // Guard room only: tonight's whispers from the cells, and your own search results.
    whispers: inGuardRoom && n && s.phase === "GUARDROOM"
      ? Object.values(n.cells).filter((a) => a.kind === "WHISPER").map((a) => (a as { target: string }).target)
      : [],
    searches: inGuardRoom ? s.nights.filter((x) => x.resolved && x.searches[p.id]).map((x) => ({ night: x.night, ...x.searches[p.id] })) : [],
    countVote: s.count && p.id in s.count.votes ? s.count.votes[p.id] : undefined,
    trustyVote: s.trusty?.votes[p.id],
  };
}

/** Everything, laid bare. Only once the game is over. */
export function finalReveal(s: GameState) {
  return {
    outcome: s.outcome,
    tunnel: s.tunnel,
    wall: s.setup?.wall,
    players: s.players.map((p) => ({
      id: p.id, name: p.name, uniform: p.uniform, number: p.number, rat: p.rat, promoted: p.promoted,
      allegiance: p.allegiance, exposed: p.exposed, team: teamOf(p), won: s.outcome ? teamOf(p) === s.outcome.winner : false,
    })),
    nights: s.nights.map((x) => ({ night: x.night, cells: x.cells, guards: x.guards, inHole: x.inHole, caught: x.caught, gain: x.gain, tunnel: x.tunnelAfter })),
    count: s.count,
    trusty: s.trusty,
  };
}

export function viewFor(s: GameState, pid: string) {
  return { pub: publicView(s), me: privateView(s, pid), reveal: s.phase === "END" ? finalReveal(s) : null };
}
