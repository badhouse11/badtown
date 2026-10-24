"""Grapevine vs Grapevine + Planted Rumours.
Plant: a resident who has backed HARM at least once may pay PLANT_COST to plant a fake rumour
('X backed HARM 3 times') about any other resident. It replaces the real rumour of one random
recipient (not the planter, not the target). All rumours look identical."""
import random
from collections import defaultdict
from gn_sim import T
from sim_v11 import vote
SKIM, CONF, WRONG = 3, 3, 2

def play(seats, plant, cost):
    n=len(seats); w=[12.0]*n; pros=4; hist=[[] for _ in range(n)]; jailed=set(); m={}
    for r in range(8):
        card=random.choice(T); prim,sec=random.sample(range(n),2)
        g=dict(pros=pros,card=card,prim=prim,sec=sec)
        votes=[None if (i in jailed or w[i]<2) else vote(s,i,g) for i,s in enumerate(seats)]
        h=votes.count("H"); x=votes.count("X")
        if h+x:
            win="H" if (h>x or (h==x and pros>=4)) else "X"
            L=x if win=="H" else h; W=h if win=="H" else x
            for i,v in enumerate(votes):
                if v is None: continue
                hist[i].append(v)
                if v=="X": w[i]+=SKIM
                w[i]+=2*L/W if v==win else -2
            if win=="H":
                pros=min(8,pros+1)
                for i in range(n):
                    if i not in jailed: w[i]+=1
                w[prim]+=card[0]; w[sec]+=card[1]
            else:
                pros-=1; w[prim]+=card[2]; w[sec]+=card[3]
            w=[max(0,c) for c in w]
        jailed=set()
        if pros<=0: return None,m
        if r==3:
            harm4=[hist[i].count("X") for i in range(n)]
            # deal true rumours as a derangement: each resident hears about exactly one other
            while True:
                perm=list(range(n)); random.shuffle(perm)
                if all(perm[i]!=i for i in range(n)): break
            rumour={i:(perm[i],harm4[perm[i]],False) for i in range(n)}
            planted=0
            if plant:
                for p in range(n):
                    if harm4[p]>=2 and w[p]>=cost:     # worried skimmers deflect
                        tgt=random.choice([i for i in range(n) if i!=p])
                        rec=random.choice([i for i in range(n) if i not in (p,tgt)])
                        rumour[rec]=(tgt,3,True); w[p]-=cost; planted+=1
            noms=defaultdict(int)
            for voter in range(n):
                cands=[i for i in range(n) if i!=voter]
                wts={i:0.6+0.25*harm4[i]+0.35*harm4[i] for i in cands}
                subj,cnt,_=rumour[voter]
                if subj in wts:
                    if cnt>=2: wts[subj]+=3.0
                    elif cnt==0: wts[subj]*=0.3
                noms[random.choices(cands,[wts[i] for i in cands])[0]]+=1
            top=max(noms.values()); acc=random.choice([i for i in noms if noms[i]==top])
            jailed={acc}; recent=hist[acc][-3:].count("X"); guilty=recent>=2
            if guilty: w[acc]=max(0,w[acc]-CONF*recent)
            else: w[acc]+=WRONG
            m=dict(guilty=guilty,planted=planted)
    top=max(w); return [i for i,c in enumerate(w) if c==top],m

def table(seats,plant,cost,N=15000):
    wins=defaultdict(float); app=defaultdict(int); gl=0; mm=0; pl=0
    for _ in range(N):
        s=seats[:]; random.shuffle(s); win,mt=play(s,plant,cost)
        for x in s: app[x]+=1
        if mt: mm+=1; gl+=mt["guilty"]; pl+=mt["planted"]>0
        if win:
            for i in win: wins[s[i]]+=1/len(win)
    return {x:wins[x]/app[x] for x in app}, gl/max(mm,1), pl/max(mm,1)

TESTS={
 "greedy skimmer + 4 saints":["skim50","saint","saint","saint","saint"],
 "realistic 5p":["skim25","skim50","selfish","selfish","saint"],
 "1 rogue + careful":["rogue","skim50","skim75","selfish","saint"],
 "6p mix":["skim25","skim50","selfish","selfish","saint","saint"],
 "8p mix":["skim25","skim25","skim50","selfish","selfish","saint","saint","rogue"],
}
random.seed(5)
for label,plant,cost in (("Grapevine only",False,0),("+ planting, cost 1",True,1),("+ planting, cost 2",True,2),("+ planting, cost 3",True,3)):
    print(f"===== {label} =====")
    for t,seats in TESTS.items():
        res,gl,pl=table(seats,plant,cost)
        parts=", ".join(f"{s} {r:.0%}" for s,r in sorted(res.items(),key=lambda kv:-kv[1]))
        print(f"  {t:26s} skimmer caught {gl:4.0%} | a rumour planted {pl:4.0%} | {parts} (fair {1/len(seats):.0%})")
