import type { Settings } from "./settings.ts";

export type Side = "H" | "X"; // H = HELP the town, X = HARM it

export const AGENDAS = ["pillar", "developer", "gossip", "chameleon", "martyr", "fixer", "snake", "neighbour"] as const;
export type Agenda = (typeof AGENDAS)[number];

export type Phase = "LOBBY" | "AGENDA" | "TALK" | "VOTE" | "RESULT" | "GOSSIP" | "ACCUSE" | "VERDICT" | "END";

export type CardIcon =
  | "flame" | "wave" | "bolt" | "coins" | "cross" | "bridge" | "burst"
  | "mask" | "food" | "cloud" | "warning" | "build" | "book";

export interface EventCard {
  id: string;
  title: string;
  icon: CardIcon;
  premise: string;
  helpLabel: string;
  harmLabel: string;
  helpResult: string;
  harmResult: string;
}

export interface Player {
  id: string;
  name: string;
  tokenHash: string;
  seat: number;
  isHost: boolean;
  ready: boolean;
  connected: boolean;
  agenda: Agenda | null;
  coins: number;
  /** The round this player sits out after being accused. */
  sitOutRound: number | null;
}

export interface Bribe {
  id: string;
  round: number;
  from: string;
  to: string;
  side: Side;
  status: "pending" | "accepted" | "declined" | "expired";
}

export interface RoundResult {
  winner: Side | null; // null = tie or nobody voted
  help: number;
  harm: number;
  /** Every vote, shuffled, so the reveal can flip them one at a time anonymously. */
  flips: Side[];
  townBefore: number;
  townAfter: number;
  gains: Record<string, { skim: number; dividend: number }>;
}

export interface RoundRecord {
  round: number;
  cardId: string;
  sittingOut: string | null;
  eligible: string[];
  votes: Record<string, Side>;
  bribeLocked: Record<string, Side>;
  result: RoundResult | null;
}

export interface Rumour {
  subject: string;
  count: number;
}

export interface Accusation {
  afterRound: number;
  rumours: Record<string, Rumour>;
  /** HARM counts at the moment of the accusation (used for the Gossip agenda). */
  harmAtAccusation: Record<string, number>;
  nominations: Record<string, string | null>;
  tally: Record<string, number>;
  accused: string | null;
}

export interface Score {
  coins: number;
  bonus: number;
  total: number;
  bonusReason: string;
}

export interface Outcome {
  collapsed: boolean;
  winners: string[];
  scores: Record<string, Score>;
}

export interface ChatLine {
  pid: string;
  name: string;
  text: string;
  at: number;
}

export interface GameState {
  v: 2;
  code: string;
  createdAt: number;
  gameNo: number;
  phase: Phase;
  deadline: number | null;
  round: number;
  town: number;
  settings: Settings;
  seed: number;
  rng: number;
  players: Player[];
  deck: string[];
  deckPos: number;
  rounds: RoundRecord[];
  bribes: Bribe[];
  accusation: Accusation | null;
  minted: number;
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
  | { type: "OFFER_BRIBE"; to: string; side: Side }
  | { type: "RESPOND_BRIBE"; id: string; accept: boolean }
  | { type: "VOTE"; side: Side }
  | { type: "READY_NEXT" }
  | { type: "NOMINATE"; target: string | null }
  | { type: "CHAT"; text: string }
  | { type: "REMATCH" };

export type Result = { ok: true } | { ok: false; error: string };
