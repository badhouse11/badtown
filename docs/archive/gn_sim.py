import random, statistics, itertools
from collections import defaultdict

# Card templates: (help_primary, help_secondary, harm_primary, harm_secondary)
T = [(1,0,-2,-1),(1,0,-1,-1),(1,1,-1,-1),(2,0,-1,1),(1,1,2,-1),(2,0,-1,1),(-1,1,1,-1),(-1,1,1,-1),
     (1,1,-2,0),(2,1,-2,0),(1,1,-1,2),(1,0,-1,-1),(1,1,2,-1),(1,0,-2,-1),(1,1,-1,-1),(1,1,2,0),
     (1,1,-2,0),(1,0,2,-1),(1,0,-1,1),(-1,2,1,-1)]

RULES = {
 "A_original":  dict(kickback=0, help_cost=0, collapse_all_lose=False),
 "B_kickback":  dict(kickback=1, help_cost=0, collapse_all_lose=True),
 "C_helpcost":  dict(kickback=0, help_cost=1, collapse_all_lose=True),
}

def round_payoff(rule, my_vote, others_help, others_harm, prosperity=4):
    """Coin change for one player from the stake/pot/dividend, ignoring card effects."""
    h = others_help + (my_vote == "H")
    x = others_harm + (my_vote == "X")
    if h > x or (h == x and prosperity >= 4): win = "H"
    else: win = "X"
    pot_losers = 2 * (x if win == "H" else h)
    winners = h if win == "H" else x
    d = 0
    if my_vote == win: d += pot_losers / winners
    else: d -= 2
    if win == "H": d += 1                      # dividend
    if my_vote == "X": d += rule["kickback"]
    if my_vote == "H": d -= rule["help_cost"]
    return d, win

# ---- strategies -------------------------------------------------------------
def saint(p, g, me): return "H"
def rogue(p, g, me): return "X"
def skimmer(p, g, me):          # betrays often, but backs off when the town is fragile
    if g["collapse_all_lose"] and g["pros"] <= 2: return "H"
    return "X" if random.random() < 0.5 else "H"
def selfish(p, g, me):          # follows own card interest, else coin-flip lean to harm
    c = g["card"]
    if me == g["prim"]: return "H" if c[0] >= c[2] else "X"
    if me == g["sec"]:  return "H" if c[1] >= c[3] else "X"
    return "X" if random.random() < 0.35 else "H"
def follower(p, g, me):         # sides with whatever won last round
    return g["last"] or "H"

STRATS = dict(saint=saint, rogue=rogue, skimmer=skimmer, selfish=selfish, follower=follower)

def play(rule, seats, rounds=8):
    n = len(seats)
    w = [12.0]*n; pros = 4; last=None; harm_wins=0
    for r in range(rounds):
        card = random.choice(T)
        prim, sec = random.sample(range(n), 2)
        g = dict(pros=pros, card=card, prim=prim, sec=sec, last=last,
                 collapse_all_lose=rule["collapse_all_lose"])
        votes = []
        for i,s in enumerate(seats):
            v = STRATS[s](None, g, i)
            if w[i] < 2 + (rule["help_cost"] if v=="H" else 0): v = None
            votes.append(v)
        h = votes.count("H"); x = votes.count("X")
        if h+x == 0: continue
        win = "H" if (h > x or (h == x and pros >= 4)) else "X"
        if win=="H" and h==0: win="X"
        if win=="X" and x==0: win="H"
        losers = x if win=="H" else h; winners = h if win=="H" else x
        for i,v in enumerate(votes):
            if v is None: continue
            if v == "H": w[i] -= rule["help_cost"]
            else: w[i] += rule["kickback"]
            w[i] += (2*losers/winners) if v == win else -2
        if win=="H":
            pros = min(8, pros+1); w = [c+1 for c in w]
            w[prim]+=card[0]; w[sec]+=card[1]
        else:
            pros -= 1; harm_wins += 1
            w[prim]+=card[2]; w[sec]+=card[3]
        w = [max(0,c) for c in w]
        last = win
        if pros <= 0: break
    collapsed = pros <= 0
    if collapsed and rule["collapse_all_lose"]: return None, collapsed, harm_wins, w
    top = max(w); return [i for i,c in enumerate(w) if c==top], collapsed, harm_wins, w

def run(rule_name, table, N=20000):
    rule = RULES[rule_name]
    wins = defaultdict(float); appear = defaultdict(int); coins = defaultdict(list)
    collapses = 0; nowinner = 0; hw = []
    for _ in range(N):
        seats = table[:]; random.shuffle(seats)
        winners, col, h, w = play(rule, seats)
        collapses += col; hw.append(h)
        for i,s in enumerate(seats): appear[s]+=1; coins[s].append(w[i])
        if winners is None: nowinner += 1; continue
        for i in winners: wins[seats[i]] += 1/len(winners)
    share = {s: wins[s]/(appear[s]/table.count(s)) / table.count(s) * len(table) / len(table) for s in appear}
    # win rate per seat of that strategy
    per_seat = {s: wins[s]/appear[s] for s in appear}
    return per_seat, collapses/N, nowinner/N, statistics.mean(hw), {s: statistics.mean(c) for s,c in coins.items()}

if __name__ == "__main__":
    random.seed(7)
    print("=== 1. Does a LONE traitor profit? (5 players, other 4 vote HELP, prosperity 4) ===")
    for name, rule in RULES.items():
        ph,_ = round_payoff(rule,"H",4,0); px,_ = round_payoff(rule,"X",4,0)
        print(f"{name:12s} vote HELP: {ph:+.2f}   vote HARM: {px:+.2f}   -> betrayal {'PAYS' if px>ph else 'costs'} {abs(px-ph):.2f}")
    print("\n=== 1b. Relative to the table (what matters for 'richest wins') ===")
    for name, rule in RULES.items():
        ph,_ = round_payoff(rule,"H",4,0); oh,_ = round_payoff(rule,"H",3,1)   # others' payoff when I defect
        px,_ = round_payoff(rule,"X",4,0)
        print(f"{name:12s} lead gained over each honest neighbour by defecting: {px-oh:+.2f} (vs 0 if I'd helped)")

    tables = {
      "mixed": ["saint","rogue","skimmer","selfish","follower"],
      "two_skimmers": ["saint","saint","skimmer","skimmer","selfish"],
      "greedy_table": ["rogue","rogue","skimmer","skimmer","selfish"],
    }
    for tname, table in tables.items():
        print(f"\n=== 2. Table '{tname}': {table} (20,000 games each) ===")
        for rn in RULES:
            per, col, nw, hw, mc = run(rn, table)
            print(f"-- {rn}: collapse {col:.0%} | no-winner {nw:.0%} | avg HARM wins/game {hw:.2f}")
            for s in sorted(per, key=lambda k:-per[k]):
                print(f"     {s:9s} win rate/seat {per[s]:.0%}   avg end coins {mc[s]:.1f}")
