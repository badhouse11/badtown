import random
import sim_v2 as S
random.seed(21)
for B in [
 dict(pillar=7, pillar_at=8, developer=2, gossip=5, fence=1, chameleon=4, martyr=8, fixer=5, snake=1, snake_cap=3, neighbour=8),
 dict(pillar=8, pillar_at=8, developer=2, gossip=5, fence=1, chameleon=3, martyr=8, fixer=4, snake=1, snake_cap=3, neighbour=8),
 dict(pillar=8, pillar_at=8, developer=2, gossip=6, fence=1, chameleon=3, martyr=8, fixer=4, snake=1, snake_cap=2, neighbour=8),
]:
    out=[]; worst=0
    for n in (3,4,5,6,8):
        res,col=S.run(n,B,N=12000); fair=1/n
        if n in (4,5,6): worst=max(worst,max(max(r/fair, fair/max(r,1e-9)) for r in res.values()))
        out.append(f"  {n}p fair {fair:.0%} collapse {col:.0%}: "+", ".join(f"{a} {r:.0%}" for a,r in sorted(res.items(),key=lambda kv:-kv[1])))
    print(B, f"worst ratio (4-6p) {worst:.2f}x"); print("\n".join(out))
