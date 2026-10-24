"""BADTOWN v2 sim: inmates secretly bet on a side every night.

Escape: everyone who dug at least once (plus a Mole) wins. Paroled non-diggers are left behind.
Lockdown: Guards, a Loyal Trusty, and every inmate with parole >= PAROLE win.
So digging once AND reaching parole is a (hard) hedge that wins either way.

Inmate strategies:
  digger   digs most nights
  rat      never digs; sleeps or snitches (betting on the guards)
  hedger   digs early until they've dug once, then behaves for parole
"""
import random
from collections import defaultdict

NIGHTS = 6
TRUSTY_AFTER = 3


def play(split, length, parole_need, types, guard_q=0.5, mole_rate=0.6, sleep_parole=1, snitch_parole=2, parole_slots=1, rng=random):
    g, i = split
    guards = list(range(g))
    inmates = list(range(g, g + i))
    kind = {x: types[k] for k, x in enumerate(inmates)}
    parole = defaultdict(int)
    dug = set()
    hole = set()
    suspicion = defaultdict(float)
    tunnel = 0
    mole = loyal = None
    trusty_kind = None
    for night in range(1, NIGHTS + 1):
        if night == TRUSTY_AFTER + 1 and len(inmates) >= 3:
            cands = [x for x in inmates if x not in hole]
            pick = min(cands, key=lambda x: suspicion[x] + rng.random() * 0.6)
            inmates = [x for x in inmates if x != pick]
            trusty_kind = kind[pick]
            # A trusty who has dug leans mole; a rat leans loyal.
            p_mole = {"digger": 0.85, "hedger": 0.5, "rat": 0.1}[kind[pick]] if mole_rate is None else mole_rate
            if rng.random() < p_mole:
                mole = pick
            else:
                loyal = pick
        acts = {}
        for x in inmates:
            if x in hole:
                acts[x] = "HOLE"
                continue
            k = kind[x]
            if k == "digger":
                acts[x] = "DIG" if rng.random() < 0.85 else "SLEEP"
            elif k == "rat":
                acts[x] = "SNITCH" if rng.random() < 0.45 and len(inmates) > 1 else "SLEEP"
            else:  # hedger
                acts[x] = "DIG" if x not in dug and rng.random() < 0.8 else ("SNITCH" if rng.random() < 0.3 and len(inmates) > 1 else "SLEEP")
        hole = set()
        tips = defaultdict(int)
        for x, a in acts.items():
            if a == "SLEEP":
                parole[x] += sleep_parole
            elif a == "SNITCH":
                others = [y for y in inmates if y != x]
                diggers = [y for y in others if acts.get(y) == "DIG"]
                t = rng.choice(diggers) if diggers and rng.random() < 0.7 else rng.choice(others)
                tips[t] += 1
                if acts.get(t) == "DIG":
                    parole[x] += snitch_parole
        searchers = guards + ([loyal] if loyal is not None else [])
        targets, spot, pool = [], 0, list(inmates)
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
        if mole is not None and rng.random() < 0.7:
            digs += 1
        gain = max(0, digs - spot)
        tunnel += gain
        for x in inmates:
            if x not in targets:
                suspicion[x] += gain / max(1, len(inmates)) * 0.5
        if tunnel >= length:
            win = {x for x in dug} | ({mole} if mole is not None else set())
            return True, win, kind, mole, loyal, night
    cands = sorted([x for x in range(g, g + i) if x not in (mole, loyal) and parole[x] >= parole_need], key=lambda x: -parole[x])
    released = set()
    if parole_slots and cands:
        top = parole[cands[0]]
        tied = [x for x in cands if parole[x] == top]
        if len(tied) <= parole_slots:
            released = set(tied)  # the board only releases a clear winner; a tie means nobody goes
    win = set(guards) | ({loyal} if loyal is not None else set()) | released
    return False, win, kind, mole, loyal, NIGHTS


def evaluate(split, length, parole_need, mix, N=4000, **kw):
    """mix: fractions of digger/rat/hedger in the inmate population. Returns escape rate,
    each type's personal win rate, guard win rate and how often the game went to the last night."""
    g, i = split
    wins = defaultdict(float)
    count = defaultdict(int)
    esc = 0
    last = 0
    for _ in range(N):
        types = random.choices(list(mix), list(mix.values()), k=i)
        escaped, win, kind, mole, loyal, night = play(split, length, parole_need, types, **kw)
        esc += escaped
        last += night >= NIGHTS - 1
        for x, k in kind.items():
            count[k] += 1
            wins[k] += x in win
    return esc / N, {k: wins[k] / count[k] for k in count}, 1 - esc / N, last / N


def replicator(split, length, parole_need, steps=14, N=2500, **kw):
    """Let strategies that win more often become more common, and see where the population settles."""
    mix = {"digger": 1 / 3, "rat": 1 / 3, "hedger": 1 / 3}
    for _ in range(steps):
        esc, rate, gw, last = evaluate(split, length, parole_need, mix, N=N, **kw)
        avg = sum(mix[k] * rate.get(k, 0) for k in mix)
        mix = {k: max(0.02, mix[k] * (0.4 + rate.get(k, 0)) / (0.4 + avg)) for k in mix}
        t = sum(mix.values())
        mix = {k: v / t for k, v in mix.items()}
    esc, rate, gw, last = evaluate(split, length, parole_need, mix, N=N * 2, **kw)
    return mix, esc, rate, last
