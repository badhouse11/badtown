// BADTOWN tuning. Every number lives here. Wall distances balanced on the real engine with
// best-response play (scripts/calibrate.ts): 39-56% escapes at every table size.

export interface TableSetup {
  guards: number;
  inmates: number;
  rats: number;
  /** Metres from the cells to the wall. */
  wall: number;
}

export const TABLES: Record<number, TableSetup> = {
  4: { guards: 1, inmates: 3, rats: 1, wall: 3 },
  5: { guards: 1, inmates: 4, rats: 1, wall: 7 },
  6: { guards: 2, inmates: 4, rats: 1, wall: 3 },
  7: { guards: 2, inmates: 5, rats: 1, wall: 6 },
  8: { guards: 2, inmates: 6, rats: 2, wall: 7 },
};

export interface Config {
  minPlayers: number;
  maxPlayers: number;
  nights: number;
  /** The cell-block vote happens on this day, before that night. 0 turns it off. */
  countDay: number;
  /** The Trusty is appointed after this night. */
  trustyAfter: number;
  /** Seconds per phase. */
  timers: {
    role: number;
    day: number;
    count: number;
    cells: number;
    guardroom: number;
    morning: number;
    trustyPick: number;
    trustyChoice: number;
  };
  chatMaxLength: number;
  chatHistory: number;
}

export const CONFIG: Config = {
  minPlayers: 4,
  maxPlayers: 8,
  nights: 6,
  countDay: 3,
  trustyAfter: 3,
  timers: { role: 25, day: 60, count: 30, cells: 20, guardroom: 25, morning: 15, trustyPick: 30, trustyChoice: 20 },
  chatMaxLength: 200,
  chatHistory: 80,
};
