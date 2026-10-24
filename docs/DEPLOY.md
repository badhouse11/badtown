# Putting Good Neighbours online (Cloudflare)

Plain steps, start to finish. You'll do this on your own computer, in the Terminal app.
Everything here runs on Cloudflare's **free plan**.

## What you need first

1. **A Cloudflare account.** Sign up free at https://dash.cloudflare.com/sign-up if you don't have one.
2. **Node.js, version 22.18 or newer.**
   - Check: open Terminal and type `node --version`, then press Enter.
   - If it says "command not found" or a number lower than 22.18, download the **LTS** installer from https://nodejs.org and run it. Then close and reopen Terminal.
3. **Git.** On a Mac, type `git --version`. If it isn't installed, macOS will offer to install it. Click Install.

## Step 1: Download the code

In Terminal, run these one at a time:

```sh
cd ~/Documents
git clone https://github.com/badhouse11/badtown.git
cd badtown
```

You're now "inside" the project folder. All the commands below must be run from here.
(If you close Terminal, get back here with `cd ~/Documents/badtown`.)

## Step 2: Install the tools

```sh
npm install
```

This downloads Cloudflare's tool (Wrangler) and a couple of helpers into the project. It takes a minute. Warnings in yellow are normal.

## Step 3: Check everything works

```sh
npm test
```

You should see `# pass 39` and `# fail 0` near the end.

## Step 4: Try it on your computer (optional but recommended)

```sh
npm run dev
```

- Open http://localhost:8787 in your browser and create a room.
- To play as other people on the same computer, open more **private / incognito windows** and join with the room code. (Normal tabs share your seat, so they'd all be you.)
- Or, in a second Terminal window (inside the badtown folder), add test bots:
  `npm run bots -- http://localhost:8787 ROOMCODE 3` (swap ROOMCODE for your room's code).
- To stop the local server, click into its Terminal window and press **Ctrl + C**.

## Step 5: Log in to Cloudflare

```sh
npx wrangler login
```

A browser window opens. Click **Allow**. Then come back to Terminal.

## Step 6: Put it online

```sh
npm run deploy
```

- The first time, Wrangler may ask you to choose a **workers.dev subdomain** (a name for your free Cloudflare web address). Pick anything, e.g. `badhouse`.
- When it finishes, it prints a web address like:
  `https://badtown.badhouse.workers.dev`
- That's the live game. Open it on your phone, create a room and send the code or link to friends.

## Updating it later

Whenever the code changes:

```sh
cd ~/Documents/badtown
git pull
npm install
npm run deploy
```

## Optional: use your own domain

1. Your domain must be managed in Cloudflare (it's listed under **Websites** in the dashboard).
2. Go to https://dash.cloudflare.com, then **Workers & Pages**, then click **badtown**.
3. Open **Settings**, then **Domains & Routes**, then **Add**, then **Custom domain**.
4. Type the address you want (e.g. `play.yourdomain.com`) and confirm. It goes live within a few minutes.

## If something goes wrong

| What you see | What to do |
|---|---|
| `command not found: npm` | Node.js isn't installed. Go back to "What you need first". |
| `npm test` fails with a syntax error about types | Your Node.js is too old. Install the latest LTS from nodejs.org. |
| `You need to register a workers.dev subdomain` | Run `npm run deploy` again and follow the prompt, or set one in the Cloudflare dashboard under Workers & Pages. |
| `Not logged in` | Run `npx wrangler login` again. |
| The game page loads but rooms won't create | Wait a minute and refresh. The very first deploy can take a moment to switch on rooms. |

Watching live logs while people play: `npx wrangler tail` (stop with Ctrl + C).
