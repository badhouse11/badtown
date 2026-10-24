"""GOOD NEIGHBOURS v1.1 economy sim.
Rules: stake 2, skim +SKIM per HARM vote, +1 dividend on HELP win, collapse = all lose,
one Town Meeting after round 4: Rich List order revealed, everyone nominates, most-nominated
is locked up for round 5 (no vote, no skim, no dividend). Private audit: if they backed HARM in
>=2 of their last 3 votes they hand back CONFISCATE per HARM vote; otherwise +WRONGFUL comp.
Nobody else learns the audit result. Optional civic pension: town ends >= PENSION_AT prosperity
-> +1 per HELP vote cast."""
import random, statistics
from collections import defaultdict
from gn_sim import T

def vote(s, i, g):
    pros, card, prim, sec = g["pros"], g["card"], g["prim"], g["sec"]
    if s == "saint": return "H"
    if s == "rogue": return "X"
    if s.startswith("skim"):
        rate = int(s[4:]) / 100
        return "H" if pros <= 2 else ("X" if random.random() < rate else "H")
    if s == "selfish":
        if i == prim: return "H" if card[0] >= card[2] else "X"
        if i == sec: return "H" if card[1] >= card[3] else "X"
        return "H" if pros <= 2 else ("X" if random.random() < 0.35 else "H")

def play(seats, P):
    n = len(seats); w = [12.0]*n; pros = P["start_pros"]; hist = [[] for _ in range(n)]
    jailed = set(); helps = [0]*n; audit = None
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
                if v == "X": w[i] += P["skim"]
                else: helps[i] += 1
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
        if pros <= 0: return None, True, audit
        if r == 3 and P["meeting"]:
            # Rich List shown: bots weigh suspicion (recent harm, noisy) and wealth rank
            order = sorted(range(n), key=lambda i: -w[i])
            rank_bonus = {i: (n - order.index(i)) * P["rich_weight"] for i in range(n)}
            noms = defaultdict(int)
            for voter in range(n):
                cands = [i for i in range(n) if i != voter]
                wts = [hist[i][-3:].count("X")*1.0 + 0.4 + rank_bonus[i] for i in cands]
                noms[random.choices(cands, wts)[0]] += 1
            top = max(noms.values()); acc = random.choice([i for i in noms if noms[i] == top])
            jailed = {acc}
            harms = hist[acc][-3:].count("X")
            if harms >= 2:
                w[acc] = max(0, w[acc] - P["confiscate"]*harms); audit = "guilty"
            else:
                w[acc] += P["wrongful"]; audit = "innocent"
    if P["pension_at"] and pros >= P["pension_at"]:
        w = [w[i] + helps[i] for i in range(n)]
    top = max(w)
    return [i for i, c in enumerate(w) if c == top], False, audit

def table(seats, P, N=20000):
    wins = defaultdict(float); app = defaultdict(int); col = 0; aud = defaultdict(int)
    for _ in range(N):
        s = seats[:]; random.shuffle(s)
        win, c, a = play(s, P); col += c; aud[a] += 1
        for x in s: app[x] += 1
        if win:
            for i in win: wins[s[i]] += 1/len(win)
    return {x: wins[x]/app[x] for x in app}, col/N, aud

BASE = dict(skim=3, start_pros=4, meeting=True, rich_weight=0.3, confiscate=3, wrongful=2, pension_at=0)
CONFIGS = {
  "v1.1 no meeting":            dict(BASE, meeting=False),
  "v1.1 meeting":               dict(BASE),
  "v1.1 meeting + pension@6":   dict(BASE, pension_at=6),
  "v1.1 meeting + pension@5":   dict(BASE, pension_at=5),
}
TESTS = {
  "sly skimmer + 4 saints":   ["skim25","saint","saint","saint","saint"],
  "greedy skimmer + 4 saints":["skim50","saint","saint","saint","saint"],
  "realistic 5p":             ["skim25","skim50","selfish","selfish","saint"],
  "1 rogue + careful":        ["rogue","skim50","skim75","selfish","saint"],
  "6p mix":                   ["skim25","skim50","selfish","selfish","saint","saint"],
  "8p mix":                   ["skim25","skim25","skim50","selfish","selfish","saint","saint","rogue"],
  "all rogues":               ["rogue"]*5,
}
if __name__ == "__main__":
    random.seed(11)
    for cname, P in CONFIGS.items():
        print(f"===== {cname} =====")
        for tname, seats in TESTS.items():
            res, col, aud = table(seats, P, N=12000)
            parts = ", ".join(f"{s} {r:.0%}" for s, r in sorted(res.items(), key=lambda kv: -kv[1]))
            extra = ""
            if P["meeting"]:
                tot = aud["guilty"] + aud["innocent"]
                if tot: extra = f" | locked-up player was skimming {aud['guilty']/tot:.0%}"
            print(f"  {tname:26s} collapse {col:4.0%} | {parts} (fair {1/len(seats):.0%}){extra}")
