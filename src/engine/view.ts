// What each player may see. The ONLY data that leaves the server, so every secret is filtered
// here. Nobody, including the host, sees another player's agenda, coins, vote, bribes or rumour
// before the END phase. The one exception is by design: the accused's agenda is revealed to all.

import { AGENDA_INFO, agendaCatalogue } from "./agendas.ts";
import { CARD_BY_ID } from "./cards.ts";
import { currentRound, harmCount, sittingOut } from "./engine.ts";
import type { GameState } from "./types.ts";

const ROUND_PHASES = new Set(["TALK", "VOTE", "RESULT"]);

export function publicView(state: GameState) {
  const s = state.settings;
  const rec = currentRound(state);
  const a = state.accusation;
  const card = rec && ROUND_PHASES.has(state.phase) ? CARD_BY_ID[rec.cardId] : null;
  const accusedPublic = a?.accused && (state.phase === "VERDICT" || state.round > a.afterRound || state.phase === "END") ? a.accused : null;

  return {
    code: state.code,
    gameNo: state.gameNo,
    phase: state.phase,
    deadline: state.deadline,
    round: state.round,
    rounds: s.rounds,
    town: state.town,
    townMax: s.townMax,
    rules: {
      minPlayers: s.minPlayers, maxPlayers: s.maxPlayers, skim: s.skim, dividend: s.dividend, helpUp: s.helpUp,
      harmDrop: s.harmDrop, accuseAfter: s.accuseAfter, bribe: s.bribe, startCoins: s.startCoins,
    },
    agendas: agendaCatalogue(s),
    players: state.players
      .slice()
      .sort((x, y) => x.seat - y.seat)
      .map((p) => ({
        id: p.id,
        name: p.name,
        isHost: p.isHost,
        ready: p.ready,
        connected: p.connected,
        sittingOut: ROUND_PHASES.has(state.phase) && sittingOut(state, p.id),
        movedOn: state.readyNext.includes(p.id),
        agenda: p.id === accusedPublic ? p.agenda : null,
      })),
    card: card ? { ...card } : null,
    result: rec?.result && state.phase === "RESULT"
      ? { winner: rec.result.winner, help: rec.result.help, harm: rec.result.harm, flips: rec.result.flips, townBefore: rec.result.townBefore, townAfter: rec.result.townAfter }
      : null,
    votesIn: state.phase === "VOTE" && rec ? Object.keys(rec.votes).length : null,
    history: state.rounds.filter((r) => r.result).map((r) => ({
      round: r.round, title: CARD_BY_ID[r.cardId].title, icon: CARD_BY_ID[r.cardId].icon,
      winner: r.result!.winner, help: r.result!.help, harm: r.result!.harm, townAfter: r.result!.townAfter,
    })),
    accusation: a && ["GOSSIP", "ACCUSE", "VERDICT"].includes(state.phase)
      ? {
          afterRound: a.afterRound,
          nominationsIn: Object.keys(a.nominations).length,
          accused: state.phase === "VERDICT" ? a.accused : null,
          pointsAgainst: state.phase === "VERDICT" && a.accused ? a.tally[a.accused] : null,
        }
      : null,
    chat: state.chat,
  };
}

export function privateView(state: GameState, pid: string) {
  const p = state.players.find((x) => x.id === pid);
  if (!p) return null;
  const rec = currentRound(state);
  const a = state.accusation;
  const name = (id: string) => state.players.find((x) => x.id === id)?.name ?? "?";
  const inRound = ROUND_PHASES.has(state.phase);
  const lastGain = rec?.result && state.phase === "RESULT" ? rec.result.gains[p.id] : null;

  return {
    id: p.id,
    name: p.name,
    isHost: p.isHost,
    coins: p.coins,
    agenda: p.agenda ? { key: p.agenda, name: AGENDA_INFO[p.agenda].name, goal: AGENDA_INFO[p.agenda].goal(state.settings) } : null,
    sittingOut: inRound && sittingOut(state, p.id),
    canVote: state.phase === "VOTE" && !!rec?.eligible.includes(p.id),
    myVote: inRound && rec ? rec.votes[p.id] ?? null : null,
    lockedSide: inRound && rec ? rec.bribeLocked[p.id] ?? null : null,
    harmVotes: harmCount(state, p.id),
    bribes: state.bribes
      .filter((b) => b.round === state.round && (b.from === p.id || b.to === p.id) && inRound)
      .map((b) => ({ id: b.id, fromName: name(b.from), toName: name(b.to), side: b.side, status: b.status, mine: b.from === p.id })),
    gain: lastGain,
    rumour: a && (state.phase === "GOSSIP" || state.phase === "ACCUSE") ? a.rumours[p.id] : null,
    myNomination: a && state.phase === "ACCUSE" && p.id in a.nominations ? a.nominations[p.id] : undefined,
  };
}

/** Everything, laid bare. Only built once the game is over. */
export function finalReveal(state: GameState) {
  const a = state.accusation;
  return {
    outcome: state.outcome,
    town: state.town,
    players: state.players.map((p) => ({
      id: p.id, name: p.name, agenda: p.agenda, agendaName: p.agenda ? AGENDA_INFO[p.agenda].name : null,
      agendaGoal: p.agenda ? AGENDA_INFO[p.agenda].goal(state.settings) : null, harmVotes: harmCount(state, p.id),
    })),
    rounds: state.rounds.map((r) => ({
      round: r.round, title: CARD_BY_ID[r.cardId].title, icon: CARD_BY_ID[r.cardId].icon, sittingOut: r.sittingOut,
      votes: r.votes, bribeLocked: r.bribeLocked, winner: r.result?.winner ?? null, townAfter: r.result?.townAfter ?? null,
    })),
    bribes: state.bribes.filter((b) => b.status === "accepted").map((b) => ({ round: b.round, from: b.from, to: b.to, side: b.side })),
    accusation: a ? { rumours: a.rumours, nominations: a.nominations, accused: a.accused, afterRound: a.afterRound } : null,
  };
}

export function viewFor(state: GameState, pid: string) {
  return { pub: publicView(state), me: privateView(state, pid), reveal: state.phase === "END" ? finalReveal(state) : null };
}
