// GOOD NEIGHBOURS game engine. Pure and deterministic: no I/O, no clocks, no globals.
// The room server passes in `now` and persists the state after every call.

import { CARDS, CARD_BY_ID } from "./cards.ts";
import { derangement, int, next, pick, randomSeed, shuffle } from "./rng.ts";
import { DEFAULT_SETTINGS, type Settings } from "./settings.ts";
import { TEMPLATES } from "./templates.ts";
import {
  BURN,
  MINT,
  POT,
  PROFESSIONS,
  type Account,
  type Command,
  type GameState,
  type LedgerEntry,
  type Phase,
  type Player,
  type Result,
  type RoundRecord,
  type Settlement,
  type Side,
} from "./types.ts";

const OK: Result = { ok: true };
const fail = (error: string): Result => ({ ok: false, error });

const TIMER_KEY: Partial<Record<Phase, keyof Settings["timers"]>> = {
  NEGOTIATE: "negotiate",
  VOTE: "vote",
  RECAP: "recap",
  PLANT: "plant",
  DISCUSS: "discuss",
  NOMINATE: "nominate",
  LOCKUP: "lockup",
};

// ---------------------------------------------------------------------------------------
// Construction

export function newRoom(code: string, now: number, seed: number = randomSeed(), settings?: Partial<Settings>): GameState {
  const s: Settings = { ...structuredClone(DEFAULT_SETTINGS), ...(settings ?? {}) };
  return {
    v: 1,
    code,
    createdAt: now,
    gameNo: 0,
    phase: "LOBBY",
    deadline: null,
    round: 0,
    prosperity: s.startProsperity,
    pot: 0,
    settings: s,
    seed,
    rng: seed,
    players: [],
    deck: [],
    deckPos: 0,
    rounds: [],
    bribes: [],
    loans: [],
    meeting: null,
    ledger: [],
    minted: 0,
    burned: 0,
    outcome: null,
    readyNext: [],
    chat: [],
    seq: 0,
    seen: {},
  };
}

export function addPlayer(
  state: GameState,
  id: string,
  rawName: string,
  tokenHash: string,
): Result & { player?: Player } {
  if (state.phase !== "LOBBY") return fail("This game has already started.");
  const name = String(rawName ?? "").replace(/\s+/g, " ").trim();
  if (name.length < 1 || name.length > 20) return fail("Names must be 1 to 20 characters.");
  if (state.players.length >= state.settings.maxPlayers) return fail("This room is full.");
  if (state.players.some((p) => p.name.toLowerCase() === name.toLowerCase()))
    return fail("Someone in this room already has that name.");
  const seat = state.players.reduce((m, p) => Math.max(m, p.seat + 1), 0);
  const player: Player = {
    id,
    name,
    tokenHash,
    seat,
    isHost: state.players.length === 0,
    ready: false,
    connected: false,
    profession: null,
    wallet: 0,
    lockedForRound: null,
  };
  state.players.push(player);
  return { ok: true, player };
}

// ---------------------------------------------------------------------------------------
// Helpers

export const player = (state: GameState, id: string): Player | undefined => state.players.find((p) => p.id === id);
export const currentRound = (state: GameState): RoundRecord | undefined => state.rounds[state.rounds.length - 1];
const isLocked = (state: GameState, id: string): boolean => player(state, id)?.lockedForRound === state.round;
const isInt = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n);

/** Move coins. Throws if a player or the pot would go negative (callers check first). */
function transfer(state: GameState, from: Account, to: Account, amount: number, kind: LedgerEntry["kind"]): void {
  if (!isInt(amount) || amount <= 0) return;
  if (from === MINT) state.minted += amount;
  else if (from === POT) {
    if (state.pot < amount) throw new Error("pot overdrawn");
    state.pot -= amount;
  } else {
    const p = player(state, from)!;
    if (p.wallet < amount) throw new Error(`wallet overdrawn: ${p.name}`);
    p.wallet -= amount;
  }
  if (to === BURN) state.burned += amount;
  else if (to === POT) state.pot += amount;
  else player(state, to)!.wallet += amount;
  state.ledger.push({ seq: ++state.seq, round: state.round, kind, from, to, amount });
}

/** Coins a player must keep back: their stake, if an accepted bribe has locked their vote. */
function reserved(state: GameState, id: string): number {
  const bribed = state.bribes.some((b) => b.round === state.round && b.to === id && b.status === "accepted");
  return bribed ? state.settings.stake : 0;
}

function setPhase(state: GameState, phase: Phase, now: number): void {
  state.phase = phase;
  state.readyNext = [];
  const key = TIMER_KEY[phase];
  state.deadline = key ? now + state.settings.timers[key] * 1000 : null;
}

function connectedIds(state: GameState): string[] {
  return state.players.filter((p) => p.connected).map((p) => p.id);
}

function allConnectedIn(state: GameState, ids: Iterable<string>): boolean {
  const set = new Set(ids);
  const conn = connectedIds(state);
  return conn.length > 0 && conn.every((id) => set.has(id));
}

/** How many times a player backed HARM, optionally only up to a given round. */
export function harmCount(state: GameState, id: string, upToRound = Infinity): number {
  return state.rounds.filter((r) => r.round <= upToRound && r.votes[id] === "X").length;
}

// ---------------------------------------------------------------------------------------
// Game flow

function startGame(state: GameState, now: number): void {
  const s = state.settings;
  state.round = 0;
  state.prosperity = s.startProsperity;
  state.pot = 0;
  state.rounds = [];
  state.bribes = [];
  state.loans = [];
  state.meeting = null;
  state.outcome = null;
  state.ledger = [];
  state.minted = 0;
  state.burned = 0;

  const seats = shuffle(state, state.players.map((p) => p.id));
  const jobs = shuffle(state, PROFESSIONS);
  seats.forEach((id, i) => {
    const p = player(state, id)!;
    p.profession = jobs[i];
    p.wallet = 0;
    p.lockedForRound = null;
    transfer(state, MINT, id, s.startCoins, "start");
  });

  const inPlay = new Set(state.players.map((p) => p.profession));
  const eligible = CARDS.filter((c) => c.primaryProfession === null || inPlay.has(c.primaryProfession));
  state.deck = shuffle(state, eligible.map((c) => c.id));
  state.deckPos = 0;
  startRound(state, now);
}

function startRound(state: GameState, now: number): void {
  state.round += 1;
  if (state.round > state.settings.rounds) {
    state.round = state.settings.rounds;
    endGame(state, "rounds");
    return;
  }
  const locked = state.players.find((p) => p.lockedForRound === state.round)?.id ?? null;
  const available = state.players.filter((p) => p.id !== locked).map((p) => p.id);

  let cardId: string | null = null;
  let primary = "";
  while (state.deckPos < state.deck.length) {
    const card = CARD_BY_ID[state.deck[state.deckPos++]];
    if (card.primaryProfession) {
      const holder = state.players.find((p) => p.profession === card.primaryProfession);
      if (!holder || holder.id === locked) continue; // never target someone in the stocks
      primary = holder.id;
    } else {
      primary = pick(state, available);
    }
    cardId = card.id;
    break;
  }
  if (!cardId) throw new Error("deck exhausted");
  const secondary = pick(state, available.filter((id) => id !== primary));

  state.rounds.push({
    round: state.round,
    cardId,
    primary,
    secondary,
    lockedUp: locked,
    eligible: [],
    votes: {},
    bribeLocked: {},
    result: null,
  });
  setPhase(state, "NEGOTIATE", now);
}

function openVoting(state: GameState, now: number): void {
  const rec = currentRound(state)!;
  for (const b of state.bribes) if (b.round === state.round && b.status === "pending") b.status = "expired";
  for (const l of state.loans) if (l.round === state.round && l.status === "pending") l.status = "expired";

  const s = state.settings;
  rec.eligible = state.players.filter((p) => !isLocked(state, p.id) && p.wallet >= s.stake).map((p) => p.id);
  for (const b of state.bribes) {
    if (b.round === state.round && b.status === "accepted" && rec.eligible.includes(b.to)) {
      rec.votes[b.to] = b.side;
      rec.bribeLocked[b.to] = b.side;
    }
  }
  if (rec.eligible.length === 0 && state.players.every((p) => p.wallet < s.stake)) {
    endGame(state, "broke");
    return;
  }
  setPhase(state, "VOTE", now);
}

function resolveRound(state: GameState, now: number): void {
  const s = state.settings;
  const rec = currentRound(state)!;
  const card = CARD_BY_ID[rec.cardId];
  const settlements: Record<string, Settlement> = {};
  for (const p of state.players) settlements[p.id] = { stake: 0, payout: 0, skim: 0, dividend: 0, card: 0, shortfall: 0, net: 0 };

  const voters = rec.eligible.filter((id) => rec.votes[id]);
  const help = voters.filter((id) => rec.votes[id] === "H");
  const harm = voters.filter((id) => rec.votes[id] === "X");
  const before = state.prosperity;
  const potIn = state.pot;

  if (voters.length === 0) {
    rec.result = { winner: null, help: 0, harm: 0, tieBroken: false, unanimous: false, prosperityBefore: before, prosperityAfter: before, potIn, potOut: state.pot, settlements };
    setPhase(state, "RECAP", now);
    return;
  }

  let winner: Side;
  let tieBroken = false;
  if (help.length > harm.length) winner = "H";
  else if (harm.length > help.length) winner = "X";
  else {
    winner = state.prosperity >= s.tieHelpAt ? "H" : "X";
    tieBroken = true;
  }
  const winners = winner === "H" ? help : harm;

  // 1. Stakes into the pot, winners split it in whole coins, leftovers roll over.
  for (const id of voters) {
    transfer(state, id, POT, s.stake, "stake");
    settlements[id].stake = s.stake;
  }
  const share = Math.floor((state.pot - winners.length * s.stake) / winners.length);
  for (const id of winners) {
    const amt = s.stake + share;
    transfer(state, POT, id, amt, "payout");
    settlements[id].payout = amt;
  }

  // 2. The skim: every HARM voter pockets coins, win or lose.
  for (const id of harm) {
    transfer(state, MINT, id, s.skim, "skim");
    settlements[id].skim = s.skim;
  }

  // 3. Prosperity.
  state.prosperity = winner === "H" ? Math.min(s.maxProsperity, before + 1) : Math.max(0, before - 1);

  // 4. Card effects on the two targets.
  const tpl = TEMPLATES[card.template];
  const eff = winner === "H" ? tpl.help : tpl.harm;
  for (const [id, amt] of [[rec.primary, eff.p], [rec.secondary, eff.s]] as [string, number][]) {
    if (amt > 0) {
      transfer(state, MINT, id, amt, "card");
      settlements[id].card += amt;
    } else if (amt < 0) {
      const take = Math.min(player(state, id)!.wallet, -amt);
      transfer(state, id, BURN, take, "card");
      settlements[id].card -= take;
      settlements[id].shortfall += -amt - take;
    }
  }

  // 5. Dividend for everyone not in the stocks when the town is helped.
  if (winner === "H") {
    for (const p of state.players) {
      if (isLocked(state, p.id)) continue;
      transfer(state, MINT, p.id, s.dividend, "dividend");
      settlements[p.id].dividend = s.dividend;
    }
  }

  for (const st of Object.values(settlements)) st.net = st.payout - st.stake + st.skim + st.dividend + st.card;
  rec.result = {
    winner,
    help: help.length,
    harm: harm.length,
    tieBroken,
    unanimous: help.length === 0 || harm.length === 0,
    prosperityBefore: before,
    prosperityAfter: state.prosperity,
    potIn,
    potOut: state.pot,
    settlements,
  };

  if (state.prosperity <= 0) endGame(state, "collapse");
  else setPhase(state, "RECAP", now);
}

function afterRecap(state: GameState, now: number): void {
  const s = state.settings;
  if (s.meetingAfterRound > 0 && state.round === s.meetingAfterRound && state.round < s.rounds && !state.meeting) {
    state.meeting = {
      afterRound: state.round,
      plants: [],
      trueRumours: {},
      rumours: {},
      nominations: {},
      tally: {},
      lockedUp: null,
      audit: null,
    };
    setPhase(state, "PLANT", now);
  } else {
    startRound(state, now);
  }
}

export function canPlant(state: GameState, id: string): boolean {
  const m = state.meeting;
  if (!m || state.phase !== "PLANT") return false;
  const p = player(state, id);
  if (!p) return false;
  return harmCount(state, id) > 0 && p.wallet >= state.settings.plantCost && !m.plants.some((x) => x.planter === id);
}

function deliverRumours(state: GameState, now: number): void {
  const m = state.meeting!;
  const ids = state.players.map((p) => p.id);
  const map = derangement(state, ids);
  for (const [hearer, subject] of map) {
    m.trueRumours[hearer] = { subject, count: harmCount(state, subject, m.afterRound) };
  }
  m.rumours = structuredClone(m.trueRumours);
  const replaced = new Set<string>();
  for (const plant of m.plants) {
    let pool = ids.filter((id) => id !== plant.planter && id !== plant.target && !replaced.has(id));
    if (pool.length === 0) pool = ids.filter((id) => id !== plant.planter && id !== plant.target);
    const recipient = pick(state, pool);
    m.rumours[recipient] = { subject: plant.target, count: plant.count };
    plant.recipient = recipient;
    replaced.add(recipient);
  }
  setPhase(state, "DISCUSS", now);
}

function lockUp(state: GameState, now: number): void {
  const s = state.settings;
  const m = state.meeting!;
  const tally: Record<string, number> = {};
  for (const target of Object.values(m.nominations)) if (target) tally[target] = (tally[target] ?? 0) + 1;
  m.tally = tally;
  const top = Math.max(0, ...Object.values(tally));
  if (top > 0) {
    const tied = Object.keys(tally).filter((id) => tally[id] === top).sort();
    const acc = tied.length === 1 ? tied[0] : pick(state, tied);
    m.lockedUp = acc;
    const p = player(state, acc)!;
    p.lockedForRound = state.round + 1;

    const cast = state.rounds.filter((r) => r.votes[acc]).map((r) => r.votes[acc]);
    const recent = cast.slice(-s.auditWindow);
    const harms = recent.filter((v) => v === "X").length;
    if (harms >= s.auditThreshold) {
      const fine = Math.min(p.wallet, s.finePerHarm * harms);
      transfer(state, acc, BURN, fine, "fine");
      m.audit = { caught: true, harmCount: harms, amount: fine };
    } else {
      transfer(state, MINT, acc, s.wrongfulComp, "compensation");
      m.audit = { caught: false, harmCount: harms, amount: s.wrongfulComp };
    }
  }
  setPhase(state, "LOCKUP", now);
}

function endGame(state: GameState, reason: "rounds" | "collapse" | "broke"): void {
  const s = state.settings;
  const due = state.loans.filter((l) => l.status === "accepted" && l.repaid === null).sort((a, b) => a.seq - b.seq);
  for (const l of due) {
    const owed = l.amount + s.loanInterest;
    const pay = Math.min(owed, player(state, l.borrower)!.wallet);
    transfer(state, l.borrower, l.lender, pay, "repay");
    l.owed = owed;
    l.repaid = pay;
  }
  const collapsed = reason === "collapse";
  const top = Math.max(...state.players.map((p) => p.wallet));
  state.outcome = {
    collapsed,
    reason,
    winners: collapsed ? [] : state.players.filter((p) => p.wallet === top).map((p) => p.id),
  };
  state.phase = "REVEAL";
  state.deadline = null;
  state.readyNext = [];
}

function forceAdvance(state: GameState, now: number): void {
  switch (state.phase) {
    case "NEGOTIATE": return openVoting(state, now);
    case "VOTE": return resolveRound(state, now);
    case "RECAP": return afterRecap(state, now);
    case "PLANT": return deliverRumours(state, now);
    case "DISCUSS": return setPhase(state, "NOMINATE", now);
    case "NOMINATE": return lockUp(state, now);
    case "LOCKUP": return startRound(state, now);
  }
}

/** Advance early when everyone who needs to act has acted. Chains through instant transitions. */
export function maybeAdvance(state: GameState, now: number): boolean {
  let changed = false;
  for (let guard = 0; guard < 20; guard++) {
    let ready = false;
    switch (state.phase) {
      case "NEGOTIATE":
      case "RECAP":
      case "PLANT":
      case "DISCUSS":
      case "LOCKUP":
        ready = allConnectedIn(state, state.readyNext);
        break;
      case "VOTE": {
        const rec = currentRound(state)!;
        ready = rec.eligible.every((id) => rec.votes[id]);
        break;
      }
      case "NOMINATE":
        ready = allConnectedIn(state, Object.keys(state.meeting!.nominations));
        break;
    }
    if (!ready) break;
    forceAdvance(state, now);
    changed = true;
  }
  return changed;
}

/** Called by the room's alarm. Ends the phase if its deadline has passed. */
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
  if (!p) return fail("You're not in this room.");
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

function hostCanAct(state: GameState, p: Player): boolean {
  if (p.isHost) return true;
  const host = state.players.find((x) => x.isHost);
  return !host || !host.connected;
}

function handle(state: GameState, p: Player, cmd: Command, now: number): Result {
  const s = state.settings;
  const rec = currentRound(state);
  switch (cmd?.type) {
    case "READY": {
      if (state.phase !== "LOBBY") return fail("Not in the lobby.");
      p.ready = !!cmd.ready;
      return OK;
    }
    case "LEAVE": {
      if (state.phase !== "LOBBY") return fail("You can only leave from the lobby.");
      state.players = state.players.filter((x) => x.id !== p.id);
      if (p.isHost && state.players.length) state.players.sort((a, b) => a.seat - b.seat)[0].isHost = true;
      return OK;
    }
    case "START": {
      if (state.phase !== "LOBBY") return fail("Not in the lobby.");
      if (!hostCanAct(state, p)) return fail("Only the host can start the game.");
      const n = state.players.length;
      if (n < s.minPlayers || n > s.maxPlayers) return fail(`You need ${s.minPlayers} to ${s.maxPlayers} players.`);
      if (!state.players.every((x) => x.ready)) return fail("Everyone needs to be ready.");
      startGame(state, now);
      return OK;
    }
    case "OFFER_BRIBE": {
      if (state.phase !== "NEGOTIATE") return fail("Bribes can only be offered during negotiation.");
      if (isLocked(state, p.id)) return fail("You can't bribe anyone from the stocks.");
      const to = player(state, cmd.to);
      if (!to || to.id === p.id) return fail("Pick another resident.");
      if (isLocked(state, to.id)) return fail("They're in the stocks this round.");
      if (!isInt(cmd.amount) || cmd.amount < s.bribeMin || cmd.amount > s.bribeMax)
        return fail(`Bribes are ${s.bribeMin} to ${s.bribeMax} coins.`);
      if (cmd.side !== "H" && cmd.side !== "X") return fail("Pick a side.");
      if (state.bribes.some((b) => b.round === state.round && b.from === p.id))
        return fail("You've already made a bribe offer this round.");
      if (p.wallet - cmd.amount < reserved(state, p.id)) return fail("You can't afford that.");
      state.bribes.push({ id: `b${++state.seq}`, round: state.round, from: p.id, to: to.id, amount: cmd.amount, side: cmd.side, status: "pending" });
      return OK;
    }
    case "RESPOND_BRIBE": {
      if (state.phase !== "NEGOTIATE") return fail("Too late to respond.");
      const b = state.bribes.find((x) => x.id === cmd.id);
      if (!b || b.to !== p.id || b.round !== state.round || b.status !== "pending") return fail("That offer isn't open.");
      if (!cmd.accept) {
        b.status = "declined";
        return OK;
      }
      if (state.bribes.some((x) => x.round === state.round && x.to === p.id && x.status === "accepted"))
        return fail("You've already taken a bribe this round.");
      const from = player(state, b.from)!;
      if (from.wallet - b.amount < reserved(state, from.id)) {
        b.status = "expired";
        return fail("They can no longer afford it.");
      }
      if (p.wallet + b.amount < s.stake) return fail("You couldn't afford your stake, so you can't accept.");
      transfer(state, from.id, p.id, b.amount, "bribe");
      b.status = "accepted";
      return OK;
    }
    case "OFFER_LOAN": {
      if (state.phase !== "NEGOTIATE") return fail("Loans can only be offered during negotiation.");
      const to = player(state, cmd.to);
      if (!to || to.id === p.id) return fail("Pick another resident.");
      if (!s.loanSizes.includes(cmd.amount)) return fail(`Loans are ${s.loanSizes.join(" or ")} coins.`);
      if (state.loans.some((l) => l.round === state.round && l.lender === p.id))
        return fail("You've already offered a loan this round.");
      if (state.loans.some((l) => l.lender === p.id && l.borrower === to.id && l.status === "accepted"))
        return fail("They already owe you a loan.");
      if (p.wallet - cmd.amount < reserved(state, p.id)) return fail("You can't afford that.");
      state.loans.push({ id: `l${++state.seq}`, seq: state.seq, round: state.round, lender: p.id, borrower: to.id, amount: cmd.amount, status: "pending", repaid: null, owed: null });
      return OK;
    }
    case "RESPOND_LOAN": {
      if (state.phase !== "NEGOTIATE") return fail("Too late to respond.");
      const l = state.loans.find((x) => x.id === cmd.id);
      if (!l || l.borrower !== p.id || l.round !== state.round || l.status !== "pending") return fail("That offer isn't open.");
      if (!cmd.accept) {
        l.status = "declined";
        return OK;
      }
      const lender = player(state, l.lender)!;
      if (lender.wallet - l.amount < reserved(state, lender.id)) {
        l.status = "expired";
        return fail("They can no longer afford it.");
      }
      transfer(state, lender.id, p.id, l.amount, "loan");
      l.status = "accepted";
      return OK;
    }
    case "VOTE": {
      if (state.phase !== "VOTE" || !rec) return fail("Voting isn't open.");
      if (!rec.eligible.includes(p.id)) return fail("You can't vote this round.");
      if (rec.bribeLocked[p.id]) return fail("Your vote is locked by a deal.");
      if (cmd.side !== "H" && cmd.side !== "X") return fail("Pick a side.");
      rec.votes[p.id] = cmd.side;
      return OK;
    }
    case "READY_NEXT": {
      if (!["NEGOTIATE", "RECAP", "PLANT", "DISCUSS", "LOCKUP"].includes(state.phase)) return fail("Nothing to skip.");
      if (!state.readyNext.includes(p.id)) state.readyNext.push(p.id);
      return OK;
    }
    case "PLANT": {
      if (state.phase !== "PLANT") return fail("Rumours can only be planted now.");
      if (!canPlant(state, p.id)) return fail("You can't plant a rumour.");
      const target = player(state, cmd.target);
      if (!target || target.id === p.id) return fail("Pick another resident.");
      if (!isInt(cmd.count) || cmd.count < 0 || cmd.count > state.meeting!.afterRound) return fail("That number doesn't add up.");
      transfer(state, p.id, BURN, s.plantCost, "plant");
      state.meeting!.plants.push({ planter: p.id, target: target.id, count: cmd.count, recipient: null });
      if (!state.readyNext.includes(p.id)) state.readyNext.push(p.id);
      return OK;
    }
    case "NOMINATE": {
      if (state.phase !== "NOMINATE") return fail("Nominations aren't open.");
      if (cmd.target !== null) {
        const t = player(state, cmd.target);
        if (!t || t.id === p.id) return fail("Pick another resident.");
      }
      state.meeting!.nominations[p.id] = cmd.target;
      return OK;
    }
    case "CHAT": {
      const text = String(cmd.text ?? "").replace(/\s+/g, " ").trim().slice(0, s.chatMaxLength);
      if (!text) return fail("Say something.");
      state.chat.push({ pid: p.id, name: p.name, text, at: now });
      if (state.chat.length > s.chatHistory) state.chat.splice(0, state.chat.length - s.chatHistory);
      return OK;
    }
    case "REMATCH": {
      if (state.phase !== "REVEAL") return fail("The game isn't over.");
      if (!hostCanAct(state, p)) return fail("Only the host can start a rematch.");
      rematch(state);
      return OK;
    }
    default:
      return fail("Unknown command.");
  }
}

function rematch(state: GameState): void {
  state.gameNo += 1;
  state.seed = (int(state, 2 ** 31) ^ Math.floor(next(state) * 2 ** 31)) | 0;
  state.rng = state.seed;
  state.phase = "LOBBY";
  state.deadline = null;
  state.round = 0;
  state.prosperity = state.settings.startProsperity;
  state.pot = 0;
  state.deck = [];
  state.deckPos = 0;
  state.rounds = [];
  state.bribes = [];
  state.loans = [];
  state.meeting = null;
  state.ledger = [];
  state.minted = 0;
  state.burned = 0;
  state.outcome = null;
  state.readyNext = [];
  for (const p of state.players) {
    p.ready = false;
    p.profession = null;
    p.wallet = 0;
    p.lockedForRound = null;
  }
}

/** Money check used by tests and the room server: coins are only created or destroyed by the rules. */
export function moneyBalances(state: GameState): boolean {
  const held = state.players.reduce((t, p) => t + p.wallet, 0) + state.pot;
  return held === state.minted - state.burned && state.players.every((p) => p.wallet >= 0) && state.pot >= 0;
}
