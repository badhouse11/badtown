// What each player is allowed to see. This is the ONLY function whose output leaves the
// server, so every secret is filtered here. Nobody, including the host, gets another
// player's wallet, vote, bribes, loans, rumour or audit before the REVEAL phase.

import { CARD_BY_ID } from "./cards.ts";
import { canPlant, currentRound, harmCount } from "./engine.ts";
import { computeReveal } from "./reveal.ts";
import { TEMPLATES } from "./templates.ts";
import type { GameState } from "./types.ts";

const ROUND_PHASES = new Set(["NEGOTIATE", "VOTE", "RECAP"]);
const MEETING_PHASES = new Set(["PLANT", "DISCUSS", "NOMINATE", "LOCKUP"]);

export function publicView(state: GameState) {
  const s = state.settings;
  const rec = currentRound(state);
  const card = rec ? CARD_BY_ID[rec.cardId] : null;
  const m = state.meeting;
  const inRound = ROUND_PHASES.has(state.phase);

  return {
    code: state.code,
    gameNo: state.gameNo,
    phase: state.phase,
    deadline: state.deadline,
    round: state.round,
    rounds: s.rounds,
    prosperity: state.prosperity,
    maxProsperity: s.maxProsperity,
    rules: {
      startCoins: s.startCoins,
      stake: s.stake,
      skim: s.skim,
      dividend: s.dividend,
      tieHelpAt: s.tieHelpAt,
      bribeMin: s.bribeMin,
      bribeMax: s.bribeMax,
      loanSizes: s.loanSizes,
      loanInterest: s.loanInterest,
      plantCost: s.plantCost,
      meetingAfterRound: s.meetingAfterRound,
      minPlayers: s.minPlayers,
      maxPlayers: s.maxPlayers,
      finePerHarm: s.finePerHarm,
      wrongfulComp: s.wrongfulComp,
      auditWindow: s.auditWindow,
      auditThreshold: s.auditThreshold,
    },
    players: state.players
      .slice()
      .sort((a, b) => a.seat - b.seat)
      .map((p) => ({
        id: p.id,
        name: p.name,
        isHost: p.isHost,
        ready: p.ready,
        connected: p.connected,
        profession: p.profession,
        inStocks: inRound && p.lockedForRound === state.round,
        movedOn: state.readyNext.includes(p.id),
      })),
    card:
      card && rec && inRound
        ? {
            id: card.id,
            title: card.title,
            category: card.category,
            premise: card.premise,
            helpLabel: card.helpLabel,
            harmLabel: card.harmLabel,
            helpResult: card.helpResult,
            harmResult: card.harmResult,
            primary: rec.primary,
            secondary: rec.secondary,
            effects: { help: TEMPLATES[card.template].help, harm: TEMPLATES[card.template].harm },
          }
        : null,
    // Public results only: counts and outcomes, never who voted what.
    history: state.rounds
      .filter((r) => r.result)
      .map((r) => ({
        round: r.round,
        title: CARD_BY_ID[r.cardId].title,
        winner: r.result!.winner,
        help: r.result!.help,
        harm: r.result!.harm,
        tieBroken: r.result!.tieBroken,
        prosperityBefore: r.result!.prosperityBefore,
        prosperityAfter: r.result!.prosperityAfter,
      })),
    meeting:
      m && MEETING_PHASES.has(state.phase)
        ? {
            afterRound: m.afterRound,
            nominationsIn: Object.keys(m.nominations).length,
            lockedUp: state.phase === "LOCKUP" ? m.lockedUp : null,
            nominationsAgainst: state.phase === "LOCKUP" && m.lockedUp ? m.tally[m.lockedUp] : null,
          }
        : null,
    chat: state.chat,
    outcome: state.phase === "REVEAL" ? state.outcome : null,
  };
}

export function privateView(state: GameState, pid: string) {
  const p = state.players.find((x) => x.id === pid);
  if (!p) return null;
  const rec = currentRound(state);
  const m = state.meeting;
  const lastResolved = [...state.rounds].reverse().find((r) => r.result);
  const name = (id: string) => state.players.find((x) => x.id === id)?.name ?? "?";

  return {
    id: p.id,
    name: p.name,
    isHost: p.isHost,
    wallet: p.wallet,
    profession: p.profession,
    inStocks: p.lockedForRound === state.round && ROUND_PHASES.has(state.phase),
    canVote: state.phase === "VOTE" && !!rec?.eligible.includes(p.id),
    broke: state.phase === "VOTE" && !!rec && !rec.eligible.includes(p.id) && p.lockedForRound !== state.round,
    myVote: rec && ROUND_PHASES.has(state.phase) ? rec.votes[p.id] ?? null : null,
    lockedSide: rec && ROUND_PHASES.has(state.phase) ? rec.bribeLocked[p.id] ?? null : null,
    bribes: state.bribes
      .filter((b) => b.round === state.round && (b.from === p.id || b.to === p.id))
      .map((b) => ({ id: b.id, from: b.from, fromName: name(b.from), to: b.to, toName: name(b.to), amount: b.amount, side: b.side, status: b.status, mine: b.from === p.id })),
    loans: state.loans
      .filter((l) => l.lender === p.id || l.borrower === p.id)
      .map((l) => ({ id: l.id, round: l.round, lender: l.lender, lenderName: name(l.lender), borrower: l.borrower, borrowerName: name(l.borrower), amount: l.amount, status: l.status, owed: l.amount + state.settings.loanInterest, current: l.round === state.round })),
    settlement: lastResolved?.result ? { round: lastResolved.round, ...lastResolved.result.settlements[p.id] } : null,
    harmVotesSoFar: harmCount(state, p.id),
    canPlant: canPlant(state, p.id),
    myPlant: m?.plants.find((x) => x.planter === p.id) ? { target: m.plants.find((x) => x.planter === p.id)!.target, count: m.plants.find((x) => x.planter === p.id)!.count } : null,
    rumour: m && (state.phase === "DISCUSS" || state.phase === "NOMINATE" || state.phase === "LOCKUP") ? m.rumours[p.id] ?? null : null,
    myNomination: m && p.id in m.nominations ? m.nominations[p.id] : undefined,
    audit: m && state.phase !== "LOBBY" && m.lockedUp === p.id && m.audit ? m.audit : null,
  };
}

export function viewFor(state: GameState, pid: string) {
  return {
    pub: publicView(state),
    me: privateView(state, pid),
    reveal: state.phase === "REVEAL" ? computeReveal(state) : null,
  };
}
