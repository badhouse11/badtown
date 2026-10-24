# Good Neighbours: Design v2

**Owners:** Tim Hyland and Claude. Claude builds.
**Replaces:** v1.1 (archived in `docs/archive/`). v1.1 worked mechanically but was too complicated, had no identity and no dramatic moment.

## The pitch

Help your town, or help yourself. Everyone has a secret. If the town falls, everyone loses.

3 to 8 players, one phone each, about 15 minutes.

## Principles

1. **One choice per round.** HELP or HARM. That's it.
2. **Everyone is someone.** A secret agenda from the first second.
3. **One moment per round.** The votes flip over one at a time.
4. **Nobody is the villain.** Every agenda is a motive, not a team.
5. **Greed is collectively fatal.** The town hitting zero means everyone loses.

## Setup

- Everyone starts with **3 coins**. The town starts at **5** on a scale of 0 to 10.
- Each player is dealt one **secret agenda**, shown only to them.

## A round (6 rounds per game)

1. **Crisis.** A card describes the problem in one line, with two choices.
2. **Talk** (60 seconds). Argue, promise, lie. You can secretly **bribe** one person per round (2 coins) to vote a side. If they accept, their vote is locked.
3. **Vote** (30 seconds). Secretly back HELP or HARM.
4. **Reveal.** The votes flip over one at a time, anonymously.
   - **Backing HARM:** you pocket **2 coins**, win or lose.
   - **More HELP:** town +1, and everyone gets **1 coin**.
   - **More HARM:** town **−2**.
   - **Tie:** nothing changes.
   - **Town hits 0:** the game ends and **everyone loses**.

## The accusation (once, after round 3)

1. **The grapevine.** Everyone privately hears one **true** rumour: how many times one other player has backed HARM. Everyone is the subject of exactly one rumour.
2. **Point.** Everyone points at one person (or nobody).
3. **The stocks.** The most-pointed person (ties broken at random) has their **secret agenda revealed** to the whole table and sits out round 4: no vote, no bribes, no dividend.

## Secret agendas

| Agenda | Bonus at the end |
|---|---|
| The Pillar | +8 if the town ends at 8 or higher |
| The Developer | +2 for every round HARM wins (but collapse still means you lose) |
| The Gossip | +5 if you point at whoever has harmed most so far |
| The Chameleon | +3 if you back HARM exactly 2 or 3 times |
| The Martyr | +8 if you never back HARM |
| The Fixer | +4 for every bribe of yours that's accepted |
| The Snake | +1 each time you back HARM and HELP still wins (max +3) |
| The Good Neighbour | +8 if nobody points at you |

All eight are shown to everyone, so you know the possible motives but not who has which.

**Balance** (`sim/sim_v2.py`): every agenda wins within about 1.7× of a fair share at 4 to 6 players, and 3 and 8 players stay playable. Bots play cautiously, so real tables will see more collapses.

## Winning

Coins plus agenda bonus. Highest total wins; ties share the win. The end screen reveals everything: every vote, every bribe, every agenda, and who pointed at whom.

## Cut from v1.1

Stakes and pots, tie-break rules, loans, professions, planted rumours, audits and fines.

## Look

- **Palette:** warm paper and pure black, with bold colour discs: cobalt for HELP, persimmon for HARM, sun yellow for the town.
- **Type:** one typeface (Archivo), condensed and heavy for headlines and numbers, normal width for reading.
- **Icons:** an original solid geometric set (`public/icons.js`).
- **Shapes:** everything is a circle, a pill or plain text.
- **Motion:** the only animation is the vote flip.

## Settings

All numbers live in `src/engine/settings.ts`.

## Open questions for playtesting

- Is 2 coins of skim tempting enough, or should it be 3?
- Does −2 on a harm round make collapse feel real enough?
- Is the accusation after round 3 the right moment?
- Do players want a second accusation?
