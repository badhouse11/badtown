"""BADTOWN balance simulator.

NIGHT (simultaneous, secret)
  Inmate (not in the hole): DIG, SLEEP or SNITCH (name a cell).
    DIG    +1 metre of tunnel, unless caught.        Qualifies you to escape.
    SLEEP  +1 parole.
    SNITCH tip goes to every guard. +2 parole if the tip was true, 0 if false.
  Guard: SEARCH a cell or SPOTLIGHT the yard.
    SEARCH   if that inmate dug, they're caught: no metre, sent to the hole next night. (Only the searcher sees "clean".)
    SPOTLIGHT -1 metre tonight (only if anything was dug).
  Mole (secret, after the Trusty appointment): DIG FROM INSIDE (+1, hidden in the total) or fake a search.

MORNING (public): "The tunnel grew N metres." Anyone caught is named.

After night TRUSTY_AFTER: guards must appoint a Trusty from the inmates. The Trusty secretly chooses LOYAL or MOLE.

END
  Tunnel reaches LENGTH at dawn  -> ESCAPE. Everyone who dug at least once (and the mole) escapes and wins.
  Otherwise after NIGHTS nights   -> LOCKDOWN. Guards and a loyal Trusty win.
  Either way, any inmate with parole >= PAROLE walks out too and also wins.
"""
import random
import statistics
from collections import defaultdict

SPLIT = {3: (1, 2), 4: (1, 3), 5: (2, 3), 6: (2, 4), 7: (2, 5), 8: (3, 5)}
NIGHTS = 6
TRUSTY_AFTER = 3


def play(n, length, parole_need, inmate_p, guard_q, mole_rate=0.6, snitch_p=0.15, trusty=True, rng=random):
    g, i = SPLIT[n]
    guards = list(range(g))
    inmates = list(range(g, g + i))
    parole = defaultdict(int)
    dug = set()
    hole = set()
    suspicion = defaultdict(float)  # guards' running read on each inmate
    tunnel = 0
    mole = None
    loyal = None
    closest = 0
    per_night = []
    snitches = 0
    for night in range(1, NIGHTS + 1):
        # --- Trusty appointment ---
        if trusty and night == TRUSTY_AFTER + 1 and len(inmates) >= 2:
            cands = [x for x in inmates if x not in hole]
            pick = min(cands, key=lambda x: suspicion[x] + rng.random() * 0.5)
            inmates = [x for x in inmates if x != pick]
            if rng.random() < mole_rate:
                mole = pick
            else:
                loyal = pick
        # --- Inmates choose ---
        acts = {}
        for x in inmates:
            if x in hole:
                acts[x] = "SLEEP"
                parole[x] += 1
                continue
            p = inmate_p
            if x not in dug:
                p = max(p, 0.85 if night >= 4 else p)  # get your ticket out before it's too late
            if parole[x] >= parole_need - 1 and tunnel < length * 0.5:
                p *= 0.4  # nearly paroled and the tunnel looks hopeless: play safe
            r = rng.random()
            if r < p:
                acts[x] = "DIG"
            elif r < p + snitch_p and len(inmates) > 1:
                acts[x] = "SNITCH"
            else:
                acts[x] = "SLEEP"
        hole = set()
        # --- Snitch tips ---
        tips = defaultdict(int)
        for x, a in acts.items():
            if a == "SNITCH":
                snitches += 1
                others = [y for y in inmates if y != x]
                # A snitch has a decent read on the yard: names a real digger 70% of the time if there is one.
                diggers = [y for y in others if acts.get(y) == "DIG"]
                target = rng.choice(diggers) if diggers and rng.random() < 0.7 else rng.choice(others)
                tips[target] += 1
                if acts.get(target) == "DIG":
                    parole[x] += 2
            elif a == "SLEEP":
                parole[x] += 1
        # --- Guards choose (loyal trusty acts as a guard) ---
        searchers = guards + ([loyal] if loyal is not None else [])
        targets = []
        spot = 0
        pool = [x for x in inmates]
        for _ in searchers:
            if pool and rng.random() < guard_q:
                w = [0.4 + suspicion[x] + 2.5 * tips[x] for x in pool]
                t = rng.choices(pool, w)[0]
                pool.remove(t)
                targets.append(t)
            else:
                spot += 1
        digs = 0
        for x, a in acts.items():
            if a != "DIG":
                continue
            if x in targets:
                hole.add(x)
                suspicion[x] += 2
            else:
                digs += 1
                dug.add(x)
        # Mole: digs from inside most nights, otherwise fakes a search.
        if mole is not None and rng.random() < 0.7:
            digs += 1
        gain = max(0, digs - spot)
        tunnel += gain
        per_night.append(gain)
        # Public morning: everyone sees the tunnel grow. Guards nudge suspicion towards unsearched inmates.
        for x in inmates:
            if x not in targets:
                suspicion[x] += gain / max(1, len(inmates)) * 0.5
        closest = max(closest, tunnel / length)
        if tunnel >= length:
            escapers = set(dug) | ({mole} if mole is not None else set())
            winners = escapers | {x for x in range(g, g + i) if parole[x] >= parole_need}
            return dict(escape=True, night=night, winners=winners, n_inmates=i, snitches=snitches, mole=mole, loyal=loyal,
                        parole_only=len({x for x in range(g, g + i) if parole[x] >= parole_need} - escapers), closest=1.0)
    paroled = {x for x in range(g, g + i) if parole[x] >= parole_need}
    return dict(escape=False, night=NIGHTS, winners=set(guards) | ({loyal} if loyal is not None else set()) | paroled,
                n_inmates=i, snitches=snitches, mole=mole, loyal=loyal, parole_only=len(paroled), closest=closest)


def escape_rate(n, length, parole_need, p, q, N=3000, **kw):
    return sum(play(n, length, parole_need, p, q, **kw)["escape"] for _ in range(N)) / N


def minimax(n, length, parole_need, N=1500, **kw):
    """Inmates pick the dig rate that maximises escapes against the guards' best counter."""
    ps = [0.5, 0.6, 0.7, 0.8, 0.9]
    qs = [0.0, 0.25, 0.5, 0.75, 1.0]
    table = {(p, q): escape_rate(n, length, parole_need, p, q, N=N, **kw) for p in ps for q in qs}
    best_p = max(ps, key=lambda p: min(table[(p, q)] for q in qs))
    best_q = min(qs, key=lambda q: table[(best_p, q)])
    return best_p, best_q, table[(best_p, best_q)], table
