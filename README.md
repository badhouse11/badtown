# Good Neighbours (badtown)

A multiplayer social betting game for 4 to 8 people, one phone each. Everyone runs a small town together, secretly backing HELP or HARM each round. Harm pays you personally. But if greed sinks the town, nobody wins.

**Status:** functional prototype. Placeholder screens only, on purpose: the look and feel comes later with a creative-direction brief.

- Full rules and design decisions: [`docs/DESIGN.md`](docs/DESIGN.md)
- Putting it online: [`docs/DEPLOY.md`](docs/DEPLOY.md)

## Quick start

You need Node.js 22.18 or newer.

```sh
npm install
npm run dev          # runs the real Cloudflare runtime locally at http://localhost:8787
```

No Wrangler? `npm run local` runs a stand-in server with the same game code and no dependencies.

To test on one computer, open the game in several **private/incognito windows** (each window remembers its own seat), or fill seats with test bots:

```sh
npm run bots -- http://localhost:8787 ROOMCODE 3
```

Bots are a dev tool only. They never appear in real games.

## Tests

```sh
npm test
```

39 tests covering the deck (exactly 100 cards, 60/25/15), every rule, money conservation across 2,000 random full games, the Town Meeting, privacy (nobody can see anyone else's secrets) and the room server itself.

There's also a browser test that plays a full four-player game through the real UI in four headless phone-sized browsers (needs Python Playwright):

```sh
npm run local &
python3 scripts/e2e.py http://localhost:8787 e2e-shots
```

## How it's built

| Path | What it is |
|---|---|
| `src/engine/` | The game itself. Pure TypeScript, no I/O: rules, phases, money ledger, deck, per-player views, final reveal. |
| `src/engine/settings.ts` | Every tunable number (skim, stake, timers, fines…). Change balance here. |
| `src/engine/cards.ts` | All 100 event cards. |
| `src/room.ts` | One Cloudflare Durable Object per room: the single referee. Stores state in its built-in SQLite storage, WebSockets with hibernation, alarms for timers. |
| `src/worker.ts` | Routes `/api/*` to rooms and serves the web app. |
| `public/` | The placeholder web client (plain HTML/JS, no build step). |
| `scripts/` | Local stand-in server, test bots, browser test. |
| `sim/` | The Python economy simulations behind the design decisions. |

**Security model:** phones only send intentions. The room server decides everything and sends each player a view filtered to what they're allowed to know. Nobody, including the host, can see another player's wallet, vote, bribes, loans, rumour or audit until the final reveal.
