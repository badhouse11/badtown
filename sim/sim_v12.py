"""Compare Town Meeting information modes.
ranking : everyone sees wealth order (v1.1 'Rich List')
none    : no information, nominations from table talk only (weak, noisy read of behaviour)
gossip  : each resident privately hears ONE true rumour: how many times one random other
          resident backed HARM in rounds 1-4. Unverifiable; they can share or lie about it.
"""
import random
from collections import defaultdict
from gn_sim import T
from sim_v11 import vote

SKIM, CONF, WRONG = 3, 3, 2

def play(seats, mode):
    n = len(seats); w = [12.0]*n; pros = 4; hist = [[] for _ in range(n)]; jailed = set()
    meeting = {}
    for r in range(8):
        card = random.choice(T); prim, sec = random.sample(range(n), 2)
        g = dict(pros=pros, card=card, prim=prim, sec=sec)
        votes = [None if (i in jailed or w[i] < 2) else vote(s, i, g) for i, s in enumerate(seats)]
        h = votes.count("H"); x = votes.count("X")
        if h + x:
            win = "H" if (h > x or (h == x and pros >= 4)) else "X"
            L = x if win == "H" else h; W = h if win == "H" else x
            for i, v in enumerate(votes):
                if v is None: continue
                hist[i].append(v)
                if v == "X": w[i] += SKIM
                w[i] += 2*L/W if v == win else -2
            if win == "H":
                pros = min(8, pros+1)
                for i in range(n):
                    if i not in jailed: w[i] += 1
                w[prim] += card[0]; w[sec] += card[1]
            else:
                pros -= 1; w[prim] += card[2]; w[sec] += card[3]
            w = [max(0, c) for c in w]
        jailed = set()
        if pros <= 0: return None, meeting
        if r == 3:
            order = sorted(range(n), key=lambda i: -w[i]); leader = order[0]
            harm4 = [hist[i].count("X") for i in range(n)]
            noms = defaultdict(int)
            for voter in range(n):
                cands = [i for i in range(n) if i != voter]
                wts = {i: 0.6 + 0.25*harm4[i] for i in cands}        # vague table read
                if mode == "ranking":
                    for rank, i in enumerate(order):
                        if i != voter: wts[i] += 0.5*(n-1-rank)       # top of the list draws fire
                if mode == "gossip":
                    heard = random.choice(cands)
                    if harm4[heard] >= 2: wts[heard] += 3.0
                    elif harm4[heard] == 0: wts[heard] *= 0.3
                    # rumours spread at the table: harm-heavy players get mentioned
                    for i in cands: wts[i] += 0.35*harm4[i]
                noms[random.choices(cands, [wts[i] for i in cands])[0]] += 1
            top = max(noms.values()); acc = random.choice([i for i in noms if noms[i] == top])
            jailed = {acc}
            recent = hist[acc][-3:].count("X")
            guilty = recent >= 2
            if guilty: w[acc] = max(0, w[acc] - CONF*recent)
            else: w[acc] += WRONG
            meeting = dict(leader_hit=(acc == leader), guilty=guilty)
    top = max(w)
    return [i for i, c in enumerate(w) if c == top], meeting

def table(seats, mode, N=15000):
    wins = defaultdict(float); app = defaultdict(int); col = 0; lead = 0; gl = 0; m = 0
    for _ in range(N):
        s = seats[:]; random.shuffle(s)
        win, mt = play(s, mode)
        for x in s: app[x] += 1
        if mt: m += 1; lead += mt["leader_hit"]; gl += mt["guilty"]
        if win is None: col += 1; continue
        for i in win: wins[s[i]] += 1/len(win)
    return {x: wins[x]/app[x] for x in app}, col/N, lead/max(m,1), gl/max(m,1)

TESTS = {
  "greedy skimmer + 4 saints": ["skim50","saint","saint","saint","saint"],
  "realistic 5p":              ["skim25","skim50","selfish","selfish","saint"],
  "1 rogue + careful":         ["rogue","skim50","skim75","selfish","saint"],
  "6p mix":                    ["skim25","skim50","selfish","selfish","saint","saint"],
  "8p mix":                    ["skim25","skim25","skim50","selfish","selfish","saint","saint","rogue"],
}
if __name__ == "__main__":
    random.seed(21)
    for mode in ("ranking", "none", "gossip"):
        print(f"===== Town Meeting info: {mode.upper()} =====")
        for t, seats in TESTS.items():
            res, col, lead, gl = table(seats, mode)
            parts = ", ".join(f"{s} {r:.0%}" for s, r in sorted(res.items(), key=lambda kv: -kv[1]))
            print(f"  {t:26s} leader locked up {lead:4.0%} | skimmer caught {gl:4.0%} | {parts} (fair {1/len(seats):.0%})")
