"""BADTOWN v3: a Rat in the cells, a Mole in the uniform.

Public: who's a Guard and who's an Inmate.
Secret: one Inmate is THE RAT (wins with the Guards). After night 3 the Guards must appoint
a TRUSTY from the Inmates. If they pick the Rat, the Rat simply joins them. Anyone else picks
LOYAL (now wins with the Guards) or MOLE (still wins with the Inmates, digs from the inside).

NIGHT, step 1 (cells, simultaneous):  Inmate: DIG or SLEEP.  Rat: SLEEP, DIG (cover) or NAME a cell.
NIGHT, step 2 (guard room): Guards see the Rat's whisper, then SEARCH a cell or SPOTLIGHT.
   SEARCH catches a digger: no metre, and they're in the hole next night.
   SPOTLIGHT: -1 metre tonight.  Mole: digs from inside (+1, hidden in the total).
MORNING: "The tunnel grew N metres." Anyone caught is named.
END: tunnel >= LENGTH by dawn of night NIGHTS -> ESCAPE (Inmates + Mole). Otherwise LOCKDOWN (Guards, Rat, Loyal Trusty).
"""
import random
from collections import defaultdict

NIGHTS = 6
TRUSTY_AFTER = 3


def play(split, length, p_dig, q_search, rat_acc=0.5, rat_cover=0.25, guard_pick_rat=None, mole_rate=0.75, mole_dig=0.75, rats=1, rng=random):
    g, i = split
    inmates = list(range(i))
    rat_ids = set(rng.sample(inmates, rats))
    guards = g
    hole = set()
    suspicion = defaultdict(float)
    tunnel = 0
    mole = False
    loyal_extra = 0
    caught_total = 0
    rat_promoted = False
    gains = []
    for night in range(1, NIGHTS + 1):
        if night == TRUSTY_AFTER + 1 and len(inmates) >= 3:
            # Guards try to promote the Rat. Chance they find them:
            pr = guard_pick_rat if guard_pick_rat is not None else min(0.8, 1.6 / len(inmates))
            live_rats = [x for x in inmates if x in rat_ids]
            if live_rats and rng.random() < pr:
                pick = live_rats[0]
                rat_promoted = True
                loyal_extra += 1
            else:
                honest = [x for x in inmates if x not in rat_ids and x not in hole] or [x for x in inmates if x not in rat_ids]
                pick = rng.choice(honest)
                if rng.random() < mole_rate:
                    mole = True
                else:
                    loyal_extra += 1
            inmates = [x for x in inmates if x != pick]
            rat_ids.discard(pick)
        acts = {}
        for x in inmates:
            if x in hole:
                acts[x] = "HOLE"
            elif x in rat_ids:
                r = rng.random()
                acts[x] = "DIG" if r < rat_cover else "NAME"
            else:
                acts[x] = "DIG" if rng.random() < p_dig else "SLEEP"
        hole = set()
        whispers = defaultdict(int)
        for x, a in acts.items():
            if a == "NAME":
                diggers = [y for y in inmates if acts.get(y) == "DIG" and y != x]
                others = [y for y in inmates if y != x]
                if others:
                    t = rng.choice(diggers) if diggers and rng.random() < rat_acc else rng.choice(others)
                    whispers[t] += 1
        searchers = guards + loyal_extra
        pool = list(inmates)
        targets, spot = [], 0
        for _ in range(searchers):
            if pool and rng.random() < q_search:
                w = [0.5 + suspicion[x] + 3 * whispers[x] for x in pool]
                t = rng.choices(pool, w)[0]
                pool.remove(t)
                targets.append(t)
            else:
                spot += 1
        digs = 0
        for x, a in acts.items():
            if a == "DIG":
                if x in targets:
                    hole.add(x)
                    suspicion[x] += 1.5
                    caught_total += 1
                else:
                    digs += 1
        if mole and rng.random() < mole_dig:
            digs += 1
        gain = max(0, digs - spot)
        tunnel += gain
        gains.append(gain)
        for x in inmates:
            if x not in targets:
                suspicion[x] += gain / max(1, len(inmates)) * 0.4
        if tunnel >= length:
            return dict(escape=True, night=night, mole=mole, rat_promoted=rat_promoted, caught=caught_total, gains=gains)
    return dict(escape=False, night=NIGHTS, mole=mole, rat_promoted=rat_promoted, caught=caught_total, gains=gains, short=length - tunnel)


def rate(split, L, p, q, N=1500, **kw):
    return sum(play(split, L, p, q, **kw)["escape"] for _ in range(N)) / N


def minimax(split, L, N=1200, **kw):
    ps = [0.5, 0.65, 0.8, 0.9, 1.0]
    qs = [0.0, 0.25, 0.5, 0.75, 1.0]
    t = {(p, q): rate(split, L, p, q, N=N, **kw) for p in ps for q in qs}
    bp = max(ps, key=lambda p: min(t[(p, q)] for q in qs))
    bq = min(qs, key=lambda q: t[(bp, q)])
    return bp, bq, t[(bp, bq)], t


def drama(split, L, p, q, N=4000, **kw):
    games = [play(split, L, p, q, **kw) for _ in range(N)]
    esc = [x for x in games if x["escape"]]
    locked = [x for x in games if not x["escape"]]
    return dict(
        escape=len(esc) / N,
        escape_on_last_two_nights=sum(x["night"] >= NIGHTS - 1 for x in esc) / max(1, len(esc)),
        lockdowns_within_2m=sum(x["short"] <= 2 for x in locked) / max(1, len(locked)),
        mole_games=sum(x["mole"] for x in games) / N,
        mole_escape=sum(x["escape"] for x in games if x["mole"]) / max(1, sum(x["mole"] for x in games)),
        rat_promoted=sum(x["rat_promoted"] for x in games) / N,
        avg_caught=sum(x["caught"] for x in games) / N,
    )
