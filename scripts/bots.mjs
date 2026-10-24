// DEV ONLY: fill seats in a room with scripted test players so you can test on one device.
// Bots are a testing tool and are never part of the real game.
//
//   node scripts/bots.mjs <server> <ROOMCODE> [count]
//   node scripts/bots.mjs http://localhost:8787 ABCDEF 3
//
// Each bot gets a personality (saint, skimmer, opportunist) and plays at human-ish speed.

const [server = "http://localhost:8787", code, countArg = "3"] = process.argv.slice(2);
if (!code) {
  console.log("Usage: node scripts/bots.mjs <server> <ROOMCODE> [count]");
  process.exit(1);
}
const NAMES = ["Botty", "Robo Rita", "Clank", "Sprocket", "Widget", "Gizmo", "Cog"];
const PERSONALITIES = ["saint", "skimmer", "opportunist"];
const finished = new Set();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (xs) => xs[Math.floor(Math.random() * xs.length)];

async function startBot(i) {
  const name = `${NAMES[i % NAMES.length]}${i >= NAMES.length ? i : ""}`;
  const personality = PERSONALITIES[i % PERSONALITIES.length];
  const res = await fetch(`${server}/api/rooms/${code}/join`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) });
  const seat = await res.json();
  if (!res.ok) throw new Error(`${name}: ${seat.error}`);
  const ws = new WebSocket(`${server.replace(/^http/, "ws")}/api/rooms/${code}/ws`);
  const send = (cmd) => ws.readyState === 1 && ws.send(JSON.stringify({ type: "CMD", cid: crypto.randomUUID(), cmd }));
  let acted = "";
  let view = null;

  const think = async () => {
    const { pub, me } = view;
    const key = JSON.stringify([pub.phase, pub.round, me.wallet, pub.players.map((p) => [p.id, p.ready]), me.bribes.map((b) => b.status), me.loans.map((l) => l.status), me.canVote]);
    if (key === acted) return;
    acted = key;
    await wait(rnd(400, 1500));
    const others = pub.players.filter((p) => p.id !== me.id);
    switch (pub.phase) {
      case "LOBBY":
        if (!pub.players.find((p) => p.id === me.id).ready) send({ type: "READY", ready: true });
        // A bot only starts the game if it happens to be the host (bots-only test rooms).
        else if (me.isHost && pub.players.length >= pub.rules.minPlayers && pub.players.every((p) => p.ready)) send({ type: "START" });
        break;
      case "NEGOTIATE": {
        for (const b of me.bribes.filter((b) => !b.mine && b.status === "pending")) send({ type: "RESPOND_BRIBE", id: b.id, accept: personality !== "saint" || b.side === "H" });
        for (const l of me.loans.filter((l) => l.current && l.borrower === me.id && l.status === "pending")) send({ type: "RESPOND_LOAN", id: l.id, accept: me.wallet < 6 });
        if (personality === "opportunist" && Math.random() < 0.3 && !me.bribes.some((b) => b.mine)) send({ type: "OFFER_BRIBE", to: pick(others).id, amount: rnd(1, 3), side: Math.random() < 0.6 ? "X" : "H" });
        if (personality === "saint" && Math.random() < 0.2 && me.wallet > 10) send({ type: "OFFER_LOAN", to: pick(others).id, amount: 2 });
        if (Math.random() < 0.15) send({ type: "CHAT", text: pick(["I'm voting HELP, obviously.", "Trust me.", "Who's been skimming?", "Not me.", "Save the barn!"]) });
        await wait(rnd(500, 2000));
        send({ type: "READY_NEXT" });
        break;
      }
      case "VOTE": {
        if (!me.canVote || me.lockedSide) break;
        const greed = { saint: 0.05, skimmer: 0.6, opportunist: 0.35 }[personality];
        const scared = pub.prosperity <= 2;
        send({ type: "VOTE", side: !scared && Math.random() < greed ? "X" : "H" });
        break;
      }
      case "PLANT":
        if (me.canPlant && personality !== "saint" && Math.random() < 0.5) send({ type: "PLANT", target: pick(others).id, count: rnd(2, pub.meeting.afterRound) });
        send({ type: "READY_NEXT" });
        break;
      case "NOMINATE": {
        const target = me.rumour && me.rumour.count >= 2 && me.rumour.subject !== me.id ? me.rumour.subject : pick(others).id;
        send({ type: "NOMINATE", target });
        break;
      }
      case "RECAP":
      case "DISCUSS":
      case "LOCKUP":
        send({ type: "READY_NEXT" });
        break;
      case "REVEAL":
        break;
    }
  };

  ws.onopen = () => ws.send(JSON.stringify({ type: "HELLO", token: seat.token }));
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === "STATE") {
      view = msg;
      if (!view.me) return ws.close();
      think().catch(() => {});
      if (view.pub.phase === "REVEAL" && !finished.has(name)) {
        finished.add(name);
        console.log(`${name} (${personality}) finished with ${view.reveal.players.find((p) => p.id === view.me.id).wallet} coins`);
        if (finished.size === n && process.env.BOTS_EXIT_AT_END) process.exit(0);
      }
    }
  };
  ws.onclose = () => console.log(`${name} disconnected`);
  console.log(`${name} joined as ${personality === "opportunist" ? "an" : "a"} ${personality}`);
}

const n = Math.max(1, Math.min(7, Number(countArg)));
for (let i = 0; i < n; i++) await startBot(i);
