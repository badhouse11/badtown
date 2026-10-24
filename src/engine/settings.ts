// Every tunable number in the game lives here. Nothing is hard-coded elsewhere.
// Values come from design v1.1 and the economy simulations in /sim.

export interface Settings {
  minPlayers: number;
  maxPlayers: number;
  startCoins: number;
  stake: number;
  /** Coins every HARM voter pockets, win or lose. */
  skim: number;
  /** Coins every resident (not locked up) receives when HELP wins. */
  dividend: number;
  startProsperity: number;
  maxProsperity: number;
  /** On a tie, pro-town wins if prosperity is at least this. */
  tieHelpAt: number;
  rounds: number;
  /** The Town Meeting happens after this round. 0 disables it. */
  meetingAfterRound: number;
  /** Number of a locked-up resident's most recent votes that are audited. */
  auditWindow: number;
  /** HARM votes within the window that count as caught skimming. */
  auditThreshold: number;
  /** Fine per HARM vote in the window when caught. */
  finePerHarm: number;
  /** Compensation for a wrongly locked-up resident. */
  wrongfulComp: number;
  plantCost: number;
  bribeMin: number;
  bribeMax: number;
  loanSizes: number[];
  loanInterest: number;
  /** Phase timers in seconds. */
  timers: {
    negotiate: number;
    vote: number;
    recap: number;
    plant: number;
    discuss: number;
    nominate: number;
    lockup: number;
  };
  chatMaxLength: number;
  chatHistory: number;
}

export const DEFAULT_SETTINGS: Settings = {
  minPlayers: 4,
  maxPlayers: 8,
  startCoins: 12,
  stake: 2,
  skim: 3,
  dividend: 1,
  startProsperity: 4,
  maxProsperity: 8,
  tieHelpAt: 4,
  rounds: 8,
  meetingAfterRound: 4,
  auditWindow: 3,
  auditThreshold: 2,
  finePerHarm: 3,
  wrongfulComp: 2,
  plantCost: 1,
  bribeMin: 1,
  bribeMax: 3,
  loanSizes: [2, 4],
  loanInterest: 1,
  timers: {
    negotiate: 45,
    vote: 30,
    recap: 20,
    plant: 20,
    discuss: 45,
    nominate: 30,
    lockup: 12,
  },
  chatMaxLength: 200,
  chatHistory: 60,
};
