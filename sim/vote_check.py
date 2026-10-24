import random
from badtown_sim3 import minimax
random.seed(13)
CFG=[("4p",(1,3),5,{}),("5p",(1,4),10,{}),("6p",(2,4),5,{}),("7p",(2,5),10,{}),("8p",(2,6),12,{"rats":2})]
for name,sp,L,kw in CFG:
    row=[]
    for lab,v in [("no vote",None),("vote, realistic accuracy",-1),("vote, always right",1.0),("vote, always wrong",0.0)]:
        _,_,er,_=minimax(sp,L,N=700,vote_acc=v,**kw); row.append(f"{lab} {er:.0%}")
    best=[]
    for L2 in (L, L+1, L+2):
        _,_,er,_=minimax(sp,L2,N=700,vote_acc=-1,**kw); best.append(f"L{L2}:{er:.0%}")
    print(f"{name} L{L}: "+" | ".join(row)+"   with vote: "+", ".join(best))
