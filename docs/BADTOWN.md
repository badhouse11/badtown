# BADTOWN: pitch and design (draft 1)

**Owners:** Tim Hyland and Claude. Claude builds.
**Status:** engine, bots and a solo practice mode built (`src/badtown/`, `practice/`). Multiplayer next.

## The pitch

> There's a tunnel under Badtown. There's a Rat in the cells. And by night four, there's a Mole in the uniform.

A 15-minute social deduction game for 4 to 8 phones.

- The **Inmates** dig at night to reach the wall before dawn on day six.
- The **Guards** search cells and sweep the yard with a spotlight.
- Everyone knows who wears which uniform. Nobody knows who's lying.

## Why people will want to play again

1. **A traitor on each side.** One inmate is secretly the Rat, working for the Guards. After night 3, the Guards must promote an inmate to Trusty, who secretly chooses: stay loyal, or become the Mole. Both sides end up paranoid.
2. **The promotion inversion.** If the Guards promote the Rat, they gain a loyal officer. So the Guards want to promote whoever they think the Rat is, and the honest Inmates want to *look* like the Rat to get the badge. Nobody has played that bluff before.
3. **Maths you can argue about.** Every morning the whole town sees "the tunnel grew 3 metres". If three inmates were free to dig and it grew four, someone in uniform is digging too.
4. **It goes down to the wire.** In simulation, most escapes happen on the last two nights, and most lockdowns end within 2 metres of the wall.
5. **Short and replayable.** About 15 minutes, roles reshuffle every game, and the end reveal ("The Rat was… The Mole was…") is built to be talked about.

## Rules

### Setup

| Players | Guards | Inmates | Rats (secret, inmates) | Wall distance |
|---|---|---|---|---|
| 4 | 1 | 3 | 1 | 3 m |
| 5 | 1 | 4 | 1 | 7 m |
| 6 | 2 | 4 | 1 | 3 m |
| 7 | 2 | 5 | 1 | 6 m |
| 8 | 2 | 6 | 2 | 7 m |

Wall distances were rebalanced on the real engine (`scripts/calibrate.ts`) with both sides playing their best strategies: 39 to 56% escapes at every table size.

Uniforms are public. Each inmate gets a cell number. Rats know they're a Rat; at 8 players the two Rats don't know each other.

### Each day (6 days)

1. **Day** (60s): talk, accuse, plan.
2. **Lights out, the cells** (20s): every Inmate secretly chooses **Dig** or **Sleep**. The Rat can also **Whisper** a cell number to the Guards (or dig to keep up appearances).
3. **Lights out, the guard room** (20s): Guards see any whisper, then each chooses **Search** a cell or **Spotlight**.
   - **Search** catches a digger: their metre doesn't count and they spend the next night in the hole.
   - **Spotlight** knocks 1 metre off tonight's digging.
   - Everyone holds their thumb on the screen for both lights-out steps, so nobody can tell who is doing what.
4. **Morning:** "The tunnel grew N metres." Anyone caught is named.

### The count (day 3)

Before lights out on day 3, the cells vote on who the Rat is. Most votes wins; a tie names nobody.
- **Right:** the Rat is exposed. No more whispers, and they can't be made Trusty.
- **Wrong:** that innocent cellmate spends the night in the hole.

In simulation the vote is balance-neutral at realistic accuracy: a sharp read adds 10 to 20 points of escape chance, a bad one costs 6 to 13.

### The Trusty (after night 3)

- The Guards **must** appoint one inmate as Trusty. If they can't agree, the warden picks at random.
- **If it's the Rat:** they simply join the Guards. The table doesn't learn that.
- **Anyone else** privately chooses **Loyal** (now wins with the Guards) or **Mole** (still wins with the Inmates).
- The Trusty acts with the Guards from then on. A Mole can secretly add a metre from the inside instead of searching.

### Winning

- **Escape:** the tunnel reaches the wall by dawn of day six. Inmates and the Mole win.
- **Lockdown:** otherwise. Guards, the Rat(s) and a Loyal Trusty win.

## Simulation results (`sim/badtown_sim3.py`)

Each table size was simulated with best-response play: inmates choose how often to dig, guards choose how often to search versus spotlight, and each side optimises against the other.

| Table | Escape rate | Escapes on the last 2 nights | Lockdowns within 2 m of the wall | Games with a Mole |
|---|---|---|---|---|
| 4p | 40% | 38% | 83% | 31% |
| 5p | 45% | 87% | 59% | 45% |
| 6p | 43% | 45% | 79% | 40% |
| 7p | 42% | 87% | 51% | 51% |
| 8p | 46% | 89% | 45% | 56% |

**Sensitivity:** the promotion is the pivot. If the Guards spot the Rat for promotion, escapes drop by around 10 to 15 points. If they miss, escapes rise by about the same. A Mole game ends in escape 73 to 91% of the time. That makes the promotion the most important decision in the game, which is exactly where the drama should sit.

**Settings are deliberately slightly Guard-favoured.** Bots don't bluff, and real Inmates will use tactical sleeps and the "look like the Rat" play.

## What we learned on the way (and threw out)

- **Brief v1 (Death Row):** Inmates could never win, because nothing they did lowered Security.
- **Parole for anyone (draft 1):** with release available to every inmate, the population collapsed to 96% rats and 0% escapes.
- **One parole place (draft 2):** still collapsed. A lone digger can't finish a tunnel, so defection always wins.
- **Fixed hidden roles plus one forced promotion (this draft):** stable, balanced and tense.

## Open questions

- Is the Mole too strong once it appears? Should it dig every other night?
- Should the Rat get a stronger tool, e.g. one guaranteed-true tip per game?
- Should there be a 3-player variant (1 Guard, 2 Inmates, no Rat)?
