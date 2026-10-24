# Putting Good Neighbours online (Cloudflare)

Everything here runs on Cloudflare's **free plan**. Use option A: it needs no Terminal, and every change pushed to GitHub goes live by itself.

## Option A: connect GitHub to Cloudflare (recommended)

1. Go to https://dash.cloudflare.com and log in.
2. In the left menu, click **Compute (Workers)**. On some accounts it's called **Workers & Pages**.
3. Click **Create**, then **Import a repository**.
4. If asked, click **Connect GitHub** and allow access to the **badhouse11** account. Either all repositories or just **badtown** is fine.
5. Pick **badtown** from the list.
6. On the settings screen:
   - **Project name:** `badtown`
   - **Build command:** leave blank
   - **Deploy command:** `npx wrangler deploy` (usually pre-filled)
   - Leave everything else as it is.
7. Click **Deploy** and wait a minute or two.
8. When it finishes, it shows your address, like `https://badtown.yourname.workers.dev`. That's the game.

If it asks you to pick a **workers.dev subdomain**, choose any name (e.g. `badhouse`). It becomes part of the address.

**From now on:** every time new code is pushed to the `main` branch on GitHub, Cloudflare rebuilds and updates the site automatically. You don't need to do anything.

**If the build fails:** copy the red error lines from the build log and send them to Claude.

## Option B: deploy from your computer (Terminal)

Only if you'd rather not connect GitHub.

1. Install **Node.js** (the LTS version) from https://nodejs.org. Check it worked: open Terminal, type `node --version` and press Enter. You want 22.18 or higher.
2. Download the code:
   ```sh
   cd ~/Documents
   git clone https://github.com/badhouse11/badtown.git
   cd badtown
   npm install
   ```
3. Log in to Cloudflare. A browser window opens; click **Allow**:
   ```sh
   npx wrangler login
   ```
4. Deploy. It prints your web address at the end:
   ```sh
   npm run deploy
   ```

To update later: `cd ~/Documents/badtown`, then `git pull`, then `npm run deploy`.

## Optional: your own domain

1. The domain must be on Cloudflare (listed under **Websites** in the dashboard).
2. Go to **Workers & Pages**, then **badtown**, then **Settings**, then **Domains & Routes**, then **Add**, then **Custom domain**.
3. Type the address you want (e.g. `play.yourdomain.com`) and confirm. It goes live within a few minutes.

## Playing

- **On a phone:** open the address and tap **Start a town**. Share the 6-letter code or the invite link.
- **Testing alone on a laptop:** use one **private or incognito window** per player. Normal tabs share your seat.
