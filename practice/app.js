// BADTOWN practice yard: you against bots, running the real engine in the browser.
// BT (the engine and bots) is bundled in above this script by scripts/build-practice.mjs.

const { newRoom, addPlayer, applyCommand, viewFor, botMove, botChatter, playerById, TABLES } = BT;
const HUMAN = "you";
const BOT_NAMES = ["Mouse", "Dutch", "Biscuit", "Preacher", "Sully", "Kit", "Moss", "Rook", "Vinnie"];
const app = document.getElementById("app");
const strip = document.getElementById("strip");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

let opts = { name: "", size: 6, role: "random" };
try { Object.assign(opts, JSON.parse(localStorage.getItem("badtown-practice") || "{}")); } catch {}
let state = null;
let pumpTimer = null;
let chatted = new Set();
let lastPhaseKey = "";
let shownTunnel = 0;
let cid = 0;
let dayStart = 0;

// ---------------------------------------------------------------------------------------
// Game control

function startGame() {
  try { localStorage.setItem("badtown-practice", JSON.stringify(opts)); } catch {}
  const now = Date.now();
  state = newRoom("YARD01", now, { untimed: true });
  addPlayer(state, HUMAN, opts.name.trim() || "You", "").player.connected = true;
  const names = BOT_NAMES.slice().sort(() => Math.random() - 0.5);
  for (let i = 1; i < opts.size; i++) addPlayer(state, `b${i}`, names[i - 1], "", true);
  applyCommand(state, HUMAN, undefined, { type: "READY", ready: true }, now);
  applyCommand(state, HUMAN, undefined, { type: "START" }, now);
  forceRole();
  chatted = new Set();
  shownTunnel = 0;
  render();
  pump();
}

/** Practice lets you choose your side: swap seats with someone who has the role you want. */
function forceRole() {
  const me = playerById(state, HUMAN);
  const want = opts.role === "random" ? null : opts.role;
  let other = null;
  if (want === "guard" && me.uniform !== "guard") other = state.players.find((p) => p.uniform === "guard");
  if (want === "inmate" && (me.uniform !== "inmate" || me.rat)) other = state.players.find((p) => p.uniform === "inmate" && !p.rat && p.id !== HUMAN);
  if (want === "rat" && !me.rat) other = state.players.find((p) => p.rat);
  if (!other) return;
  for (const k of ["uniform", "number", "rat"]) [me[k], other[k]] = [other[k], me[k]];
}

function act(cmd) {
  const res = applyCommand(state, HUMAN, `h${++cid}`, cmd, Date.now());
  if (!res.ok) toast(res.error);
  render();
  pump();
}

/** Bots act one at a time with a short pause, so the night feels like it's happening. */
function pump() {
  clearTimeout(pumpTimer);
  if (!state || state.phase === "END") return;
  if (state.phase === "DAY") scheduleChatter();
  const bots = state.players.filter((p) => p.isBot && botMove(state, p.id, Math.random));
  if (!bots.length) return;
  const quick = ["ROLE", "DAY", "MORNING", "COUNT_RESULT"].includes(state.phase);
  pumpTimer = setTimeout(() => {
    const bot = bots[Math.floor(Math.random() * bots.length)];
    const move = botMove(state, bot.id, Math.random);
    if (move) applyCommand(state, bot.id, undefined, move, Date.now());
    render();
    pump();
  }, quick ? 120 : 380 + Math.random() * 520);
}

function scheduleChatter() {
  state.players.filter((p) => p.isBot).forEach((p, i) => {
    const key = `${state.gameNo}:${state.day}:${p.id}`;
    if (chatted.has(key)) return;
    chatted.add(key);
    setTimeout(() => {
      if (state.phase !== "DAY") return;
      const line = botChatter(state, p.id, Math.random);
      if (line) {
        applyCommand(state, p.id, undefined, { type: "CHAT", text: line }, Date.now());
        render();
      }
    }, 500 + i * 700 + Math.random() * 400);
  });
}

// ---------------------------------------------------------------------------------------
// Bits

function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (t.hidden = true), 2600);
}

const P = (id) => state.players.find((p) => p.id === id);
function label(id) {
  const p = P(id);
  if (!p) return "?";
  if (p.uniform === "guard") return `Badge ${p.number}`;
  return `Cell ${p.number}`;
}
const who = (id) => `${label(id)}${id === HUMAN ? " (you)" : ` (${esc(P(id).name)})`}`;
const btn = (text, cmd, cls = "") => `<button class="btn ${cls}" data-cmd='${esc(JSON.stringify(cmd))}'>${text}</button>`;

function roleLine(me) {
  if (me.uniform === "guard") return { title: "Guard", secret: "" };
  if (me.promoted) return { title: `Trusty, cell ${me.number}`, secret: me.allegiance === "mole" ? "Mole" : me.allegiance === "rat" ? "Rat" : "Loyal" };
  return { title: `Cell ${me.number}`, secret: me.rat ? (me.exposed ? "Rat, exposed" : "Rat") : "" };
}

// ---------------------------------------------------------------------------------------
// Render

function render() {
  if (!state) return setupScreen();
  const v = viewFor(state, HUMAN);
  const { pub, me } = v;
  document.body.dataset.lights = ["CELLS", "GUARDROOM"].includes(pub.phase) ? "off" : "on";
  renderStrip(pub, me);
  const screens = { ROLE: roleScreen, DAY: dayScreen, COUNT: countScreen, COUNT_RESULT: countResult, CELLS: cellsScreen, GUARDROOM: guardScreen, MORNING: morningScreen, TRUSTY_PICK: trustyPick, TRUSTY_CHOICE: trustyChoice, END: endScreen };
  const key = `${pub.gameNo}:${pub.day}:${pub.phase}`;
  const fresh = key !== lastPhaseKey;
  lastPhaseKey = key;
  if (fresh && pub.phase === "DAY") dayStart = Date.now() - 1; // yard talk shows only today's chatter
  app.innerHTML = screens[pub.phase](v) + roster(pub);
  app.querySelectorAll("[data-cmd]").forEach((b) => (b.onclick = () => act(JSON.parse(b.dataset.cmd))));
  app.querySelectorAll("[data-go]").forEach((b) => (b.onclick = () => (b.dataset.go === "again" ? startGame() : ((state = null), render()))));
  if (fresh) {
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
    app.querySelectorAll(".stamp").forEach((s) => s.classList.add("land"));
  }
}

function renderStrip(pub, me) {
  strip.hidden = false;
  const r = roleLine(me);
  const wall = pub.wall ?? 0;
  const blocks = Array.from({ length: wall }, (_, i) => `<i class="${i < pub.tunnel ? "dug" : ""}${i >= shownTunnel && i < pub.tunnel ? " new" : ""}"></i>`).join("");
  shownTunnel = pub.tunnel;
  strip.innerHTML = `<div class="wrap" style="display:grid;gap:8px">
    <div class="top"><span class="day">${pub.phase === "ROLE" ? "Booking in" : pub.phase === "END" ? "Day " + pub.day : `Day ${pub.day} of ${pub.nights}`}</span>
      <span class="me">${esc(r.title)}${r.secret ? ` · <span class="secret">${esc(r.secret)}</span>` : ""}</span></div>
    <div class="tunnel" role="img" aria-label="Tunnel ${pub.tunnel} of ${wall} metres"><span class="end">Cells</span>
      <div class="blocks" style="grid-template-columns:repeat(${wall},1fr)">${blocks}</div>
      <span class="row" style="gap:6px"><span class="end">${pub.tunnel}/${wall} m</span><span class="wall"></span></span></div>
  </div>`;
}

function roster(pub) {
  const tags = (p) => [p.promoted ? "Trusty" : "", p.exposed ? "Rat" : "", p.inHole ? "In the hole" : ""].filter(Boolean).join(" · ");
  const cards = pub.players.slice().sort((a, b) => (a.uniform === b.uniform ? a.number - b.number : a.uniform === "guard" ? -1 : 1)).map((p) => {
    const cls = p.uniform === "guard" || p.promoted ? "guard" : "inmate";
    const num = p.uniform === "guard" ? `Badge ${p.number}` : `Cell ${p.number}`;
    return `<div class="${cls}${p.id === HUMAN ? " you" : ""}"><span class="num">${num}</span><span class="nm">${p.id === HUMAN ? "You" : esc(p.name)}</span>${tags(p) ? `<span class="tag">${tags(p)}</span>` : ""}</div>`;
  }).join("");
  return `<section class="stack" aria-label="The block"><hr><p class="label">The block</p><div class="roster">${cards}</div></section>`;
}

// ---------------------------------------------------------------------------------------
// Screens

function setupScreen() {
  document.body.dataset.lights = "on";
  strip.hidden = true;
  const t = TABLES[opts.size];
  const sizes = [4, 5, 6, 7, 8].map((n) => `<button data-size="${n}" aria-pressed="${opts.size === n}">${n}</button>`).join("");
  const roles = [["random", "Random"], ["inmate", "Inmate"], ["rat", "Rat"], ["guard", "Guard"]].map(([k, l]) => `<button data-role="${k}" aria-pressed="${opts.role === k}">${l}</button>`).join("");
  app.innerHTML = `
    <section class="hero">
      <div class="title">Bad<br>town</div>
      <p class="sub">There's a tunnel under Badtown. There's a Rat in the cells. And by night four, there's a Mole in the uniform.</p>
      <p class="muted">Practice yard: you against the bots. Same rules as the real game.</p>
    </section>
    <section class="sheet">
      <p class="label">Booking form</p>
      <label class="stack" style="gap:6px"><span class="label">Your name</span><input type="text" id="name" maxlength="16" value="${esc(opts.name)}" placeholder="You"></label>
      <div class="stack" style="gap:6px"><span class="label">Players at the table</span><div class="seg" role="group" aria-label="Players">${sizes}</div>
        <p class="small muted">${t.guards} guard${t.guards > 1 ? "s" : ""}, ${t.inmates} inmates, ${t.rats} Rat${t.rats > 1 ? "s" : ""} among them. The wall is ${t.wall} metres away.</p></div>
      <div class="stack" style="gap:6px"><span class="label">Play as</span><div class="seg" role="group" aria-label="Role">${roles}</div></div>
      <button class="btn hot wide" id="go">Lock me up</button>
    </section>
    <details class="rules sheet"><summary>How it works</summary>
      <ol>
        <li><b>Day.</b> Talk. Accuse. Lie.</li>
        <li><b>Lights out in the cells.</b> Each inmate secretly digs or sleeps. The Rat can whisper a cell number to the guards instead.</li>
        <li><b>Lights out in the guard room.</b> Each guard searches a cell or sweeps the yard with the spotlight. A search catches a digger in the act: no metre, and a night in the hole. The spotlight knocks a metre off tonight's dig.</li>
        <li><b>Morning.</b> Everyone sees how far the tunnel grew, and who got caught.</li>
        <li><b>Day 3:</b> the cells vote on who the Rat is. Get it right and the Rat is finished. Get it wrong and an innocent spends the night in the hole.</li>
        <li><b>After night 3:</b> the guards must make one inmate a Trusty. Pick the Rat and you gain a loyal officer. Pick anyone else and they choose: stay Loyal, or become the Mole and dig from inside the uniform.</li>
        <li>Reach the wall by dawn on day 6 and the inmates escape. Otherwise, lockdown.</li>
      </ol></details>`;
  app.querySelectorAll("[data-size]").forEach((b) => (b.onclick = () => { opts.size = +b.dataset.size; opts.name = document.getElementById("name").value; setupScreen(); }));
  app.querySelectorAll("[data-role]").forEach((b) => (b.onclick = () => { opts.role = b.dataset.role; opts.name = document.getElementById("name").value; setupScreen(); }));
  document.getElementById("go").onclick = () => { opts.name = document.getElementById("name").value; startGame(); };
}

function roleScreen({ pub, me }) {
  const t = pub.setup;
  let objective;
  if (me.uniform === "guard") objective = "Stop the tunnel reaching the wall by dawn on day 6. Search cells, sweep the yard. After night 3 you must make one inmate your Trusty. Try to pick the Rat.";
  else if (me.rat) objective = "You work for the guards. Each night you can whisper a cell number to them. If the tunnel fails, you win. If they make you Trusty, you're in. Don't get caught out at the day 3 vote.";
  else objective = "Dig. Reach the wall by dawn on day 6 and you're out. One of your cellmates is a Rat. On day 3 the cells vote on who.";
  return `<main><section class="stack">
    <h2>${me.uniform === "guard" ? "You're a guard" : me.rat ? "You're the Rat" : "You're an inmate"}</h2>
    <div class="sheet"><dl>
      <dt>Name</dt><dd>${esc(me.name)}</dd>
      <dt>${me.uniform === "guard" ? "Badge" : "Cell"}</dt><dd>${me.number}</dd>
      <dt>Wins with</dt><dd>${me.uniform === "guard" || me.rat ? "The guards" : "The inmates"}</dd>
      <dt>Secret</dt><dd>${me.rat ? "<b>You're the Rat.</b> Nobody knows." : "None. Yet."}</dd>
    </dl><p>${objective}</p></div>
    <p class="muted small">This block: ${t.guards} guard${t.guards > 1 ? "s" : ""}, ${t.inmates} inmates, ${t.rats} Rat${t.rats > 1 ? "s" : ""}. The wall is ${t.wall} metres from the cells.</p>
    ${btn("Start day 1", { type: "READY_NEXT" }, "hot wide")}
  </section></main>`;
}

function lastNightLine(pub) {
  const h = pub.history[pub.history.length - 1];
  if (!h) return "";
  return `<p class="note">Last night the tunnel grew <b>${h.gain} m</b>${h.caught.length ? `. Caught: ${h.caught.map(label).join(", ")}` : ""}.</p>`;
}

function dayScreen({ pub, me }) {
  const lines = state.chat.filter((c) => c.at >= dayStart).slice(-10);
  const notes = [];
  if (pub.day === pub.countDay) notes.push(`<p class="note">Before lights out tonight, the cells vote on who the Rat is.</p>`);
  if (pub.trusty?.chosen && pub.day === pub.trustyAfter + 1) notes.push(`<p class="note">${who(pub.trusty.chosen)} wears a Trusty badge now. Whose side are they on?</p>`);
  if (me.uniform === "guard" && pub.day === pub.trustyAfter) notes.push(`<p class="note">After tonight you must appoint a Trusty.</p>`);
  return `<main><section class="stack">
    <h2>Day ${pub.day}</h2>
    ${lastNightLine(pub)}
    ${notes.join("")}
    <p class="label">Yard talk</p>
    ${lines.length ? `<ul class="yard">${lines.map((c) => `<li><b>${esc(label(c.pid))}</b><span>${esc(c.text)}</span></li>`).join("")}</ul>` : `<p class="muted">Quiet in the yard.</p>`}
    ${btn(pub.day === pub.countDay ? "Call the vote" : "Lights out", { type: "READY_NEXT" }, "hot wide")}
  </section></main>`;
}

function countScreen({ pub, me }) {
  const voter = me.uniform === "inmate" && !me.promoted;
  if (!voter) return `<main><section class="stack"><h2>The count</h2><p>The cells are voting on who the Rat is. You can only watch.</p></section></main>`;
  if (me.countVote !== undefined) return `<main><section class="stack"><h2>The count</h2><p>Vote cast. Waiting for the rest of the cells.</p></section></main>`;
  const others = pub.players.filter((p) => p.uniform === "inmate" && !p.promoted && p.id !== HUMAN);
  return `<main><section class="stack">
    <h2>Who's the Rat?</h2>
    <p>Most votes wins. Get it right and the Rat can't whisper again. Get it wrong and that cell spends tonight in the hole.${me.rat ? " <b>You're the Rat.</b> Steer it somewhere else." : ""}</p>
    <div class="cells">${others.map((p) => btn(`Cell ${p.number}<small>${esc(p.name)}</small>`, { type: "COUNT_VOTE", target: p.id })).join("")}${btn("Nobody", { type: "COUNT_VOTE", target: null }, "ghost")}</div>
  </section></main>`;
}

function countResult({ pub }) {
  const c = pub.count;
  let body;
  if (!c.target) body = `<div class="stamp olive">No verdict</div><p>The votes were split. Nobody's named.</p>`;
  else if (c.wasRat) body = `<div class="stamp">Rat</div><p>${who(c.target)} was the Rat. No more whispers from them.</p>`;
  else body = `<div class="stamp olive">Innocent</div><p>${who(c.target)} wasn't the Rat. They spend tonight in the hole anyway.</p>`;
  return `<main><section class="stack"><h2>The count</h2>${body}${btn("Lights out", { type: "READY_NEXT" }, "hot wide")}</section></main>`;
}

function cellsScreen({ pub, me }) {
  if (me.mustAct) {
    const others = pub.players.filter((p) => p.uniform === "inmate" && !p.promoted && p.id !== HUMAN);
    return `<main><section class="stack">
      <h2>Lights out</h2>
      <div class="big">${btn(`Dig<small>+1 m, unless they search you</small>`, { type: "CELL", act: { kind: "DIG" } }, "hot")}${btn(`Sleep<small>Stay clean tonight</small>`, { type: "CELL", act: { kind: "SLEEP" } }, "ghost")}</div>
      ${me.rat && !me.exposed ? `<p class="label">Or whisper to the guards</p><div class="cells">${others.map((p) => btn(`Cell ${p.number}<small>${esc(p.name)}</small>`, { type: "CELL", act: { kind: "WHISPER", target: p.id } }, "ghost")).join("")}</div>` : ""}
    </section></main>`;
  }
  if (me.cellAct) return `<main><section class="stack"><h2>Lights out</h2><p>${me.cellAct.kind === "DIG" ? "You're digging." : me.cellAct.kind === "WHISPER" ? `You whispered ${label(me.cellAct.target)}.` : "You're asleep. Or pretending."} Waiting for the rest of the cells.</p></section></main>`;
  if (me.inHole) return `<main><section class="stack"><h2>The hole</h2><p>No digging for you tonight.</p></section></main>`;
  return `<main><section class="stack"><h2>Lights out</h2><p class="muted">Something's scraping down in the cells.</p></section></main>`;
}

function guardScreen({ pub, me }) {
  const inRoom = me.uniform === "guard" || me.promoted;
  if (!inRoom) return `<main><section class="stack"><h2>Lights out</h2><p class="muted">Footsteps in the corridor. The guards are choosing.</p></section></main>`;
  if (!me.mustAct) return `<main><section class="stack"><h2>The guard room</h2><p>Order given. Waiting for the others.</p></section></main>`;
  const targets = pub.players.filter((p) => p.uniform === "inmate" && !p.promoted && !p.inHole && p.id !== HUMAN);
  return `<main><section class="stack">
    <h2>The guard room</h2>
    ${me.whispers.length ? me.whispers.map((t) => `<p class="note">A whisper from the cells: <b>${label(t)}</b>.</p>`).join("") : `<p class="muted">No whispers tonight.</p>`}
    <p class="label">Search a cell</p>
    <div class="cells">${targets.map((p) => btn(`Cell ${p.number}<small>${esc(p.name)}</small>`, { type: "GUARD", act: { kind: "SEARCH", target: p.id } }, "ghost")).join("")}</div>
    <p class="label">Or</p>
    <div class="big">${btn(`Spotlight<small>Knock a metre off tonight</small>`, { type: "GUARD", act: { kind: "SPOTLIGHT" } }, "ghost")}${me.allegiance === "mole" ? btn(`Tunnel<small>+1 m from inside. Nobody sees.</small>`, { type: "GUARD", act: { kind: "TUNNEL" } }, "hot") : ""}</div>
  </section></main>`;
}

function morningScreen({ pub, me }) {
  const m = pub.morning;
  const through = pub.tunnel >= pub.wall;
  const last = pub.day >= pub.nights;
  const mine = me.searches.find((s) => s.night === m.night);
  const left = pub.wall - pub.tunnel;
  return `<main><section class="stack">
    <h2>Morning, day ${m.night}</h2>
    <div class="stamp ${through ? "go" : "olive"}">${through ? "Through" : `+${m.gain} m`}</div>
    <p>${through ? "The tunnel has reached the wall." : `The tunnel grew <b>${m.gain} metre${m.gain === 1 ? "" : "s"}</b>. ${left} to go.`}</p>
    ${m.caught.map((id) => `<p class="note alarm"><b>Caught digging:</b> ${who(id)}. In the hole tonight.</p>`).join("")}
    ${mine ? `<p class="note">Your search of ${label(mine.target)}: <b>${mine.found ? "caught them digging" : "clean"}</b>. Only you know.</p>` : ""}
    ${!through && last ? `<p class="note alarm">Dawn on day ${pub.nights}. The tunnel came up short.</p>` : ""}
    ${btn(through || last ? "See who walked out" : pub.day === pub.trustyAfter ? "Appoint the Trusty" : "Next day", { type: "READY_NEXT" }, "hot wide")}
  </section></main>`;
}

function trustyPick({ pub, me }) {
  if (me.uniform !== "guard") return `<main><section class="stack"><h2>A badge on the table</h2><p>The guards are choosing a Trusty from the cells.</p></section></main>`;
  if (me.trustyVote) return `<main><section class="stack"><h2>A badge on the table</h2><p>You chose ${label(me.trustyVote)}. Waiting for the other guards.</p></section></main>`;
  const cands = pub.players.filter((p) => p.uniform === "inmate" && !p.promoted && !p.exposed);
  return `<main><section class="stack">
    <h2>Appoint a Trusty</h2>
    <p>Pick the Rat and you gain a loyal officer. Pick anyone else and they might stay loyal, or become the Mole.</p>
    <div class="cells">${cands.map((p) => btn(`Cell ${p.number}<small>${esc(p.name)}</small>`, { type: "PICK_TRUSTY", target: p.id })).join("")}</div>
  </section></main>`;
}

function trustyChoice({ pub, me }) {
  const chosen = pub.trusty.chosen;
  if (chosen !== HUMAN) return `<main><section class="stack"><h2>A badge on the table</h2><p>${who(chosen)} is the new Trusty${pub.trusty.byWarden ? ". The guards couldn't agree, so the warden picked." : "."} They're choosing a side.</p></section></main>`;
  if (me.allegiance === "rat") return `<main><section class="stack"><h2>They picked you</h2><div class="stamp">In</div><p>You're the Rat, and now you've got a badge. You join the guard room. Nobody in the cells needs to know.</p>${btn("Into the guard room", { type: "READY_NEXT" }, "hot wide")}</section></main>`;
  if (me.allegiance) return `<main><section class="stack"><h2>Sworn in</h2><p>Waiting for day ${pub.day + 1}.</p></section></main>`;
  return `<main><section class="stack">
    <h2>They gave you a badge</h2>
    <p>You're the Trusty. You work in the guard room now. Decide, in secret, who you really work for.</p>
    <div class="big">${btn(`Loyal<small>Switch sides. Win with the guards.</small>`, { type: "CHOOSE_SIDE", side: "loyal" }, "ghost")}${btn(`Mole<small>Stay with the cells. Dig from inside.</small>`, { type: "CHOOSE_SIDE", side: "mole" }, "hot")}</div>
  </section></main>`;
}

function endScreen({ pub, reveal }) {
  const r = reveal;
  const meR = r.players.find((p) => p.id === HUMAN);
  const escaped = r.outcome.winner === "inmates";
  const name = (id) => label(id) + (id === HUMAN ? " (you)" : "");
  const roleOf = (p) => p.promoted ? (p.allegiance === "mole" ? "Trusty, the Mole" : p.allegiance === "rat" ? "Trusty, the Rat" : "Trusty, loyal") : p.uniform === "guard" ? "Guard" : p.rat ? "The Rat" : "Inmate";
  const order = r.players.slice().sort((a, b) => (a.uniform === b.uniform ? a.number - b.number : a.uniform === "guard" ? 1 : -1));
  const cell = (n, id) => {
    const c = n.cells[id];
    const g = n.guards[id];
    if (n.inHole.includes(id)) return `<td class="hole">Hole</td>`;
    if (c) {
      const caught = n.caught.includes(id);
      if (c.kind === "DIG") return `<td class="${caught ? "caught" : "dig"}">${caught ? "Caught" : "Dug"}</td>`;
      if (c.kind === "WHISPER") return `<td>Whisper ${esc(label(c.target).replace("Cell ", "c"))}</td>`;
      return `<td>Slept</td>`;
    }
    if (g) return `<td${g.kind === "TUNNEL" ? ' class="dig"' : ""}>${g.kind === "SEARCH" ? `Search ${esc(label(g.target).replace("Cell ", "c"))}` : g.kind === "TUNNEL" ? "Tunnel" : "Spotlight"}</td>`;
    return `<td class="muted">–</td>`;
  };
  return `<main><section class="stack">
    <div class="stamp ${escaped ? "go" : ""}">${escaped ? "Escape" : "Lockdown"}</div>
    <h2>${meR.won ? "You win" : "You lose"}</h2>
    <p>${escaped ? `The inmates reached the wall on night ${r.outcome.night}.` : `Dawn on day ${r.outcome.night}. The tunnel stopped ${r.wall - r.tunnel} metre${r.wall - r.tunnel === 1 ? "" : "s"} short.`}</p>
    <p class="label">Who was who</p>
    <div class="sheet"><dl>${order.map((p) => `<dt>${esc(name(p.id))}</dt><dd>${esc(p.id === HUMAN ? "You" : p.name)}: <b>${roleOf(p)}</b>${p.exposed ? " (outed at the count)" : ""}${p.won ? " · won" : ""}</dd>`).join("")}</dl></div>
    <p class="label">Night by night</p>
    <div class="scroll"><table><thead><tr><th></th>${r.nights.map((n) => `<th>N${n.night}</th>`).join("")}</tr></thead><tbody>
      ${order.map((p) => `<tr><th>${esc(name(p.id))}</th>${r.nights.map((n) => cell(n, p.id)).join("")}</tr>`).join("")}
      <tr><th>Tunnel</th>${r.nights.map((n) => `<td>+${n.gain} → ${n.tunnel}</td>`).join("")}</tr>
    </tbody></table></div>
    ${r.count?.done ? `<p class="note">The count on day ${r.count.day}: ${r.count.target ? `${esc(name(r.count.target))} named, ${r.count.wasRat ? "and they were the Rat" : "and they were innocent"}` : "no verdict"}.</p>` : ""}
    <div class="row"><button class="btn hot" data-go="again">Play again</button><button class="btn ghost" data-go="setup">Change setup</button></div>
  </section></main>`;
}

render();
