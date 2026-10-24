import random, statistics
from collections import defaultdict
from gn_sim import T

def lone(k, n, pros=4):
    # one defector, n-1 helpers. returns (my change helping, my change defecting, my lead over a helper when defecting)
    help_all = 1.0
    # defect: help wins (n-1 vs 1)
    me = -2 + 1 + k
    other = 2/(n-1) + 1
    return help_all, me, me - other

def lone_harm_wins_majority(k, n):
    # I'm in a harm majority: e.g. n//2+1 harm vs rest help
    x = n//2 + 1; h = n - x
    me = 2*h/x + k
    helper = -2
    return me - helper

def play(k, seats, rounds=8, collapse_all_lose=True, start_pros=4):
    n = len(seats); w=[12.0]*n; pros=start_pros
    for r in range(rounds):
        card = random.choice(T); prim, sec = random.sample(range(n),2)
        votes=[]
        for i,s in enumerate(seats):
            if w[i] < 2: votes.append(None); continue
            if s=="saint": v="H"
            elif s=="rogue": v="X"
            elif s.startswith("skim"):   # skimNN = defect rate %, backs off when town fragile
                rate=int(s[4:])/100
                v = "H" if pros<=2 else ("X" if random.random()<rate else "H")
            elif s=="selfish":
                if i==prim: v="H" if card[0]>=card[2] else "X"
                elif i==sec: v="H" if card[1]>=card[3] else "X"
                else: v = "H" if pros<=2 else ("X" if random.random()<0.35 else "H")
            votes.append(v)
        h=votes.count("H"); x=votes.count("X")
        if h+x==0: continue
        win = "H" if (h>x or (h==x and pros>=4)) else "X"
        losers = x if win=="H" else h; winners = h if win=="H" else x
        for i,v in enumerate(votes):
            if v is None: continue
            if v=="X": w[i]+=k
            w[i] += 2*losers/winners if v==win else -2
        if win=="H":
            pros=min(8,pros+1); w=[c+1 for c in w]; w[prim]+=card[0]; w[sec]+=card[1]
        else:
            pros-=1; w[prim]+=card[2]; w[sec]+=card[3]
        w=[max(0,c) for c in w]
        if pros<=0: break
    if pros<=0 and collapse_all_lose: return None, True
    top=max(w); return [i for i,c in enumerate(w) if c==top], pros<=0

def table(k, seats, N=20000):
    wins=defaultdict(float); app=defaultdict(int); col=0
    for _ in range(N):
        s=seats[:]; random.shuffle(s)
        win,c=play(k,s); col+=c
        for x in s: app[x]+=1
        if win:
            for i in win: wins[s[i]]+=1/len(win)
    return {x: wins[x]/app[x] for x in app}, col/N

if __name__=="__main__":
    random.seed(1)
    print("LONE TRAITOR among honest helpers (prosperity 4)")
    print("kickback | n=4: gain vs helping / lead over a helper | n=6 | n=8")
    for k in range(0,5):
        row=[]
        for n in (4,6,8):
            h,d,lead=lone(k,n); row.append(f"{d-h:+.2f} / {lead:+.2f}")
        print(f"   {k}     | " + " | ".join(row))
    print()
    tests = {
      "1 skimmer, 4 saints":   ["skim50","saint","saint","saint","saint"],
      "1 sly skimmer, 4 saints":["skim25","saint","saint","saint","saint"],
      "realistic mix":         ["skim25","skim50","selfish","selfish","saint"],
      "everyone greedy":       ["skim50","skim50","skim75","rogue","selfish"],
      "6p mix":                ["skim25","skim50","selfish","selfish","saint","saint"],
    }
    for k in (0,1,2,3):
        print(f"===== KICKBACK {k} (collapse = everyone loses) =====")
        for name,seats in tests.items():
            res,col=table(k,seats)
            fair=1/len(seats)
            parts=", ".join(f"{s} {r:.0%}" for s,r in sorted(res.items(), key=lambda kv:-kv[1]))
            print(f"  {name:24s} collapse {col:4.0%} | win/seat: {parts}  (fair share {fair:.0%})")
