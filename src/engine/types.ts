import type { Settings } from "./settings.ts";

export type Side = "H" | "X"; // H = pro-town (HELP), X = anti-town (HARM)

export const PROFESSIONS = [
  "FARMER",
  "DOCTOR",
  "BUILDER",
  "BANKER",
  "TEACHER",
  "MAYOR",
  "GROCER",
  "MECHANIC",
] as const;
export type Profession = (typeof PROFESSIONS)[number];

export type Phase =
  | "LOBBY"
  | "NEGOTIATE"
  | "VOTE"
  | "RECAP"
  | "PLANT"
  | "DISCUSS"
  | "NOMINATE"
  | "LOCKUP"
  | "REVEAL";

export type Category = "BAD" | "GOOD" | "MORAL";

export interface Effect {
  /** Coin change for the primary target. */
  p: number;
  /** Coin change for the secondary target. */
  s: number;
}

export interface Template {
  id: string;
  name: string;
  help: Effect;
  harm: Effect;
}

export interface EventCard {
  id: string;
  title: string;
  category: Category;
  primaryProfession: Profession | null;
  premise: string;
  helpLabel: string;
  harmLabel: string;
  helpResult: string;
  harmResult: string;
  template: string;
  tags: string[];
  contentVersion: number;
}

export interface Player {
  id: string;
  name: string;
  tokenHash: string;
  seat: number;
  isHost: boolean;
  ready: boolean;
  connected: boolean;
  profession: Profession | null;
  wallet: number;
  /** The round number this player sits out in the stocks, if any. */
  lockedForRound: number | null;
}

export interface Bribe {
  id: string;
  round: number;
  from: string;
  to: string;
  amount: number;
  side: Side;
  status: "pending" | "accepted" | "declined" | "expired";
}

export interface Loan {
  id: string;
  seq: number;
  round: number;
  lender: string;
  borrower: string;
  amount: number;
  status: "pending" | "accepted" | "declined" | "expired";
  repaid: number | null;
  owed: number | null;
}

export interface Settlement {
  stake: number;
  payout: number;
  skim: number;
  dividend: number;
  card: number;
  /** Card penalty that could not be taken because the wallet ran dry. */
  shortfall: number;
  net: number;
}

export interface RoundResult {
  winner: Side | null;
  help: number;
  harm: number;
  tieBroken: boolean;
  unanimous: boolean;
  prosperityBefore: number;
  prosperityAfter: number;
  potIn: number;
  potOut: number;
  settlements: Record<string, Settlement>;
}

export interface RoundRecord {
  round: number;
  cardId: string;
  primary: string;
  secondary: string;
  lockedUp: string | null;
  eligible: string[];
  votes: Record<string, Side>;
  /** Players whose vote was locked by an accepted bribe. */
  bribeLocked: Record<string, Side>;
  result: RoundResult | null;
}

export interface Rumour {
  subject: string;
  count: number;
}

export interface Plant {
  planter: string;
  target: string;
  count: number;
  recipient: string | null;
}

export interface Meeting {
  afterRound: number;
  plants: Plant[];
  trueRumours: Record<string, Rumour>;
  rumours: Record<string, Rumour>;
  nominations: Record<string, string | null>;
  tally: Record<string, number>;
  lockedUp: string | null;
  audit: { caught: boolean; harmCount: number; amount: number } | null;
}

export type Account = string; // a player id, or one of the special accounts below
export const MINT = "@mint";
export const BURN = "@burn";
export const POT = "@pot";

export interface LedgerEntry {
  seq: number;
  round: number;
  kind:
    | "start"
    | "stake"
    | "payout"
    | "skim"
    | "dividend"
    | "card"
    | "bribe"
    | "loan"
    | "repay"
    | "plant"
    | "fine"
    | "compensation";
  from: Account;
  to: Account;
  amount: number;
}

export interface ChatLine {
  pid: string;
  name: string;
  text: string;
  at: number;
}

export interface Outcome {
  collapsed: boolean;
  winners: string[];
  reason: "rounds" | "collapse" | "broke";
}

export interface GameState {
  v: 1;
  code: string;
  createdAt: number;
  gameNo: number;
  phase: Phase;
  deadline: number | null;
  round: number;
  prosperity: number;
  pot: number;
  settings: Settings;
  seed: number;
  rng: number;
  players: Player[];
  deck: string[];
  deckPos: number;
  rounds: RoundRecord[];
  bribes: Bribe[];
  loans: Loan[];
  meeting: Meeting | null;
  ledger: LedgerEntry[];
  minted: number;
  burned: number;
  outcome: Outcome | null;
  /** Players who have pressed "ready / move on" in the current phase. */
  readyNext: string[];
  chat: ChatLine[];
  seq: number;
  /** Recently processed command ids per player, for idempotency. */
  seen: Record<string, string[]>;
}

export type Command =
  | { type: "READY"; ready: boolean }
  | { type: "LEAVE" }
  | { type: "START" }
  | { type: "OFFER_BRIBE"; to: string; amount: number; side: Side }
  | { type: "RESPOND_BRIBE"; id: string; accept: boolean }
  | { type: "OFFER_LOAN"; to: string; amount: number }
  | { type: "RESPOND_LOAN"; id: string; accept: boolean }
  | { type: "VOTE"; side: Side }
  | { type: "READY_NEXT" }
  | { type: "PLANT"; target: string; count: number }
  | { type: "NOMINATE"; target: string | null }
  | { type: "CHAT"; text: string }
  | { type: "REMATCH" };

export type Result = { ok: true } | { ok: false; error: string };
