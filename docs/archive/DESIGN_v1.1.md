# GOOD NEIGHBOURS: Game Design v1.1

**Status:** source of truth for the prototype build. Replaces Build Brief v1.0 (24 October 2026).
**Owners:** Tim Hyland and Claude (co-owners; Claude is the implementing builder).
**Scope:** functional gameplay, rooms, networking and flows only. No visual identity, palette, fonts, art, sound or animation until the gameplay is proven and a separate creative-direction brief is agreed.

This is a brand-new standalone project. It shares no code, assets, repos or hosting with EXILE, GREENLIT or any earlier game.

---

## 1. Premise

4 to 8 real people run a small fictional town. Each round, every resident secretly backs one side of a local crisis: help the town, or harm it. Backing a side costs a stake. The winning side takes the losing side's stakes, and anyone who backs harm quietly skims a cut for themselves.

Everyone wants to be the richest resident. But if greed sinks the town, **nobody wins**.

Nothing about who did what is revealed until the end, when the full financial and moral reckoning lands.

## 2. Design pillars

1. **One verb:** back a side (HELP / HARM). The vote is the wager. There is no separate prediction bet.
2. **Betrayal is always tempting.** Backing HARM pays you personally, whatever happens.
3. **Greed is collectively fatal.** If prosperity hits 0, everybody loses.
4. **Good and bad are behaviours, not teams.** No hidden roles, no harm card, no assigned alignments.
5. **Secrecy until the end.** Mid-game, players see only aggregate counts, results and one carefully limited Town Meeting. The game never publicly brands anyone guilty or innocent.
6. **Humans only.** No AI players, no NPC voters, no fillers.
7. **Fast and replayable.** 4 to 8 players, 8 rounds, roughly 15 to 25 minutes, phones or browser windows.
8. **Writing tone:** dry, mischievous community satire. No aesthetic treatment yet.

## 3. What changed from v1.0, and why

Every change below came out of a playtest-style review and 20,000-game simulations of the economy.

| # | v1.0 | v1.1 | Why |
|---|---|---|---|
| 1 | HARM had no personal reward | **Skim:** every HARM voter gets +3 coins, win or lose | In v1.0 a lone betrayer always lost 2 coins, so honesty was simply optimal. 3 is the lowest value where betrayal pays. |
| 2 | Collapse still crowned the richest | **Collapse: everyone loses** | Prosperity didn't affect winning, so nobody had a reason to protect the town. |
| 3 | Two public trials (after rounds 3 and 6) with GUILTY / NOT GUILTY verdicts | **One Town Meeting after round 4.** The most-nominated resident is locked up for a round. The audit stays private. | Public verdicts branded players for good and froze them out. Two trials felt procedural and players rarely bothered. One guaranteed, punchy moment gets used. |
| 4 | Prison was a free round off | Lock-up costs a round's vote, skim and dividend, plus a private fine if they were skimming | Prison was previously a reward. |
| 5 | A timeout auto-voted HARM | **A timeout abstains** (no stake, no vote) | Auto-HARM was grief-able and punished disconnections. |
| 6 | Fractional coins (cents) | **Whole coins only.** Leftover coins roll into the next round's pot. | Fractions are fiddly on screen. |
| 7 | Professions secretly assigned, then revealed | Assigned and revealed at game start | The secret step did nothing. |
| 8 | No dev testing tools | **Dev-only test bots** for local testing | Testing 8-player games needs 8 devices otherwise. Bots never exist in real matches. |
| 9 | (v1.1 draft) a public wealth ranking at the Town Meeting | **The Grapevine:** private, unprovable rumours about voting behaviour | A ranking made the richest player the automatic target. See section 5. |
| 10 | Rumours always true | **Planted rumours** (1 coin, HARM-backers only) | Lets skimmers deflect, so no rumour can be fully trusted. Simulated: 1 coin keeps every strategy within a few points of fair; 2+ coins makes planting a losing move. |

**Naming rule:** no names, terms or mechanics branding borrowed from existing TV formats, games or publications (e.g. no "traitors", "faithfuls", "rich list", "banished", "round table"). All game language is our own.

**Considered and rejected:** a "civic pension" (bonus coins per HELP vote if the town thrives). In simulation it overcorrected badly: saints dominated and skimmers dropped to 3 to 5% win rates. The ambiguity is the game, so it's out.

## 4. Core rules

### 4.1 Setup
- 4 to 8 players in a room. The host also plays.
- Each player is randomly assigned a unique profession at game start, shown publicly: FARMER, DOCTOR, BUILDER, BANKER, TEACHER, MAYOR, GROCER, MECHANIC. Unoccupied professions don't exist in that match.
- Professions have no powers, alignments or income differences. They only decide which event cards target whom.
- Everyone starts with **12 coins**. Town prosperity starts at **4** on a 0 to 8 meter.

### 4.2 Each round
1. **Event card** drawn: a crisis or opportunity with two labelled choices (e.g. FUND THE REPAIR / LET IT BURN). One is pro-town (HELP), one anti-town (HARM). The card shows its personal consequences before anyone votes: who it targets, and what each outcome does to them.
2. **Negotiation** (45 seconds): talk, lie, bribe, lend.
3. **Secret vote** (30 seconds): every active resident stakes **2 coins** on one side.
4. **Resolution:**
   - The side with **more backers** wins (count of people, not coins).
   - **Tie:** pro-town wins if prosperity is 4 or higher; anti-town wins if 3 or lower. Players are told this in advance.
   - **Winners** get their 2 back plus an equal whole-coin share of the losers' stakes. Any leftover coins roll into the next round's pot.
   - **Skim:** every HARM voter gets **+3 coins**, whether HARM won or lost.
   - **HELP wins:** prosperity +1 (max 8), and every resident not locked up gets a **+1 dividend**.
   - **HARM wins:** prosperity −1. No dividend.
   - The card's personal effects are applied to its targets (−2 to +2 coins each).
5. **Recap:** public result and aggregate count only (e.g. HELP 3 / HARM 2). Each player privately sees their own settlement.

**Unanimous rounds:** stakes are returned and there are no pot winnings. Skims and dividends still apply. (A unanimous HARM round pays everyone +3 and costs the town 1 prosperity. That's the tragedy in miniature.)

### 4.3 Winning
- After round 8, the **richest resident wins**. Joint richest is a shared win.
- **Collapse:** if prosperity reaches 0 at any point, the game ends immediately and **everybody loses**. The reveal still runs and shows who was "richest in the ruins", for shame purposes only.

### 4.4 Bribes
- During negotiation, a player can privately offer another player 1 to 3 coins to back a named side.
- If accepted, the coins transfer immediately and the recipient's vote is **locked** to that side. The recipient still stakes their own 2 coins, and still gets the skim if the locked side is HARM.
- A bribe can only be accepted if the recipient can still afford their 2-coin stake afterwards.
- Limits: one outgoing offer and one accepted incoming offer per person per round. Unanswered offers expire with no transfer.
- Bribes stay secret until the end. Anyone can claim or deny anything out loud.

### 4.5 Loans
- During negotiation, a player can privately offer another player a **2- or 4-coin loan**. Coins transfer on acceptance.
- Repayment happens automatically at game end: principal plus 1 coin interest, capped at what the borrower actually has. Wallets never go negative. Multiple loans settle in the order they were made.
- One outstanding loan per lender-borrower pair. Loans don't bind votes. Loans stay secret until the end.

### 4.6 Going broke
- A resident with fewer than 2 coins at voting time sits that round out (inactive). They can still talk, take loans and receive dividends, and they rejoin as soon as they have 2 coins again.
- If every resident is inactive, the game ends early and the richest wins (unless the town has collapsed).
- Wallets can never go negative. Penalties are capped at what a player has.

## 5. The Town Meeting (once per game, after round 4)

This replaces the v1.0 trials. It's built to cause suspicion and arguments **without publicly confirming anyone's guilt**, so nobody gets frozen out for the rest of the game.

1. **The Grapevine.** Each resident privately hears **one true rumour**: exactly how many times one other resident backed HARM in rounds 1 to 4 (e.g. "The Grocer backed HARM 3 times"). The rumours are dealt so that **every resident is the subject of exactly one rumour, heard by exactly one person**. Nobody hears about themselves. No wealth information is shown at all.
   - The rumour can't be proven. Whoever heard it can share it, sit on it, twist it or invent a different one entirely.
   - This gives the table something real to argue about without the game itself pointing at anyone.
   - **Planted rumours.** Before rumours are delivered (20 seconds), any resident who has backed HARM at least once may pay **1 coin** to plant a fake rumour: they pick any other resident and a HARM count. The fake **replaces the real rumour** of one random resident (never the planter, never the subject). Everyone still holds exactly one rumour, and planted rumours look identical to true ones. One plant per resident per Meeting. Plants stay secret until the final reveal.
2. **Discussion** (45 seconds). Rumours fly.
3. **Nominations** (30 seconds). Every resident secretly nominates one other resident to be locked up. You can't nominate yourself. Not nominating is allowed.
4. **The Stocks.** The most-nominated resident is locked up. Ties are broken by server randomness, never by the host. Publicly the town only sees **who** was locked up and **how many** nominations they got. If nobody nominates anyone, nobody is locked up.
5. **Locked up for round 5:** no vote, no stake, no skim, no bribes, no dividend. They can still talk, lend and borrow, and they're never targeted by round 5's event card.
6. **The private audit.** Only the locked-up player sees the result:
   - **Caught skimming** (backed HARM in at least 2 of their last 3 votes): they hand back **3 coins per HARM vote** in those 3 rounds (6 or 9 coins).
   - **Wrongly accused:** they receive **+2 coins** compensation.
7. Nobody else is told which happened. The locked-up player can protest their innocence (true or not), and the table can never verify it until the end.

**Why it works:**
- The punishment is real but **invisible**. A skimmer loses money, and nobody can prove it.
- **Witch hunts backfire.** Locking up an innocent person pays them 2 coins. Grudges cost you.
- **It's political.** Players can use it to remove a swing voter for one round, act on a rumour, or settle a score. That's all valid play.
- **Nobody is a default target.** No ranking is shown, so being rich doesn't automatically put you in the frame.
- **Once per game** keeps it a big set-piece moment instead of a chore.

**Simulation result (15,000 games per table).** Three versions were compared: a public wealth ranking, no information, and the Grapevine.

| | Wealth ranking | No info | **Grapevine** |
|---|---|---|---|
| Wealth leader locked up (6 players) | 34% | 17% | **17%** |
| Locked-up player was actually skimming (6 players) | 24% | 33% | **46%** |
| Locked-up player was actually skimming (8 players) | 37% | 54% | **70%** |
| Heavy skimmer's win rate vs 4 saints (fair share 20%) | 35% | 36% | **30%** |

The wealth ranking turned the Meeting into "lock up whoever's top" and mostly caught honest players. The Grapevine halves leader-targeting and catches roughly twice as many real skimmers, while 6 and 8-player tables stay balanced.

## 6. Final reveal

When the game ends, everything comes out:
- A round-by-round timeline of **who backed what**, bribes (who, how much, for what), loans and repayments, skims taken, Town Meeting nominations, and the audit result.
- **RICHEST RESIDENT:** the actual winner, or "Richest in the Ruins" if the town collapsed.
- **Loyalty awards** (playful labels, not moral judgements, and they never affect the money result):
  - **Town Saint:** highest HELP rate (minimum participation applies)
  - **Chief Skimmer:** most coins skimmed
  - **Freeloader:** most dividends collected while backing HARM
  - **Bankroller:** most coins lent
  - **The Fixer:** most coins spent on bribes
  - **Mud Slinger:** planted a rumour (and who it was about)
  - **Wrongly Accused / Got Away With It:** depending on the Town Meeting outcome
- One-tap rematch with a fresh shuffle.

## 7. Event deck

- **Exactly 100 cards:** 10 per profession (80) plus 20 universal. Category totals are validated at load: **60 BAD, 25 GOOD, 15 MORAL** (counts confirmed against the seed list).
- Eligible cards each match: the professions in play plus all universal cards (60 cards at 4 players, 100 at 8). No card is drawn twice in one match.
- **Targets:** a profession card targets that profession's player as primary. Universal cards pick a random primary. The secondary is always a different, randomly chosen real player. A locked-up player is never targeted that round.
- **Effects:** each card uses one of the 20 resolution templates (T01 to T20 from v1.0). Personal effects are capped at −2 to +2 coins. All effects show on the card before voting.
- **Writing rule:** both choices must be plausible. Nobody votes against a festival, so each opportunity card needs a real reason to say no ("the festival money comes out of the school budget"). On scandal cards, the pro-town choice usually means accountability, and the accused player will lobby against it.
- All 100 seed titles and premises from v1.0 carry over unchanged. Each card is written out in full: two choice labels, two outcome texts and a template.

## 8. Settings (all configurable, nothing hard-coded)

| Setting | Default |
|---|---|
| Starting coins | 12 |
| Stake | 2 |
| Skim per HARM vote | 3 |
| HELP dividend | 1 |
| Starting prosperity | 4 (meter 0 to 8) |
| Tie threshold | pro-town wins at 4+ |
| Rounds | 8 |
| Town Meeting after round | 4 |
| Skimming fine | 3 per HARM vote in last 3 |
| Wrongful lock-up compensation | 2 |
| Bribe range | 1 to 3 |
| Loan sizes / interest | 2 or 4 / 1 |
| Negotiation / vote / recap timers | 45s / 30s / 20s |
| Town Meeting plant / discussion / nomination timers | 20s / 45s / 30s |
| Plant a rumour cost | 1 (requires at least one HARM vote) |

## 9. Round flow (server-enforced state machine)

```
LOBBY → DEAL → [ROUND_INTRO → NEGOTIATION → VOTE → RESOLVE → RECAP] × 8
                 after round 4: TOWN_MEETING (PLANT → GRAPEVINE → DISCUSS → NOMINATE → LOCK_UP)
→ REVEAL → back to LOBBY (rematch)
Prosperity 0 at any point → REVEAL (collapse)
```

Transitions only ever move forwards. Deadlines are stored on the server and enforced even if every player disconnects.

## 10. Technical plan (Cloudflare)

- **Hosting:** Cloudflare Workers, which serve both the web app and the game server. Free tier, no paid services, no AI APIs.
- **One Durable Object per room**, named by its 6-character room code. A Durable Object is a small server process that owns one room's entire state, so it's the single referee for every vote, transfer and timer. Collision checks are trivial because each code maps to exactly one object.
- **Storage:** the Durable Object's built-in SQLite database. It holds players, reconnect tokens, the shuffled deck, the coin ledger, every round's log and all timers, so a room survives restarts.
- **Real-time:** WebSockets with hibernation (rooms sleep when idle and cost nothing).
- **Timers:** Durable Object alarms, so phases end on time even if everyone's offline.
- **Security:**
  - Phones only send intentions ("I vote HELP"). The server decides everything.
  - Each player only ever receives their own private data. The host gets no special view of secrets.
  - Reconnect tokens are unguessable and stored on the device.
  - Every money action has an idempotency key, so a double-tap can never pay twice.
- **Money integrity:** every coin movement is a ledger entry. Automated tests check that coins are never created or destroyed except by the defined rules (skim, dividend, card effects, fines, compensation).
- **Dev test bots:** a local-only harness that fills seats with scripted players for testing. Switched off in production builds.
- **Chat:** optional lightweight in-room text chat. Most groups will talk in person or on a call.

## 11. Build phases

1. Architecture, schemas and settings file (this doc is the input).
2. Cloudflare project: rooms, join codes, reconnects, live sync.
3. Core loop: secret votes, skim, pot, dividend, prosperity, collapse.
4. Bribes, loans, the Town Meeting, private and public state separation.
5. The full 100-card deck with written choices and effects.
6. Final reveal, awards, rematch, automated tests, deploy guide.
7. Working demo with test checklist. **Then pause** for the creative-direction brief.

## 12. Acceptance tests

1. Full 4-player game on four devices: 8 rounds, eligible cards only, no bots.
2. 8-player game: unique professions, timeouts abstain, no duplicate votes.
3. Deck: exactly 100 cards, 10 per profession plus 20 universal, 60/25/15 categories, no repeats in a match.
4. Privacy: no player or host can see another player's vote, wallet, bribes or loans before the reveal.
5. Majority by headcount; tie rule tested at the 4/3 boundary.
6. Pot maths in whole coins; leftovers roll over; ledger always balances.
7. Skim pays +3 per HARM vote win or lose; HELP wins pay the dividend; prosperity 0 ends the game with no winner.
8. Bribes transfer once, lock the vote and stay secret; declined or unaffordable bribes move nothing.
9. Town Meeting: every resident privately receives exactly one accurate rumour, every resident is the subject of exactly one, nobody hears about themselves, and no rumour is broadcast; plants cost 1 coin, require a prior HARM vote, replace one random non-planter non-subject recipient's rumour and are indistinguishable; most-nominated is locked up for round 5; the audit result is visible only to them; fines and compensation are correct.
10. Loans repay at the end without negative wallets or double payments.
11. Disconnects can't stall the game; rooms survive restarts; reconnect works on mobile.
12. Reveal is accurate, awards are correct, rematch reshuffles.
13. Automated tests for card effects, money conservation, idempotency, simultaneous actions, ties and data privacy.
14. Fresh checkout runs locally and deploys to Cloudflare from written instructions.

## 13. Open questions for playtesting

- **Saints vs rogues.** A purely honest player almost never wins when someone skims relentlessly. Thematically right, but if it feels joyless, revisit.
- **Bribes and loans weren't simulated.** Real negotiation will move all the numbers.
- **Skim of 3** is the floor where betrayal pays. Try 4 if the table plays too safe.
- **Starting prosperity of 4** rarely collapses with careful players. Try 3 if the town never feels in danger.
- **Rumour strength.** Exact HARM counts may be too sharp at 4 players (fewer suspects). If so, soften to "backed HARM at least once / never".
- **No wealth info at all.** Players never see standings mid-game. If the endgame feels blind, consider a vague private hint (e.g. "you're in the top half").
