import random
from collections import defaultdict
from gn_sim import T

def play(k, seats, fine, rounds=8):
    n=len(seats); w=[12.0]*n; pros=4; hist=[[] for _ in range(n)]; jail=set(); guilty_hits=defaultdict(int)
    for r in range(rounds):
        card=random.choice(T); prim,sec=random.sample(range(n),2)
        votes=[]
        for i,s in enumerate(seats):
            if i in jail or w[i]<2: votes.append(None); continue
            if s=="saint": v="H"
            elif s=="rogue": v="X"
            elif s.startswith("skim"):
                rate=int(s[4:])/100; v="H" if pros<=2 else ("X" if random.random()<rate else "H")
            elif s=="selfish":
                if i==prim: v="H" if card[0]>=card[2] else "X"
                elif i==sec: v="H" if card[1]>=card[3] else "X"
                else: v="H" if pros<=2 else ("X" if random.random()<0.35 else "H")
            votes.append(v)
        jailed_now=set(jail); jail=set()
        h=votes.count("H"); x=votes.count("X")
        if h+x:
            win="H" if (h>x or (h==x and pros>=4)) else "X"
            L=x if win=="H" else h; W=h if win=="H" else x
            for i,v in enumerate(votes):
                if v is None: continue
                hist[i].append(v)
                if v=="X": w[i]+=k
                w[i]+= 2*L/W if v==win else -2
            if win=="H":
                pros=min(8,pros+1)
                for i in range(n):
                    if i not in jailed_now: w[i]+=1
                w[prim]+=card[0]; w[sec]+=card[1]
            else:
                pros-=1; w[prim]+=card[2]; w[sec]+=card[3]
            w=[max(0,c) for c in w]
        if pros<=0: return None, True, guilty_hits
        if r in (2,5):   # trial after rounds 3 and 6
            weights=[(hist[i][-3:].count("X")+0.5) for i in range(n)]
            acc=random.choices(range(n),weights)[0]
            if random.random()<0.6:   # town votes to investigate
                if hist[acc][-3:].count("X")>=2:
                    w[acc]=max(0,w[acc]-fine); jail.add(acc); guilty_hits[seats[acc]]+=1
                else: pros-=1
                if pros<=0: return None, True, guilty_hits
    top=max(w); return [i for i,c in enumerate(w) if c==top], False, guilty_hits

def table(k,seats,fine,N=20000):
    wins=defaultdict(float); app=defaultdict(int); col=0
    for _ in range(N):
        s=seats[:]; random.shuffle(s); win,c,_=play(k,s,fine); col+=c
        for x in s: app[x]+=1
        if win:
            for i in win: wins[s[i]]+=1/len(win)
    return {x:wins[x]/app[x] for x in app}, col/N

random.seed(3)
tests={
 "1 skimmer, 4 saints":["skim50","saint","saint","saint","saint"],
 "1 sly skimmer, 4 saints":["skim25","saint","saint","saint","saint"],
 "realistic mix":["skim25","skim50","selfish","selfish","saint"],
 "1 rogue, others careful":["rogue","skim50","skim75","selfish","saint"],
 "6p mix":["skim25","skim50","selfish","selfish","saint","saint"],
 "all rogues (no back-off)":["rogue"]*5,
}
for k,fine in ((2,0),(3,0),(3,3),(3,4)):
    print(f"===== kickback {k}, prison fine {fine} (+ miss a round & dividend) =====")
    for name,seats in tests.items():
        res,col=table(k,seats,fine)
        parts=", ".join(f"{s} {r:.0%}" for s,r in sorted(res.items(),key=lambda kv:-kv[1]))
        print(f"  {name:26s} collapse {col:4.0%} | {parts}  (fair {1/len(seats):.0%})")
