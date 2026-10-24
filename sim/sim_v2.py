"""GOOD NEIGHBOURS v2 economy + agenda balance sim.

Round: everyone secretly votes HELP or HARM.
  HARM: you pocket SKIM coins, always.
  More HELP: town +1 and everyone (not sitting out) gets DIV coins.
  More HARM: town -DROP. Tie: no change.
  Town hits 0: everyone loses.
After round ACC_AFTER: rumours, then the accusation. Most-pointed: agenda revealed, sits out next round.
End: score = coins + agenda bonus. Highest score wins.
"""
import random
from collections import defaultdict

ROUNDS, START, MAXT, SKIM, DIV, UP, DROP, ACC_AFTER = 6, 5, 10, 2, 1, 1, 2, 3

AGENDAS = ["pillar", "developer", "gossip", "chameleon", "martyr", "fixer", "snake", "neighbour"]
B = dict(pillar=6, pillar_at=8, developer=2, gossip=5, fence=1, martyr=6, fixer=3, snake=2, neighbour=4)

def harm_prob(ag, town, last):
    if town <= 2 and ag != "developer": return 0.0
    return dict(pillar=0.05, developer=0.55 if town > 2 else 0.0, gossip=0.3, fence=0.3 if last == "X" else 0.15, chameleon=0.42,
                martyr=0.0, fixer=0.35, snake=0.55 if town >= 5 else 0.15, neighbour=0.15)[ag]

def play(agendas, B):
    n = len(agendas); coins = [0]*n; town = START; hist = [[] for _ in range(n)]
    bonus = [0]*n; sit = None; last = None; pointed = [0]*n; gossip_hit = [False]*n
    majority_count = [0]*n; snake_hits = [0]*n; dev_rounds = 0; fixer_deals = [0]*n
    for r in range(1, ROUNDS+1):
        votes = []
        for i, ag in enumerate(agendas):
            if i == sit: votes.append(None); continue
            votes.append("X" if random.random() < harm_prob(ag, town, last) else "H")
        # Fixer: tries one bribe a round (costs 2, lands 50%), pushes a target to HARM/HELP at will.
        for i, ag in enumerate(agendas):
            if ag == "fixer" and coins[i] >= 2 and random.random() < 0.5:
                t = random.choice([j for j in range(n) if j != i and votes[j] is not None])
                coins[i] -= 2; coins[t] += 2; fixer_deals[i] += 1
        h = votes.count("H"); x = votes.count("X")
        for i, v in enumerate(votes):
            if v is None: continue
            hist[i].append(v)
            if v == "X": coins[i] += SKIM
        if h > x:
            town = min(MAXT, town+UP)
            for i in range(n):
                if i != sit: coins[i] += DIV
            win = "H"
        elif x > h:
            town -= DROP; dev_rounds += 1; win = "X"
        else:
            win = None
        for i, v in enumerate(votes):
            if v and win and v == win: majority_count[i] += 1
            if v == "X" and win == "H": snake_hits[i] += 1
        last = win; sit = None
        if town <= 0: return None, True
        if r == ACC_AFTER:
            harms = [hh.count("X") for hh in hist]
            worst = max(harms)
            rumour = {}
            order = list(range(n)); random.shuffle(order)
            for k, i in enumerate(order): rumour[i] = order[(k+1) % n]
            noms = [0]*n
            for i in range(n):
                cands = [j for j in range(n) if j != i]
                w = [0.5 + 0.4*harms[j] + (3 if (rumour[i] == j and harms[j] >= 2) else 0) for j in cands]
                if agendas[i] == "gossip": w = [ww + (4 if harms[j] == worst and worst > 0 else 0) for ww, j in zip(w, cands)]
                t = random.choices(cands, w)[0]; noms[t] += 1
                if harms[t] == worst and worst > 0: gossip_hit[i] = True
            pointed = noms
            top = max(noms); acc = random.choice([j for j in range(n) if noms[j] == top])
            sit = acc
    for i, ag in enumerate(agendas):
        if ag == "pillar" and town >= B["pillar_at"]: bonus[i] = B["pillar"]
        if ag == "developer": bonus[i] = B["developer"]*dev_rounds
        if ag == "gossip" and gossip_hit[i]: bonus[i] = B["gossip"]
        if ag == "fence": bonus[i] = B["fence"]*majority_count[i]
        if ag == "chameleon" and hist[i].count("X") in (2, 3): bonus[i] = B["chameleon"]
        if ag == "martyr" and "X" not in hist[i]: bonus[i] = B["martyr"]
        if ag == "fixer": bonus[i] = B["fixer"]*fixer_deals[i]
        if ag == "snake": bonus[i] = min(B.get("snake_cap", 99), B["snake"]*snake_hits[i])
        if ag == "neighbour" and pointed[i] == 0: bonus[i] = B["neighbour"]
    score = [coins[i]+bonus[i] for i in range(n)]
    top = max(score)
    return [i for i in range(n) if score[i] == top], False

def run(n, B, N=20000):
    wins = defaultdict(float); app = defaultdict(int); col = 0
    for _ in range(N):
        ags = random.sample(AGENDAS, n)
        w, c = play(ags, B); col += c
        for a in ags: app[a] += 1
        if w:
            for i in w: wins[ags[i]] += 1/len(w)
    return {a: wins[a]/app[a] for a in app}, col/N

if __name__ == "__main__":
    import sys
    random.seed(4)
    for n in (3, 4, 5, 6, 8):
        res, col = run(n, B)
        spread = ", ".join(f"{a} {r:.0%}" for a, r in sorted(res.items(), key=lambda kv: -kv[1]))
        print(f"{n} players | collapse {col:4.0%} | fair {1/n:.0%} | {spread}")
