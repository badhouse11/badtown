import { CARD_BY_ID } from "./cards.ts";
import type { GameState } from "./types.ts";

export interface PlayerStats {
  votesCast: number;
  helpVotes: number;
  harmVotes: number;
  helpRate: number;
  skimmed: number;
  dividends: number;
  dividendsWhileHarm: number;
  potWinnings: number;
  cardNet: number;
  lent: number;
  borrowed: number;
  repaidOut: number;
  bribesSpent: number;
  bribesTaken: number;
  plants: number;
}

export interface Award {
  key: string;
  title: string;
  blurb: string;
  winners: string[];
}

function topBy(ids: string[], score: (id: string) => number, min = 1): string[] {
  const best = Math.max(...ids.map(score));
  if (!(best >= min)) return [];
  return ids.filter((id) => score(id) === best);
}

/** Everything that was secret, laid bare. Only ever sent once the game is in REVEAL. */
export function computeReveal(state: GameState) {
  const ids = state.players.map((p) => p.id);
  const stats: Record<string, PlayerStats> = {};
  for (const id of ids) {
    stats[id] = { votesCast: 0, helpVotes: 0, harmVotes: 0, helpRate: 0, skimmed: 0, dividends: 0, dividendsWhileHarm: 0, potWinnings: 0, cardNet: 0, lent: 0, borrowed: 0, repaidOut: 0, bribesSpent: 0, bribesTaken: 0, plants: 0 };
  }
  for (const r of state.rounds) {
    for (const [id, side] of Object.entries(r.votes)) {
      if (!r.eligible.includes(id) || !r.result) continue;
      stats[id].votesCast++;
      if (side === "H") stats[id].helpVotes++;
      else stats[id].harmVotes++;
    }
    if (!r.result) continue;
    for (const [id, st] of Object.entries(r.result.settlements)) {
      if (!stats[id]) continue;
      stats[id].skimmed += st.skim;
      stats[id].dividends += st.dividend;
      if (st.dividend && r.votes[id] === "X") stats[id].dividendsWhileHarm += st.dividend;
      stats[id].potWinnings += st.payout - st.stake;
      stats[id].cardNet += st.card;
    }
  }
  for (const l of state.loans) {
    if (l.status !== "accepted") continue;
    stats[l.lender].lent += l.amount;
    stats[l.borrower].borrowed += l.amount;
    stats[l.borrower].repaidOut += l.repaid ?? 0;
  }
  for (const b of state.bribes) {
    if (b.status !== "accepted") continue;
    stats[b.from].bribesSpent += b.amount;
    stats[b.to].bribesTaken += b.amount;
  }
  for (const pl of state.meeting?.plants ?? []) stats[pl.planter].plants++;
  for (const id of ids) {
    const s = stats[id];
    s.helpRate = s.votesCast ? s.helpVotes / s.votesCast : 0;
  }

  const played = state.rounds.filter((r) => r.result).length;
  const minVotes = Math.max(1, Math.ceil(played / 2));
  const m = state.meeting;
  const lockedUp = m?.lockedUp ?? null;
  const awards: Award[] = [
    {
      key: "saint",
      title: "Town Saint",
      blurb: "Backed the town more often than anyone.",
      winners: topBy(ids.filter((id) => stats[id].votesCast >= minVotes), (id) => stats[id].helpRate, 0.0001),
    },
    { key: "skimmer", title: "Chief Skimmer", blurb: "Skimmed the most coins.", winners: topBy(ids, (id) => stats[id].skimmed) },
    { key: "freeloader", title: "Freeloader", blurb: "Took the most dividends in rounds they voted to harm.", winners: topBy(ids, (id) => stats[id].dividendsWhileHarm) },
    { key: "bankroller", title: "Bankroller", blurb: "Lent the most coins.", winners: topBy(ids, (id) => stats[id].lent) },
    { key: "fixer", title: "The Fixer", blurb: "Spent the most on bribes.", winners: topBy(ids, (id) => stats[id].bribesSpent) },
    { key: "mud", title: "Mud Slinger", blurb: "Planted a rumour.", winners: ids.filter((id) => stats[id].plants > 0) },
    {
      key: "wronged",
      title: "Wrongly Accused",
      blurb: "Put in the stocks, and innocent.",
      winners: lockedUp && m?.audit && !m.audit.caught ? [lockedUp] : [],
    },
    {
      key: "caught",
      title: "Caught Red-Handed",
      blurb: "Put in the stocks, and guilty.",
      winners: lockedUp && m?.audit?.caught ? [lockedUp] : [],
    },
    {
      key: "escaped",
      title: "Got Away With It",
      blurb: "Backed harm the most and never saw the stocks.",
      winners: topBy(ids.filter((id) => id !== lockedUp), (id) => stats[id].harmVotes),
    },
  ].filter((a) => a.winners.length > 0);

  return {
    outcome: state.outcome,
    players: state.players.map((p) => ({ id: p.id, name: p.name, profession: p.profession, wallet: p.wallet, stats: stats[p.id] })),
    rounds: state.rounds.map((r) => ({
      round: r.round,
      card: { id: r.cardId, title: CARD_BY_ID[r.cardId].title, helpLabel: CARD_BY_ID[r.cardId].helpLabel, harmLabel: CARD_BY_ID[r.cardId].harmLabel },
      primary: r.primary,
      secondary: r.secondary,
      lockedUp: r.lockedUp,
      votes: r.votes,
      bribeLocked: r.bribeLocked,
      result: r.result,
    })),
    bribes: state.bribes.filter((b) => b.status === "accepted" || b.status === "declined"),
    loans: state.loans.filter((l) => l.status === "accepted"),
    meeting: m,
    awards,
    finalProsperity: state.prosperity,
  };
}
