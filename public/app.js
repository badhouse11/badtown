// Good Neighbours client. The phone only sends intentions; the server decides everything and
// sends back this player's own filtered view.

import { icon } from "./icons.js";

const $ = (s) => document.querySelector(s);
const app = $("#app");
const bar = $("#bar");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

const SEAT = ["#3d6be0", "#f3c843", "#e2582f", "#7e9c6b", "#a9884f", "#a698d8", "#b3b1ac", "#e7a3a0"];
const AGENDA_COLOUR = { pillar: "#3d6be0", developer: "#b3b1ac", gossip: "#f3c843", chameleon: "#7e9c6b", martyr: "#a698d8", fixer: "#a9884f", snake: "#e2582f", neighbour: "#e7a3a0" };

let session = null;
let ws = null;
let view = null;
let clockOffset = 0;
let retry = 0;
let lastChat = 0;
let timerSpan = { deadline: null, total: 1 };
let reveal = { key: null, shown: 0, timers: [] };
let bribeDraft = { to: null, side: "X" };
let bribeOpen = false;

// ---------------------------------------------------------------------------------------
// Session storage: one seat per room per browser.

const store = {
  get: (c) => { try { return JSON.parse(localStorage.getItem(`gn:${c}`)); } catch { return null; } },
  set: (c, v) => { try { localStorage.setItem(`gn:${c}`, JSON.stringify(v)); } catch {} },
  clear: (c) => { try { localStorage.removeItem(`gn:${c}`); } catch {} },
};

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove("show"), 3000);
}

async function api(path, body) {
  const res = await fetch(path, { method: body ? "POST" : "GET", headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong. Try again.");
  return data;
}

// ---------------------------------------------------------------------------------------
// Connection

function connect() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  ws = new WebSocket(`${proto}://${location.host}/api/rooms/${session.code}/ws`);
  ws.onopen = () => { retry = 0; ws.send(JSON.stringify({ type: "HELLO", token: session.token })); };
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.type === "STATE") { clockOffset = m.serverNow - Date.now(); view = m; render(); }
    else if (m.type === "ACK" && !m.ok) toast(m.error);
    else if (m.type === "ERROR") toast(m.error);
    else if (m.type === "AUTH_FAILED") {
      store.clear(session.code);
      session = null;
      ws.onclose = null;
      ws.close();
      toast("That seat has gone. Join again.");
      home(location.hash.slice(2));
    }
  };
  ws.onclose = () => {
    if (!session) return;
    setTimeout(() => session && connect(), Math.min(8000, 400 * 2 ** retry++));
  };
}

function send(cmd) {
  if (!ws || ws.readyState !== 1) return toast("Reconnecting. Try again in a second.");
  ws.send(JSON.stringify({ type: "CMD", cid: crypto.randomUUID(), cmd }));
}

// ---------------------------------------------------------------------------------------
// Bits

const P = (id) => view.pub.players.find((p) => p.id === id);
const seatColour = (id) => SEAT[Math.max(0, view.pub.players.findIndex((p) => p.id === id)) % SEAT.length];
const initial = (name) => esc([...String(name).trim()][0]?.toUpperCase() ?? "?");
const person = (id, size = "sm") => { const p = P(id); return `<span class="disc ${size} letter" style="--c:${seatColour(id)}">${initial(p?.name)}</span>`; };
const nameOf = (id) => (id === view.me.id ? "You" : esc(P(id)?.name ?? "?"));
const disc = (name, colour, size = "") => `<span class="disc ${size}" style="--c:${colour}">${icon(name)}</span>`;
const others = () => view.pub.players.filter((p) => p.id !== view.me.id);

function moveOn(label) {
  const { pub, me } = view;
  const done = pub.players.find((p) => p.id === me.id)?.movedOn;
  const n = pub.players.filter((p) => p.movedOn).length;
  const live = pub.players.filter((p) => p.connected).length;
  return `<button class="btn wide" data-cmd='{"type":"READY_NEXT"}' ${done ? "disabled" : ""}>${done ? "Waiting for the others" : label}</button>
    <p class="small soft" style="text-align:center;margin-top:8px">${n} of ${live} ready</p>`;
}

// ---------------------------------------------------------------------------------------
// Home

function home(prefill = "") {
  bar.hidden = true;
  $("#chat").hidden = true;
  app.innerHTML = `
    <div class="stack" style="padding-top:28px">
      <div class="row" style="gap:8px">${disc("house", "var(--sun)", "sm")}${disc("help", "var(--help)", "sm")}${disc("harm", "var(--harm)", "sm")}${disc("eye", "var(--ochre)", "sm")}</div>
      <h1 class="display">Good<br>Neighbours</h1>
      <p style="font-size:20px">Help your town, or help yourself. Everyone has a secret. If the town falls, everyone loses.</p>
      <p class="soft">3 to 8 players, one phone each, about 15 minutes.</p>
    </div>
    <hr class="rule">
    <form id="create" class="stack">
      <h2>Start a town</h2>
      <div><label class="field" for="cname">Your name</label><input id="cname" maxlength="16" required autocomplete="nickname"></div>
      <button class="btn wide">Start a town</button>
    </form>
    <hr class="rule">
    <form id="join" class="stack">
      <h2>Join a town</h2>
      <div><label class="field" for="jcode">Town code</label><input id="jcode" maxlength="6" required value="${esc(prefill)}" autocapitalize="characters" style="text-transform:uppercase;letter-spacing:.12em"></div>
      <div><label class="field" for="jname">Your name</label><input id="jname" maxlength="16" required autocomplete="nickname"></div>
      <button class="btn wide ghost">Join</button>
    </form>`;
  $("#create").onsubmit = async (e) => {
    e.preventDefault();
    try { const { code } = await api("/api/rooms", {}); await join(code, $("#cname").value); } catch (err) { toast(err.message); }
  };
  $("#join").onsubmit = async (e) => {
    e.preventDefault();
    try { await join($("#jcode").value.trim().toUpperCase(), $("#jname").value); } catch (err) { toast(err.message); }
  };
}

async function join(code, name) {
  const d = await api(`/api/rooms/${code}/join`, { name });
  session = { code, playerId: d.playerId, token: d.token };
  store.set(code, session);
  location.hash = `#/${code}`;
  connect();
}

// ---------------------------------------------------------------------------------------
// Frame

function render() {
  const kept = {};
  app.querySelectorAll("input[id]").forEach((el) => (kept[el.id] = el.value));
  const focused = document.activeElement?.id;
  if (!view.me) {
    store.clear(session.code);
    session = null;
    return home();
  }
  const screens = { LOBBY: lobby, AGENDA: agenda, TALK: talk, VOTE: vote, RESULT: result, GOSSIP: gossip, ACCUSE: accuse, VERDICT: verdict, END: end };
  renderBar();
  renderChat();
  app.innerHTML = screens[view.pub.phase]();
  wire();
  for (const [id, v] of Object.entries(kept)) { const el = document.getElementById(id); if (el) el.value = v; }
  if (focused) document.getElementById(focused)?.focus();
  if (view.pub.phase === "RESULT") runReveal();
}

function renderBar() {
  const { pub, me } = view;
  const inGame = !["LOBBY", "END"].includes(pub.phase);
  bar.hidden = !inGame;
  if (!inGame) return;
  if (pub.deadline !== timerSpan.deadline) timerSpan = { deadline: pub.deadline, total: Math.max(1, pub.deadline - (Date.now() + clockOffset)) };
  const houses = Array.from({ length: pub.townMax }, (_, i) => icon("house").replace('class="ic"', `class="ic${i < pub.town ? " on" : ""}"`)).join("");
  const a = me.agenda;
  bar.innerHTML = `
    <div class="round">${pub.round || "–"}<span>/${pub.rounds}</span></div>
    <div class="town ${pub.town <= 2 ? "danger" : ""}" role="img" aria-label="Town at ${pub.town} of ${pub.townMax}">${houses}</div>
    <div class="timer" aria-hidden="${pub.deadline ? "false" : "true"}"><svg viewBox="0 0 44 44"><circle class="track" cx="22" cy="22" r="19"/><circle class="left" cx="22" cy="22" r="19" stroke-dasharray="119.4" stroke-dashoffset="0"/></svg><b></b></div>
    <div class="purse" style="grid-column:1/-1">
      <span class="row" style="gap:8px">${a ? `<span class="disc xs" style="--c:${AGENDA_COLOUR[a.key]}">${icon(a.key)}</span><span class="small"><b>${esc(a.name)}</b></span>` : ""}</span>
      <span class="coins">${icon("coin")}<span class="num">${me.coins}</span></span>
    </div>`;
  tick();
}

function tick() {
  const ring = bar.querySelector(".timer .left");
  const label = bar.querySelector(".timer b");
  if (!ring) return;
  if (!view?.pub.deadline) { ring.style.strokeDashoffset = 119.4; label.textContent = ""; return; }
  const left = Math.max(0, view.pub.deadline - (Date.now() + clockOffset));
  ring.style.strokeDashoffset = String(119.4 * (1 - left / timerSpan.total));
  label.textContent = Math.ceil(left / 1000);
}
setInterval(tick, 250);

function renderChat() {
  $("#chat").hidden = false;
  $("#chat-icon").innerHTML = icon("rumour");
  const log = view.pub.chat;
  $("#chat-log").innerHTML = log.map((c) => `<li><b>${esc(c.name)}</b> ${esc(c.text)}</li>`).join("");
  $("#chat-count").textContent = log.length ? String(log.length) : "";
  if (log.length !== lastChat) { $("#chat-log").scrollTop = 1e9; lastChat = log.length; }
}

// ---------------------------------------------------------------------------------------
// Lobby

function lobby() {
  const { pub, me } = view;
  const mine = P(me.id);
  const n = pub.players.length;
  const canStart = me.isHost && n >= pub.rules.minPlayers && pub.players.every((p) => p.ready);
  const link = `${location.origin}/#/${pub.code}`;
  return `<div class="stack">
    <p class="pill">Town code</p>
    <h1 class="display" style="letter-spacing:.04em">${esc(pub.code)}</h1>
    <div class="row"><button class="btn ghost" data-copy="${esc(link)}">Copy invite link</button></div>
  </div>
  <hr class="rule">
  <div class="row between"><h2>Residents</h2><span class="soft num" style="font-size:22px;font-weight:800;font-stretch:70%">${n}/${pub.rules.maxPlayers}</span></div>
  <ul class="people">${pub.players.map((p) => `<li class="${p.connected ? "" : "dot-off"}">${person(p.id)}<span class="grow">${esc(p.name)}${p.id === me.id ? " (you)" : ""}</span><span class="tag">${p.isHost ? "host · " : ""}${p.ready ? "ready" : "not ready"}</span></li>`).join("")}</ul>
  <div class="stack" style="margin-top:22px">
    <button class="btn wide ${mine.ready ? "ghost" : ""}" data-cmd='${JSON.stringify({ type: "READY", ready: !mine.ready })}'>${mine.ready ? "I'm not ready" : "I'm ready"}</button>
    ${me.isHost ? `<button class="btn wide" data-cmd='{"type":"START"}' ${canStart ? "" : "disabled"}>Start the game</button>
      <p class="small soft" style="text-align:center">${n < pub.rules.minPlayers ? `You need at least ${pub.rules.minPlayers} players.` : canStart ? "Everyone's ready." : "Waiting for everyone to be ready."}</p>` : `<p class="small soft" style="text-align:center">The host starts the game when everyone's ready.</p>`}
  </div>
  <hr class="rule">
  ${howTo()}
  <p style="margin-top:20px"><button class="btn ghost" data-cmd='{"type":"LEAVE"}'>Leave town</button></p>`;
}

function howTo() {
  const r = view.pub.rules;
  const step = (ic, colour, text) => `<div class="row" style="align-items:flex-start">${disc(ic, colour, "sm")}<p style="margin:6px 0 0">${text}</p></div>`;
  return `<h2>How to play</h2><div class="stack" style="margin-top:16px">
    ${step("burst", "var(--sun)", "Each round a crisis hits the town. Talk it over.")}
    ${step("help", "var(--help)", `Then everyone secretly backs HELP or HARM. If most help, the town grows and everyone gets ${plural(r.dividend, "coin")}.`)}
    ${step("harm", "var(--harm)", `Backing HARM puts ${r.skim} coins in your pocket, whatever happens. If most harm, the town drops ${r.harmDrop}.`)}
    ${step("ruin", "var(--stone)", "If the town hits zero, everybody loses.")}
    ${step("eye", "var(--ochre)", "Everyone has a secret agenda worth bonus coins at the end.")}
    ${step("bribe", "var(--moss)", `You can secretly bribe someone (${r.bribe} coins) to vote your way. If they accept, their vote is locked.`)}
    ${step("point", "var(--lilac)", `After round ${r.accuseAfter}, everyone hears one true rumour. Then the town points at one person: their agenda is revealed and they sit out a round.`)}
    ${step("crown", "var(--sun)", `Most coins after ${view.pub.rounds} rounds wins.`)}
  </div>`;
}

// ---------------------------------------------------------------------------------------
// Agenda

function agenda() {
  const { pub, me } = view;
  const a = me.agenda;
  return `<div class="secret stack">
    <span class="disc xl" style="--c:${AGENDA_COLOUR[a.key]}">${icon(a.key)}</span>
    <p class="soft">Your secret agenda</p>
    <h2>${esc(a.name)}</h2>
    <p style="font-size:20px">${esc(a.goal)}</p>
    <p class="small soft">${icon("eye").replace('class="ic"', 'class="ic" style="width:16px;height:16px;vertical-align:-3px"')} Only you can see this.</p>
  </div>
  <h3 style="margin:26px 0 4px">The possible agendas</h3><p class="small soft" style="margin-bottom:8px">Everyone has one. Nobody shares yours. Not all of them are in this game.</p>
  <ul class="people">${pub.agendas.map((x) => `<li><span class="disc sm" style="--c:${AGENDA_COLOUR[x.key]}">${icon(x.key)}</span><span class="grow">${esc(x.name)}<br><span class="small soft">${esc(x.goal)}</span></span></li>`).join("")}</ul>
  <div style="margin-top:22px">${moveOn("Got it")}</div>`;
}

// ---------------------------------------------------------------------------------------
// Round

function crisis() {
  const { card, rules } = view.pub;
  return `<div class="hero">
    <span class="disc xl" style="--c:var(--sun)">${icon(card.icon)}</span>
    <h1>${esc(card.title)}</h1>
    <p style="font-size:20px;margin:0">${esc(card.premise)}</p>
  </div>
  <div style="margin-top:20px">
    <div class="choice">${disc("help", "var(--help)")}<div><h3>${esc(card.helpLabel)}</h3><p class="what">Help. If most help: town +${rules.helpUp}, everyone +${rules.dividend}.</p></div></div>
    <div class="choice">${disc("harm", "var(--harm)")}<div><h3>${esc(card.harmLabel)}</h3><p class="what">Harm. You pocket ${rules.skim} coins either way. If most harm: town −${rules.harmDrop}.</p></div></div>
  </div>`;
}

function sittingOutNote() {
  return view.me.sittingOut ? `<div class="offer row">${disc("stocks", "var(--stone)", "sm")}<p style="margin:0"><b>You're in the stocks this round.</b> No vote, no bribes, no dividend. You can still talk.</p></div>` : "";
}

function talk() {
  const { pub, me } = view;
  const incoming = me.bribes.filter((b) => !b.mine);
  const mine = me.bribes.find((b) => b.mine);
  const side = (s) => (s === "H" ? "help" : "harm");
  const targets = others().filter((p) => !p.sittingOut);
  return `${crisis()}
  <div class="stack" style="margin-top:22px">
    ${sittingOutNote()}
    ${incoming.map((b) => `<div class="offer stack">
      <div class="row">${disc("bribe", "var(--moss)", "sm")}<p style="margin:0"><b>${esc(b.fromName)}</b> offers you ${pub.rules.bribe} coins to <b>${side(b.side)}</b>.</p></div>
      ${b.status === "pending" ? `<div class="row"><button class="btn" data-cmd='${JSON.stringify({ type: "RESPOND_BRIBE", id: b.id, accept: true })}'>Take it</button><button class="btn ghost" data-cmd='${JSON.stringify({ type: "RESPOND_BRIBE", id: b.id, accept: false })}'>Refuse</button></div>` : `<p class="small soft" style="margin:0">You ${b.status === "accepted" ? "took it. Your vote is locked." : b.status}.</p>`}
    </div>`).join("")}
    ${me.sittingOut ? "" : mine ? `<div class="offer row">${disc("bribe", "var(--moss)", "sm")}<p style="margin:0">You offered <b>${esc(mine.toName)}</b> ${pub.rules.bribe} coins to ${side(mine.side)}. <span class="soft">${mine.status === "pending" ? "Waiting…" : mine.status === "accepted" ? "Accepted." : "Refused."}</span></p></div>`
      : `<details class="fold offer" ${bribeOpen ? "open" : ""}><summary class="row between"><span class="row">${disc("bribe", "var(--moss)", "sm")}<b>Offer a bribe</b></span><span class="soft small">${pub.rules.bribe} coins</span></summary>
        <div class="stack" style="margin-top:14px">
          <div class="row" style="flex-wrap:wrap;gap:10px">${targets.map((p) => `<button class="target ${bribeDraft.to === p.id ? "chosen" : ""}" style="padding:6px 8px" data-bribe-to="${p.id}">${person(p.id)}<span class="small">${esc(p.name)}</span></button>`).join("")}</div>
          <div class="seg" role="group" aria-label="Side"><button data-bribe-side="H" aria-pressed="${bribeDraft.side === "H"}">To help</button><button data-bribe-side="X" aria-pressed="${bribeDraft.side === "X"}">To harm</button></div>
          <button class="btn wide" data-bribe-send ${bribeDraft.to && targets.some((t) => t.id === bribeDraft.to) && me.coins >= pub.rules.bribe ? "" : "disabled"}>Send secret offer</button>
          ${me.coins < pub.rules.bribe ? `<p class="small soft">You need ${pub.rules.bribe} coins.</p>` : ""}
        </div></details>`}
    ${moveOn("Ready to vote")}
  </div>`;
}

function vote() {
  const { pub, me } = view;
  const c = pub.card;
  let body;
  if (me.sittingOut) body = sittingOutNote();
  else if (me.lockedSide) body = `<div class="offer row">${disc(me.lockedSide === "H" ? "help" : "harm", me.lockedSide === "H" ? "var(--help)" : "var(--harm)", "sm")}<p style="margin:0">You took a bribe. Your vote is locked to <b>${me.lockedSide === "H" ? "help" : "harm"}</b>.</p></div>`;
  else body = `<div class="votes">
      <button class="vote ${me.myVote === "H" ? "chosen" : ""}" data-cmd='{"type":"VOTE","side":"H"}'>${disc("help", "var(--help)")}<span class="label">Help</span><span class="sub">${esc(c.helpLabel)}</span></button>
      <button class="vote ${me.myVote === "X" ? "chosen" : ""}" data-cmd='{"type":"VOTE","side":"X"}'>${disc("harm", "var(--harm)")}<span class="label">Harm</span><span class="sub">${esc(c.harmLabel)} · +${pub.rules.skim} coins</span></button>
    </div>
    <p class="small soft" style="text-align:center;margin-top:14px">${me.myVote ? "Locked in. You can change your mind until everyone's voted." : "Nobody will see your choice until the end."}</p>`;
  return `<div class="stack">
    <div class="row">${disc(c.icon, "var(--sun)", "sm")}<h3>${esc(c.title)}</h3></div>
    <h1>Help or harm?</h1>
    ${body}
    <p class="small soft" style="text-align:center">${pub.votesIn ?? 0} of ${pub.players.filter((p) => !p.sittingOut).length} votes in</p>
  </div>`;
}

function result() {
  const { pub, me } = view;
  const r = pub.result;
  const c = pub.card;
  const headline = r.winner === "H" ? "The town is helped" : r.winner === "X" ? "Harm wins" : r.help + r.harm === 0 ? "Nobody voted" : "Deadlock";
  const story = r.winner === "H" ? c.helpResult : r.winner === "X" ? c.harmResult : "Nobody could agree. Nothing changes.";
  const g = me.gain;
  const gains = [g?.skim ? `+${g.skim} skimmed` : "", g?.dividend ? `+${g.dividend} town dividend` : ""].filter(Boolean).join(", ");
  const delta = r.townAfter - r.townBefore;
  return `<div class="stack">
    <div class="row">${disc(c.icon, "var(--sun)", "sm")}<h3>${esc(c.title)}</h3></div>
    <div class="flips" aria-label="${r.help} helped, ${r.harm} harmed">${r.flips.map((f) => `<div class="flip"><div class="inner"><div class="face back"></div><div class="face front" style="background:${f === "H" ? "var(--help)" : "var(--harm)"}">${icon(f === "H" ? "help" : "harm")}</div></div></div>`).join("")}</div>
    <div class="after stack">
      <p class="num" style="font-size:22px;font-weight:800;font-stretch:70%;margin:0">${r.help} helped · ${r.harm} harmed</p>
      <h1>${headline}</h1>
      <p style="font-size:20px">${esc(story)}</p>
      <div class="row">${disc("house", "var(--sun)", "sm")}<p style="margin:0">Town ${r.townBefore} → <b>${r.townAfter}</b>${delta ? ` (${delta > 0 ? "+" : ""}${delta})` : ""}${r.townAfter <= 0 ? ". <b>The town has collapsed.</b>" : r.townAfter <= 2 ? ". <b>One more bad round could finish it.</b>" : ""}</p></div>
      <div class="row">${disc("coin", "var(--ochre)", "sm")}<p style="margin:0">${gains ? `You: ${gains}.` : "You gained nothing this round."} <span class="soft">Only you see this.</span></p></div>
      ${moveOn(r.townAfter <= 0 ? "See the wreckage" : "Next")}
    </div>
  </div>`;
}

function runReveal() {
  const r = view.pub.result;
  const key = `${view.pub.gameNo}:${view.pub.round}`;
  const flips = [...app.querySelectorAll(".flip")];
  const after = app.querySelector(".after");
  const instant = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reveal.key !== key) {
    reveal.timers.forEach(clearTimeout);
    reveal = { key, shown: instant ? r.flips.length : 0, timers: [] };
    for (let i = 0; i < r.flips.length; i++) {
      reveal.timers.push(setTimeout(() => {
        reveal.shown = i + 1;
        app.querySelectorAll(".flip")[i]?.classList.add("on");
        if (reveal.shown === r.flips.length) setTimeout(() => app.querySelector(".after")?.classList.add("show"), 450);
      }, 700 + i * 650));
    }
    if (r.flips.length === 0) reveal.timers.push(setTimeout(() => app.querySelector(".after")?.classList.add("show"), 300));
  }
  flips.slice(0, reveal.shown).forEach((f) => f.classList.add("on"));
  if (reveal.shown >= r.flips.length && (instant || reveal.shown > 0 || r.flips.length === 0)) after?.classList.add("show");
}

// ---------------------------------------------------------------------------------------
// The accusation

function gossip() {
  const { me } = view;
  const r = me.rumour;
  return `<div class="stack">
    <span class="disc xl" style="--c:var(--lilac)">${icon("rumour")}</span>
    <p class="pill">The grapevine</p>
    <h1>${nameOf(r.subject)} backed harm ${plural(r.count, "time")}.</h1>
    <p style="font-size:20px">It's true. Everyone heard one rumour about someone else. Share it, keep it, or bend it.</p>
    <p class="soft">Next, the town points at one person. Their secret agenda is revealed and they sit out round ${view.pub.accusation.afterRound + 1}.</p>
    ${moveOn("Ready to point")}
  </div>`;
}

function accuse() {
  const { pub, me } = view;
  const chosen = me.myNomination;
  const r = me.rumour;
  return `<div class="stack">
    <h1>Who do you point at?</h1>
    <p class="soft">Your rumour: ${nameOf(r.subject)} backed harm ${plural(r.count, "time")}.</p>
    <div class="targets">${others().map((p) => `<button class="target ${chosen === p.id ? "chosen" : ""}" data-cmd='${JSON.stringify({ type: "NOMINATE", target: p.id })}'>${person(p.id, "")}<span>${esc(p.name)}</span></button>`).join("")}
      <button class="target ${chosen === null ? "chosen" : ""}" data-cmd='{"type":"NOMINATE","target":null}'><span class="disc hollow" style="width:72px"></span><span>Nobody</span></button></div>
    <p class="small soft" style="text-align:center">${pub.accusation.nominationsIn} of ${pub.players.length} have pointed. ${chosen !== undefined ? "You can change your mind until everyone's in." : ""}</p>
  </div>`;
}

function verdict() {
  const { pub, me } = view;
  const id = pub.accusation.accused;
  if (!id) return `<div class="stack"><span class="disc xl hollow"></span><h1>Nobody is accused</h1><p style="font-size:20px">The town couldn't make up its mind. Everyone's secrets stay secret, for now.</p>${moveOn("Back to it")}</div>`;
  const p = P(id);
  const ag = pub.agendas.find((a) => a.key === p.agenda);
  return `<div class="stack">
    ${person(id, "xl")}
    <h1>${id === me.id ? "You're" : `${esc(p.name)} is`} in the stocks</h1>
    <p class="soft">${pub.accusation.pointsAgainst} ${pub.accusation.pointsAgainst === 1 ? "person" : "people"} pointed. ${id === me.id ? "You sit" : "They sit"} out round ${pub.accusation.afterRound + 1}.</p>
    <div class="secret row" style="align-items:flex-start">
      <span class="disc lg" style="--c:${AGENDA_COLOUR[ag.key]}">${icon(ag.key)}</span>
      <div><p class="soft" style="margin:0 0 4px">Their secret agenda</p><h2>${esc(ag.name)}</h2><p style="margin-top:8px">${esc(ag.goal)}</p></div>
    </div>
    ${moveOn("Back to it")}
  </div>`;
}

// ---------------------------------------------------------------------------------------
// End

function end() {
  const { pub, me, reveal: rv } = view;
  const o = rv.outcome;
  const name = (id) => esc(rv.players.find((p) => p.id === id)?.name ?? "?");
  const ranked = [...rv.players].sort((a, b) => o.scores[b.id].total - o.scores[a.id].total);
  const head = o.collapsed
    ? `<span class="disc xl" style="--c:var(--stone)">${icon("ruin")}</span><h1 class="display" style="font-size:clamp(56px,17vw,96px)">The town fell</h1><p style="font-size:20px">Prosperity hit zero. <b>Everybody loses.</b> Here's who did it.</p>`
    : `<span class="disc xl" style="--c:var(--sun)">${icon("crown")}</span><h1 class="display" style="font-size:clamp(56px,17vw,96px)">${o.winners.map(name).join(" & ")} win${o.winners.length > 1 ? "" : "s"}</h1><p style="font-size:20px">The town finished at ${rv.town} of ${pub.townMax}.</p>`;
  return `<div class="stack">${head}</div>
  <hr class="rule">
  <h2>The scores</h2>
  <ul class="scores">${ranked.map((p) => {
    const s = o.scores[p.id];
    return `<li>${person(p.id)}<div><b>${name(p.id)}</b><br><span class="small"><span class="disc xs" style="--c:${AGENDA_COLOUR[p.agenda]};vertical-align:-8px">${icon(p.agenda)}</span> ${esc(p.agendaName)}</span><br><span class="small soft">${s.coins} coins + ${s.bonus} bonus. ${esc(s.bonusReason)}</span></div><span class="total">${s.total}</span></li>`;
  }).join("")}</ul>
  <hr class="rule">
  <h2>Who backed what</h2>
  <div style="overflow-x:auto;margin-top:12px"><table class="grid-votes"><thead><tr><th></th>${rv.rounds.map((r) => `<th>${r.round}</th>`).join("")}<th>Harm</th></tr></thead><tbody>
    ${rv.players.map((p) => `<tr><td>${name(p.id)}</td>${rv.rounds.map((r) => { const v = r.votes[p.id]; return `<td>${r.sittingOut === p.id ? `<span class="vdot out" title="In the stocks"></span>` : v ? `<span class="vdot ${v} ${r.bribeLocked[p.id] ? "locked" : ""}" title="${v === "H" ? "Help" : "Harm"}"></span>` : "–"}</td>`; }).join("")}<td><b>${p.harmVotes}</b></td></tr>`).join("")}
    <tr><td class="soft">Result</td>${rv.rounds.map((r) => `<td>${r.winner ? `<span class="vdot ${r.winner}"></span>` : "–"}</td>`).join("")}<td></td></tr>
  </tbody></table></div>
  <p class="small soft" style="margin-top:8px"><span class="vdot H"></span> help &nbsp; <span class="vdot X"></span> harm &nbsp; <span class="vdot X locked"></span> bribed &nbsp; <span class="vdot out"></span> in the stocks</p>
  <hr class="rule">
  <h2>Bribes</h2>
  ${rv.bribes.length ? `<ul class="people">${rv.bribes.map((b) => `<li>${disc("bribe", "var(--moss)", "sm")}<span class="grow">Round ${b.round}: <b>${name(b.from)}</b> paid <b>${name(b.to)}</b> to ${b.side === "H" ? "help" : "harm"}</span></li>`).join("")}</ul>` : `<p class="soft" style="margin-top:8px">Nobody took a bribe. Allegedly.</p>`}
  ${rv.accusation ? `<hr class="rule"><h2>The accusation</h2><ul class="people">${Object.entries(rv.accusation.nominations).map(([a, b]) => `<li>${person(a, "sm")}<span class="grow"><b>${name(a)}</b> pointed at ${b ? `<b>${name(b)}</b>` : "nobody"}</span></li>`).join("")}</ul>` : ""}
  <div style="margin-top:28px">${me.isHost || !pub.players.find((p) => p.isHost)?.connected ? `<button class="btn wide" data-cmd='{"type":"REMATCH"}'>Play again</button>` : `<p class="soft" style="text-align:center">Waiting for the host to start another game.</p>`}</div>`;
}

// ---------------------------------------------------------------------------------------
// Wiring

function wire() {
  app.querySelectorAll("[data-cmd]").forEach((b) => (b.onclick = () => send(JSON.parse(b.dataset.cmd))));
  app.querySelectorAll("[data-copy]").forEach((b) => (b.onclick = async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); toast("Invite link copied."); } catch { toast(b.dataset.copy); }
  }));
  const fold = app.querySelector("details.fold");
  if (fold) fold.ontoggle = () => (bribeOpen = fold.open);
  app.querySelectorAll("[data-bribe-to]").forEach((b) => (b.onclick = () => { bribeDraft.to = b.dataset.bribeTo; render(); }));
  app.querySelectorAll("[data-bribe-side]").forEach((b) => (b.onclick = () => { bribeDraft.side = b.dataset.bribeSide; render(); }));
  const sendBribe = app.querySelector("[data-bribe-send]");
  if (sendBribe) sendBribe.onclick = () => { send({ type: "OFFER_BRIBE", to: bribeDraft.to, side: bribeDraft.side }); bribeDraft = { to: null, side: "X" }; bribeOpen = false; };
}

$("#chat-form").onsubmit = (e) => {
  e.preventDefault();
  const input = $("#chat-input");
  if (!input.value.trim()) return;
  send({ type: "CHAT", text: input.value });
  input.value = "";
};

function boot() {
  const code = (location.hash.match(/^#\/([A-Za-z0-9]{6})$/)?.[1] ?? "").toUpperCase();
  if (ws) { ws.onclose = null; ws.close(); ws = null; }
  session = code ? store.get(code) : null;
  if (session) connect();
  else home(code);
}
window.addEventListener("hashchange", () => {
  const code = location.hash.slice(2).toUpperCase();
  if (!session || session.code !== code) boot();
});
boot();
