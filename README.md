# Good Neighbours (badtown)

Help your town, or help yourself. Everyone has a secret. If the town falls, everyone loses.

A party game for 3 to 8 people, one phone each, about 15 minutes. Hosted on Cloudflare.

- How the game works: [`docs/DESIGN.md`](docs/DESIGN.md)
- Putting it online: [`docs/DEPLOY.md`](docs/DEPLOY.md)

## Run it locally

You need Node.js 22.18 or newer.

```sh
npm install
npm run dev        # real Cloudflare runtime at http://localhost:8787
```

No Wrangler? `npm run local` runs a stand-in server with the same game code and no dependencies.

To test on one computer, open **private/incognito windows** (each one keeps its own seat), or fill seats with test bots:

```sh
npm run bots -- http://localhost:8787 TOWNCODE 3
```

Bots are a development tool only. They never appear in real games.

## Tests

```sh
npm test
```

Tests cover the deck, every rule and agenda, privacy (nobody sees anyone else's secrets), 2,400 random full games from 3 to 8 players, and the room server.

`scripts/e2e.py` plays a full three-player game in headless phone-sized browsers (needs Python Playwright and `npm run local`).

## How it's built

| Path | What it is |
|---|---|
| `src/engine/` | The game: rules, phases, agendas, the 36 crisis cards, and per-player views. Pure TypeScript, no I/O. |
| `src/engine/settings.ts` | Every tunable number. |
| `src/room.ts` | One Cloudflare Durable Object per room. It's the single referee, saves state, runs sockets and timers. |
| `src/worker.ts` | Routes `/api/*` to rooms and serves the app. |
| `public/` | The web client: plain HTML/CSS/JS, plus `icons.js` (the original icon set). |
| `scripts/` | Local stand-in server, test bots, browser test. |
| `sim/` | The balance simulation behind the agenda numbers. |
