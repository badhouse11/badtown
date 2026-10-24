// Every tunable number in the game. Values from design v2 and /sim/sim_v2.py.

export interface Settings {
  minPlayers: number;
  maxPlayers: number;
  rounds: number;
  startCoins: number;
  /** Coins you pocket for backing HARM, win or lose. */
  skim: number;
  /** Coins everyone (not sitting out) gets when HELP wins. */
  dividend: number;
  townStart: number;
  townMax: number;
  /** Town change when HELP wins / HARM wins. Ties change nothing. */
  helpUp: number;
  harmDrop: number;
  /** The accusation happens after this round. */
  accuseAfter: number;
  /** A bribe is always this many coins. */
  bribe: number;
  bonus: {
    pillar: number;
    pillarTown: number;
    developer: number;
    gossip: number;
    chameleon: number;
    martyr: number;
    fixer: number;
    snake: number;
    snakeCap: number;
    neighbour: number;
  };
  /** Phase timers in seconds. */
  timers: {
    agenda: number;
    talk: number;
    vote: number;
    result: number;
    gossip: number;
    accuse: number;
    verdict: number;
  };
  chatMaxLength: number;
  chatHistory: number;
}

export const DEFAULT_SETTINGS: Settings = {
  minPlayers: 3,
  maxPlayers: 8,
  rounds: 6,
  startCoins: 3,
  skim: 2,
  dividend: 1,
  townStart: 5,
  townMax: 10,
  helpUp: 1,
  harmDrop: 2,
  accuseAfter: 3,
  bribe: 2,
  bonus: {
    pillar: 8,
    pillarTown: 8,
    developer: 2,
    gossip: 5,
    chameleon: 3,
    martyr: 8,
    fixer: 4,
    snake: 1,
    snakeCap: 3,
    neighbour: 8,
  },
  timers: {
    agenda: 25,
    talk: 60,
    vote: 30,
    result: 14,
    gossip: 45,
    accuse: 30,
    verdict: 12,
  },
  chatMaxLength: 200,
  chatHistory: 60,
};
