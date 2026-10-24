import type { Settings } from "./settings.ts";
import type { Agenda } from "./types.ts";

// Secret agendas: everyone gets one. Nobody is the villain; everyone has a motive.
// Bonuses are added to your coins at the end. Balanced in /sim/sim_v2.py.

export interface AgendaInfo {
  key: Agenda;
  name: string;
  /** One line, shown to the owner on their secret card. */
  goal: (s: Settings) => string;
}

export const AGENDA_INFO: Record<Agenda, AgendaInfo> = {
  pillar: { key: "pillar", name: "The Pillar", goal: (s) => `+${s.bonus.pillar} if the town ends at ${s.bonus.pillarTown} or higher.` },
  developer: { key: "developer", name: "The Developer", goal: (s) => `+${s.bonus.developer} every time HARM wins a round. But if the town collapses, you lose like everyone else.` },
  gossip: { key: "gossip", name: "The Gossip", goal: (s) => `+${s.bonus.gossip} if, at the accusation, you point at whoever has harmed the most so far.` },
  chameleon: { key: "chameleon", name: "The Chameleon", goal: (s) => `+${s.bonus.chameleon} if you back HARM exactly 2 or 3 times.` },
  martyr: { key: "martyr", name: "The Martyr", goal: (s) => `+${s.bonus.martyr} if you never back HARM.` },
  fixer: { key: "fixer", name: "The Fixer", goal: (s) => `+${s.bonus.fixer} for every bribe of yours that gets accepted.` },
  snake: { key: "snake", name: "The Snake", goal: (s) => `+${s.bonus.snake} each time you back HARM and HELP still wins (up to +${s.bonus.snakeCap}).` },
  neighbour: { key: "neighbour", name: "The Good Neighbour", goal: (s) => `+${s.bonus.neighbour} if nobody points at you at the accusation.` },
};

export function agendaCatalogue(s: Settings) {
  return Object.values(AGENDA_INFO).map((a) => ({ key: a.key, name: a.name, goal: a.goal(s) }));
}
