import random, itertools
import sim_v2 as S
random.seed(9)
cands = [
 dict(pillar=8, pillar_at=8, developer=2, gossip=5, fence=1, martyr=8, fixer=4, snake=1, neighbour=7),
 dict(pillar=8, pillar_at=8, developer=2, gossip=6, fence=1, martyr=9, fixer=5, snake=1, neighbour=8),
 dict(pillar=9, pillar_at=8, developer=2, gossip=6, fence=2, martyr=9, fixer=5, snake=1, neighbour=8),
 dict(pillar=9, pillar_at=8, developer=3, gossip=6, fence=2, martyr=10, fixer=5, snake=1, neighbour=9),
]
for B in cands:
    worst = 0; lines = []
    for n in (3, 4, 5, 6, 8):
        res, col = S.run(n, B, N=8000)
        fair = 1/n
        dev = max(abs(r-fair)/fair for r in res.values())
        worst = max(worst, dev)
        lines.append(f"  {n}p fair {fair:.0%}: " + ", ".join(f"{a} {r:.0%}" for a, r in sorted(res.items(), key=lambda kv: -kv[1])))
    print(B, f"worst relative deviation {worst:.0%}"); print("\n".join(lines))
