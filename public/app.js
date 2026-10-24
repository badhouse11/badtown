// GOOD NEIGHBOURS: functional placeholder client.
// The phone only ever sends intentions ("I vote HELP"). The server decides everything and
// sends back this player's own filtered view.

const $ = (sel) => document.querySelector(sel);
const app = $("#app");
const bar = $("#bar");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const signed = (n) => (n > 0 ? `+${n}` : `${n}`);
const coins = (n) => `${n} coin${Math.abs(n) === 1 ? "" : "s"}`;
const titleCase = (s) => (s ? s[0] + s.slice(1).toLowerCase() : "");

let session = null; // { code, playerId, token }
let ws = null;
let view = null; // { pub, me, reveal }
let clockOffset = 0;
let retry = 0;
let lastChatCount = 0;

// ---------------------------------------------------------------------------------------
// Sessions are stored per room code so a refresh or a dropped connection rejoins your seat.

const store = {
  get: (code) => {
    try { return JSON.parse(localStorage.getItem(`gn:${code}`)); } catch { return null; }
  },
  set: (code, v) => {
    try { localStorage.setItem(`gn:${code}`, JSON.stringify(v)); } catch { /* private mode */ }
  },
  clear: (code) => {
    try { localStorage.removeItem(`gn:${code}`); } catch { /* ignore */ }
  },
};

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove("show"), 3200);
}

async function api(path, body) {
  const res = await fetch(path, { method: body ? "POST" : "GET", headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

// ---------------------------------------------------------------------------------------
// Connection

function connect() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  ws = new WebSocket(`${proto}://${location.host}/api/rooms/${session.code}/ws`);
  ws.onopen = () => {
    retry = 0;
    ws.send(JSON.stringify({ type: "HELLO", token: session.token }));
  };
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === "STATE") {
      clockOffset = msg.serverNow - Date.now();
      view = msg;
      render();
    } else if (msg.type === "ACK" && !msg.ok) {
      toast(msg.error);
    } else if (msg.type === "AUTH_FAILED") {
      store.clear(session.code);
      toast(msg.error);
      session = null;
      ws.onclose = null;
      ws.close();
      renderHome(location.hash.slice(2));
    } else if (msg.type === "ERROR") {
      toast(msg.error);
    }
  };
  ws.onclose = () => {
    if (!session) return;
    const wait = Math.min(8000, 500 * 2 ** retry++);
    bar.dataset.offline = "1";
    setTimeout(() => session && connect(), wait);
  };
}

function send(cmd) {
  if (!ws || ws.readyState !== 1) return toast("Reconnecting… try again in a second.");
  ws.send(JSON.stringify({ type: "CMD", cid: crypto.randomUUID(), cmd }));
}
window.gn = { send }; // handy in the console during testing

// ---------------------------------------------------------------------------------------
// Home: create or join

function renderHome(prefill = "") {
  bar.hidden = true;
  $("#chat").hidden = true;
  app.innerHTML = `
    <h1>Good Neighbours</h1>
    <p class="muted">Prototype. Four to eight players, one phone each.</p>
    <div class="panel">
      <h2>Start a new town</h2>
      <form id="create">
        <label for="cname">Your name</label>
        <input id="cname" maxlength="20" required autocomplete="nickname">
        <p><button>Create room</button></p>
      </form>
    </div>
    <div class="panel">
      <h2>Join a town</h2>
      <form id="join">
        <label for="jcode">Room code</label>
        <input id="jcode" maxlength="6" required value="${esc(prefill)}" autocapitalize="characters" style="text-transform:uppercase">
        <label for="jname">Your name</label>
        <input id="jname" maxlength="20" required autocomplete="nickname">
        <p><button>Join</button></p>
      </form>
    </div>`;
  $("#create").onsubmit = async (e) => {
    e.preventDefault();
    try {
      const { code } = await api("/api/rooms", {});
      await joinRoom(code, $("#cname").value);
    } catch (err) { toast(err.message); }
  };
  $("#join").onsubmit = async (e) => {
    e.preventDefault();
    try { await joinRoom($("#jcode").value.trim().toUpperCase(), $("#jname").value); } catch (err) { toast(err.message); }
  };
}

async function joinRoom(code, name) {
  const data = await api(`/api/rooms/${code}/join`, { name });
  session = { code, playerId: data.playerId, token: data.token };
  store.set(code, session);
  location.hash = `#/${code}`;
  connect();
}

// ---------------------------------------------------------------------------------------
// Game rendering

const P = (id) => view.pub.players.find((p) => p.id === id);
const who = (id) => {
  const p = P(id);
  if (!p) return "?";
  const me = id === view.me.id ? " (you)" : "";
  return `${esc(p.name)}${p.profession ? ` the ${titleCase(p.profession)}` : ""}${me}`;
};
const fill = (text, card) => esc(text).replaceAll("{P}", `<b>${who(card.primary)}</b>`).replaceAll("{S}", `<b>${who(card.secondary)}</b>`);
const others = () => view.pub.players.filter((p) => p.id !== view.me.id);
const options = (list, blank) => (blank ? `<option value="">${blank}</option>` : "") + list.map((p) => `<option value="${p.id}">${esc(p.name)}${p.profession ? ` (${titleCase(p.profession)})` : ""}</option>`).join("");

function render() {
  // Keep anything the player is halfway through typing or choosing.
  const kept = {};
  app.querySelectorAll("input[id], select[id]").forEach((el) => (kept[el.id] = el.value));
  const focused = document.activeElement?.id;

  const { pub, me } = view;
  if (!me) {
    store.clear(session.code);
    session = null;
    return renderHome();
  }
  renderBar();
  renderChat();
  const phase = pub.phase;
  const screens = { LOBBY: lobby, NEGOTIATE: negotiate, VOTE: vote, RECAP: recap, PLANT: plant, DISCUSS: discuss, NOMINATE: nominate, LOCKUP: lockup, REVEAL: reveal };
  app.innerHTML = screens[phase]();
  wire();

  Object.entries(kept).forEach(([id, v]) => {
    const el = document.getElementById(id);
    if (!el || el.readOnly) return;
    if (el.tagName === "INPUT" || [...el.options].some((o) => o.value === v)) el.value = v;
  });
  if (focused) document.getElementById(focused)?.focus();
}

function renderBar() {
  const { pub, me } = view;
  bar.hidden = false;
  delete bar.dataset.offline;
  const pros = pub.prosperity;
  bar.innerHTML = `
    <span>Room <b>${esc(pub.code)}</b></span>
    ${pub.phase !== "LOBBY" && pub.phase !== "REVEAL" ? `<span>Round <b>${pub.round}/${pub.rounds}</b></span>
    <span>Prosperity <b>${pros}/${pub.maxProsperity}</b> <span class="meter" aria-hidden="true"><i style="width:${(pros / pub.maxProsperity) * 100}%"></i></span></span>
    <span>Your coins <b>${me.wallet}</b></span>` : ""}
    <span id="timer"></span>`;
}

function renderChat() {
  $("#chat").hidden = false;
  const log = view.pub.chat;
  $("#chat-log").innerHTML = log.map((c) => `<li><b>${esc(c.name)}:</b> ${esc(c.text)}</li>`).join("");
  $("#chat-count").textContent = log.length ? `(${log.length})` : "";
  if (log.length !== lastChatCount) {
    $("#chat-log").scrollTop = 1e9;
    lastChatCount = log.length;
  }
}

function tick() {
  const el = $("#timer");
  if (!el || !view?.pub.deadline) return el && (el.textContent = "");
  const left = Math.max(0, Math.ceil((view.pub.deadline - (Date.now() + clockOffset)) / 1000));
  el.textContent = `${left}s`;
}
setInterval(tick, 250);

function moveOnButton(label = "Continue") {
  const { pub, me } = view;
  const done = pub.players.find((p) => p.id === me.id)?.movedOn;
  const n = pub.players.filter((p) => p.movedOn).length;
  const live = pub.players.filter((p) => p.connected).length;
  return `<p><button data-cmd='{"type":"READY_NEXT"}' ${done ? "disabled" : ""}>${done ? "Waiting for the others…" : label}</button>
    <span class="muted small">${n}/${live} ready</span></p>`;
}

function playerList(extra = () => "") {
  return `<ul class="plain">${view.pub.players.map((p) => `<li><span>${who(p.id)}${p.isHost ? " · host" : ""}</span><span class="muted small">${p.connected ? "" : "offline "}${extra(p)}</span></li>`).join("")}</ul>`;
}

// ----- LOBBY

function lobby() {
  const { pub, me } = view;
  const mine = pub.players.find((p) => p.id === me.id);
  const n = pub.players.length;
  const allReady = pub.players.every((p) => p.ready);
  const link = `${location.origin}/#/${pub.code}`;
  return `
    <h1>Room ${esc(pub.code)}</h1>
    <div class="panel">
      <p>Share this code or link: <b>${esc(pub.code)}</b></p>
      <p class="row"><input id="share" readonly value="${esc(link)}" style="flex:1"><button class="secondary" data-copy="${esc(link)}">Copy</button></p>
    </div>
    <h2>Residents (${n}/${pub.rules.maxPlayers})</h2>
    ${playerList((p) => (p.ready ? "ready" : "not ready"))}
    <p class="row">
      <button data-cmd='${JSON.stringify({ type: "READY", ready: !mine.ready })}'>${mine.ready ? "Not ready" : "I'm ready"}</button>
      ${me.isHost ? `<button data-cmd='{"type":"START"}' ${n >= pub.rules.minPlayers && allReady ? "" : "disabled"}>Start game</button>` : ""}
      <button class="secondary" data-cmd='{"type":"LEAVE"}'>Leave</button>
    </p>
    ${me.isHost ? `<p class="muted small">You can start once ${pub.rules.minPlayers} to ${pub.rules.maxPlayers} players are in and everyone is ready.</p>` : ""}
    ${rulesPanel()}`;
}

function rulesPanel() {
  const r = view.pub.rules;
  return `<details class="panel"><summary><b>How it works</b></summary>
    <p>Each round a crisis hits town. Everyone secretly backs a side, HELP or HARM, staking ${coins(r.stake)}. The side with more backers wins and splits the losers' stakes.</p>
    <p>Backing HARM pays you <b>${coins(r.skim)}</b> whether it wins or not. HELP wins push prosperity up and pay everyone a ${r.dividend}-coin dividend. HARM wins push it down.</p>
    <p><b>If prosperity hits 0, the town collapses and everybody loses.</b> Otherwise the richest resident after the final round wins.</p>
    <p>Ties go to HELP if prosperity is ${r.tieHelpAt} or more, otherwise HARM.</p>
    <p>You can secretly bribe (${r.bribeMin} to ${r.bribeMax} coins, locks their vote) and lend (${r.loanSizes.join(" or ")} coins, repaid with ${r.loanInterest} interest at the end).</p>
    <p>After round ${r.meetingAfterRound} the town meets. Everyone hears one rumour, then the town locks someone in the stocks for a round.</p>
    <p>Nobody sees who did what until the very end.</p></details>`;
}

// ----- ROUND

function cardPanel() {
  const { pub } = view;
  const c = pub.card;
  const e = c.effects;
  const line = (eff) => [eff.p ? `${who(c.primary)} ${signed(eff.p)}` : "", eff.s ? `${who(c.secondary)} ${signed(eff.s)}` : ""].filter(Boolean).join(", ") || "nobody personally";
  return `<div class="panel">
    <p class="muted small">Round ${pub.round} · ${titleCase(c.category)}</p>
    <h2>${esc(c.title)}</h2>
    <p>${fill(c.premise, c)}</p>
    <div class="grid2">
      <div><h3 class="good">HELP: ${esc(c.helpLabel)}</h3>
        <p class="small">${fill(c.helpResult, c)}</p>
        <p class="small">Prosperity +1, everyone gets a ${pub.rules.dividend}-coin dividend. Personal: ${line(e.help)}.</p></div>
      <div><h3 class="bad">HARM: ${esc(c.harmLabel)}</h3>
        <p class="small">${fill(c.harmResult, c)}</p>
        <p class="small">Prosperity −1, no dividend. Personal: ${line(e.harm)}.</p></div>
    </div>
    <p class="muted small">Stake ${coins(pub.rules.stake)}. HARM backers skim ${coins(pub.rules.skim)} either way. Tie goes to ${pub.prosperity >= pub.rules.tieHelpAt ? "HELP" : "HARM"} at prosperity ${pub.prosperity}.</p>
  </div>`;
}

function stocksNotice() {
  return view.me.inStocks ? `<div class="panel"><b>You're in the stocks this round.</b> No vote, no bribes, no dividend. You can still talk, lend and borrow.</div>` : "";
}

function negotiate() {
  const { pub, me } = view;
  const incomingBribes = me.bribes.filter((b) => !b.mine);
  const myBribe = me.bribes.find((b) => b.mine);
  const loansIn = me.loans.filter((l) => l.current && l.borrower === me.id);
  const myLoan = me.loans.find((l) => l.current && l.lender === me.id);
  const targets = others().filter((p) => !p.inStocks);
  const r = pub.rules;
  const side = (s) => (s === "H" ? "HELP" : "HARM");
  return `
    ${cardPanel()}
    ${stocksNotice()}
    <h2>Negotiate</h2>
    <p class="muted small">Talk it out. Everything below is private.</p>

    ${incomingBribes.map((b) => `<div class="panel"><p><b>${esc(b.fromName)}</b> offers you <b>${coins(b.amount)}</b> to back <b>${side(b.side)}</b>. ${b.status === "pending" ? "" : `<i>(${b.status})</i>`}</p>
      ${b.status === "pending" ? `<p class="row"><button data-cmd='${JSON.stringify({ type: "RESPOND_BRIBE", id: b.id, accept: true })}'>Take the money</button><button class="secondary" data-cmd='${JSON.stringify({ type: "RESPOND_BRIBE", id: b.id, accept: false })}'>Refuse</button></p>` : ""}</div>`).join("")}

    ${loansIn.map((l) => `<div class="panel"><p><b>${esc(l.lenderName)}</b> offers you a loan of <b>${coins(l.amount)}</b> (you'll owe ${l.owed} at the end). ${l.status === "pending" ? "" : `<i>(${l.status})</i>`}</p>
      ${l.status === "pending" ? `<p class="row"><button data-cmd='${JSON.stringify({ type: "RESPOND_LOAN", id: l.id, accept: true })}'>Accept</button><button class="secondary" data-cmd='${JSON.stringify({ type: "RESPOND_LOAN", id: l.id, accept: false })}'>Decline</button></p>` : ""}</div>`).join("")}

    ${me.inStocks ? "" : `<details class="panel" ${myBribe ? "open" : ""}><summary><b>Offer a bribe</b></summary>
      ${myBribe ? `<p>You offered <b>${esc(myBribe.toName)}</b> ${coins(myBribe.amount)} to back ${side(myBribe.side)}: <i>${myBribe.status}</i>.</p>` : `
      <form data-form="bribe">
        <label for="b-to">Who</label><select id="b-to" required>${options(targets, "Choose…")}</select>
        <label for="b-side">To back</label><select id="b-side"><option value="H">HELP</option><option value="X">HARM</option></select>
        <label for="b-amt">Coins</label><select id="b-amt">${Array.from({ length: r.bribeMax - r.bribeMin + 1 }, (_, i) => r.bribeMin + i).map((n) => `<option>${n}</option>`).join("")}</select>
        <p><button>Send offer</button></p>
        <p class="muted small">If they accept, the coins move straight away and their vote is locked.</p>
      </form>`}</details>`}

    <details class="panel" ${myLoan ? "open" : ""}><summary><b>Offer a loan</b></summary>
      ${myLoan ? `<p>You offered <b>${esc(myLoan.borrowerName)}</b> a loan of ${coins(myLoan.amount)}: <i>${myLoan.status}</i>.</p>` : `
      <form data-form="loan">
        <label for="l-to">Who</label><select id="l-to" required>${options(others(), "Choose…")}</select>
        <label for="l-amt">Coins</label><select id="l-amt">${r.loanSizes.map((n) => `<option>${n}</option>`).join("")}</select>
        <p><button>Offer loan</button></p>
        <p class="muted small">Repaid automatically at the end with ${r.loanInterest} interest, if they can afford it.</p>
      </form>`}</details>

    ${debtsPanel()}
    ${moveOnButton("Done talking")}
    ${historyPanel()}`;
}

function debtsPanel() {
  const { me } = view;
  const owe = me.loans.filter((l) => l.status === "accepted" && l.borrower === me.id);
  const owed = me.loans.filter((l) => l.status === "accepted" && l.lender === me.id);
  if (!owe.length && !owed.length) return "";
  return `<div class="panel small"><b>Your loans</b>
    ${owe.map((l) => `<p>You owe ${esc(l.lenderName)} ${coins(l.owed)} at the end.</p>`).join("")}
    ${owed.map((l) => `<p>${esc(l.borrowerName)} owes you ${coins(l.owed)} at the end.</p>`).join("")}</div>`;
}

function vote() {
  const { pub, me } = view;
  const c = pub.card;
  let body;
  if (me.inStocks) body = stocksNotice();
  else if (me.broke) body = `<div class="panel"><b>You can't afford the stake this round.</b> You'll sit this one out. A loan or a dividend can get you back in.</div>`;
  else if (me.lockedSide) body = `<div class="panel"><p>You took a deal. Your vote is locked to <b>${me.lockedSide === "H" ? "HELP" : "HARM"}</b>.</p></div>`;
  else
    body = `<div class="grid2">
      <button class="big ${me.myVote === "H" ? "chosen" : ""}" data-cmd='{"type":"VOTE","side":"H"}'>HELP<br><span class="small">${esc(c.helpLabel)}</span></button>
      <button class="big ${me.myVote === "X" ? "chosen" : ""}" data-cmd='{"type":"VOTE","side":"X"}'>HARM<br><span class="small">${esc(c.harmLabel)}</span></button>
    </div>
    <p class="muted small">${me.myVote ? `You're backing ${me.myVote === "H" ? "HELP" : "HARM"}. You can change your mind until the timer ends.` : `Nothing chosen yet. If the timer runs out you sit this round out.`}</p>`;
  return `${cardPanel()}<h2>Secret vote</h2>${body}`;
}

function recap() {
  const { pub, me } = view;
  const last = pub.history[pub.history.length - 1];
  const c = pub.card;
  const st = me.settlement;
  let head;
  if (!last || last.winner === null) head = `<h2>Nobody voted</h2><p>The crisis passes without a decision.</p>`;
  else
    head = `<h2>${last.winner === "H" ? `HELP wins` : `HARM wins`}</h2>
      <p><b>HELP ${last.help} · HARM ${last.harm}</b>${last.tieBroken ? " (tie, decided by prosperity)" : ""}</p>
      <p>${fill(last.winner === "H" ? c.helpResult : c.harmResult, c)}</p>
      <p>Prosperity ${last.prosperityBefore} → <b>${last.prosperityAfter}</b></p>`;
  const lines = st
    ? [
        st.stake ? `Stake −${st.stake}` : "",
        st.payout ? `Winnings back +${st.payout}` : "",
        st.skim ? `Skim +${st.skim}` : "",
        st.dividend ? `Dividend +${st.dividend}` : "",
        st.card ? `Event ${signed(st.card)}` : "",
        st.shortfall ? `(${st.shortfall} more you couldn't pay)` : "",
      ].filter(Boolean)
    : [];
  return `<div class="panel">${head}</div>
    <div class="panel"><h3>Your round (private)</h3>
      ${lines.length ? `<p>${lines.join(" · ")}</p><p><b>Net ${signed(st.net)}</b> · now ${coins(me.wallet)}</p>` : `<p>No change. You have ${coins(me.wallet)}.</p>`}</div>
    ${moveOnButton()}
    ${historyPanel()}`;
}

function historyPanel() {
  const h = view.pub.history;
  if (!h.length) return "";
  return `<details class="panel small"><summary>Town record</summary><ul class="plain">${h
    .map((r) => `<li><span>${r.round}. ${esc(r.title)}</span><span>${r.winner === null ? "no vote" : `${r.winner === "H" ? "HELP" : "HARM"} ${r.help}–${r.harm}`} · ${r.prosperityBefore}→${r.prosperityAfter}</span></li>`)
    .join("")}</ul></details>`;
}

// ----- TOWN MEETING

function plant() {
  const { pub, me } = view;
  const r = pub.rules;
  return `<h1>Town Meeting</h1>
    <div class="panel"><p>The town gathers. Before the gossip starts, anyone who has backed HARM may pay ${coins(r.plantCost)} to plant a fake rumour about someone. A planted rumour replaces somebody's real one and looks exactly the same.</p>
    <p class="muted small">Everyone sees this screen, whether or not they can plant.</p></div>
    ${me.canPlant ? `<div class="panel"><h3>Plant a rumour (private)</h3><form data-form="plant">
      <label for="pl-to">About</label><select id="pl-to" required>${options(others(), "Choose…")}</select>
      <label for="pl-n">Times they backed HARM (rounds 1–${pub.meeting.afterRound})</label><select id="pl-n">${Array.from({ length: pub.meeting.afterRound + 1 }, (_, i) => `<option>${i}</option>`).join("")}</select>
      <p><button>Plant it (${coins(r.plantCost)})</button></p></form></div>` : ""}
    ${me.myPlant ? `<div class="panel">You planted: <b>${who(me.myPlant.target)}</b> backed HARM ${me.myPlant.count} times.</div>` : ""}
    ${moveOnButton()}`;
}

function rumourPanel() {
  const r = view.me.rumour;
  if (!r) return "";
  return `<div class="panel"><h3>The rumour you heard (private)</h3>
    <p><b>${who(r.subject)}</b> backed HARM <b>${r.count}</b> time${r.count === 1 ? "" : "s"} in rounds 1–${view.pub.meeting.afterRound}.</p>
    <p class="muted small">It might be true. It might have been planted. Share it, keep it, or twist it.</p></div>`;
}

function discuss() {
  return `<h1>Town Meeting</h1>${rumourPanel()}<p>Talk it through. Next, everyone secretly nominates one resident for the stocks.</p>${moveOnButton("Ready to nominate")}`;
}

function nominate() {
  const { pub, me } = view;
  const chosen = me.myNomination;
  return `<h1>Town Meeting</h1>${rumourPanel()}
    <h2>Who goes in the stocks?</h2>
    <p class="muted small">Most nominations goes in for round ${pub.meeting.afterRound + 1}: no vote, no skim, no dividend. If they were skimming, they quietly pay a fine. If they weren't, they get compensation. Only they find out which.</p>
    <div class="grid2">${others().map((p) => `<button class="${chosen === p.id ? "chosen" : "secondary"}" data-cmd='${JSON.stringify({ type: "NOMINATE", target: p.id })}'>${esc(p.name)}</button>`).join("")}
    <button class="${chosen === null ? "chosen" : "secondary"}" data-cmd='{"type":"NOMINATE","target":null}'>Nobody</button></div>
    <p class="muted small">${chosen !== undefined ? "Nomination in. You can change it until everyone's done." : ""} ${pub.meeting.nominationsIn}/${pub.players.length} in.</p>`;
}

function lockup() {
  const { pub, me } = view;
  const m = pub.meeting;
  const a = me.audit;
  return `<h1>Town Meeting</h1>
    <div class="panel">${m.lockedUp ? `<h2>${who(m.lockedUp)} goes in the stocks</h2><p>${m.nominationsAgainst} nomination${m.nominationsAgainst === 1 ? "" : "s"}. ${m.lockedUp === me.id ? "You sit" : "They sit"} out round ${m.afterRound + 1}.</p>` : `<h2>Nobody goes in the stocks</h2>`}</div>
    ${a ? `<div class="panel"><h3>Your audit (private)</h3>${a.caught ? `<p>They checked your last votes. You backed HARM ${a.harmCount} times. You quietly pay a fine of <b>${coins(a.amount)}</b>.</p>` : `<p>They checked your last votes and found nothing. You get <b>${coins(a.amount)}</b> compensation.</p>`}<p class="muted small">Nobody else knows which. Say what you like.</p></div>` : ""}
    ${moveOnButton()}`;
}

// ----- REVEAL

function reveal() {
  const { pub, me, reveal: rv } = view;
  const name = (id) => esc(rv.players.find((p) => p.id === id)?.name ?? "?");
  const o = rv.outcome;
  const ranked = [...rv.players].sort((a, b) => b.wallet - a.wallet);
  const side = (s) => (s === "H" ? `<span class="good">HELP</span>` : s === "X" ? `<span class="bad">HARM</span>` : `<span class="muted">–</span>`);
  const head = o.collapsed
    ? `<h1>The town collapsed</h1><p>Prosperity hit zero. <b>Everybody loses.</b></p><p>Richest in the ruins: <b>${ranked.length ? name(ranked[0].id) : "?"}</b>, for all the good it did them.</p>`
    : `<h1>${o.winners.length > 1 ? "Joint winners" : "Richest resident"}: ${o.winners.map(name).join(" & ")}</h1><p>The town finished at prosperity ${rv.finalProsperity}.</p>`;
  const m = rv.meeting;
  return `${head}
    <div class="panel"><h2>Final wallets</h2><ul class="plain">${ranked.map((p) => `<li><span>${name(p.id)} <span class="muted small">${titleCase(p.profession)}</span></span><b>${p.wallet}</b></li>`).join("")}</ul></div>
    ${rv.awards.length ? `<div class="panel"><h2>Town awards</h2><p class="muted small">Playful labels, not moral judgements.</p><ul class="plain">${rv.awards.map((a) => `<li><span><b>${esc(a.title)}</b><br><span class="muted small">${esc(a.blurb)}</span></span><span>${a.winners.map(name).join(", ")}</span></li>`).join("")}</ul></div>` : ""}
    <div class="panel scroll"><h2>Who backed what</h2><table><thead><tr><th>Round</th>${rv.players.map((p) => `<th>${name(p.id)}</th>`).join("")}<th>Result</th></tr></thead><tbody>
      ${rv.rounds.map((r) => `<tr><td>${r.round}. ${esc(r.card.title)}</td>${rv.players.map((p) => `<td>${r.lockedUp === p.id ? "stocks" : side(r.votes[p.id])}${r.bribeLocked[p.id] ? "*" : ""}</td>`).join("")}<td>${r.result?.winner ? side(r.result.winner) : "–"}</td></tr>`).join("")}
    </tbody></table><p class="muted small">* vote locked by a bribe</p></div>
    <div class="panel"><h2>Bribes</h2>${rv.bribes.length ? `<ul class="plain">${rv.bribes.map((b) => `<li><span>Round ${b.round}: ${name(b.from)} offered ${name(b.to)} ${coins(b.amount)} to back ${b.side === "H" ? "HELP" : "HARM"}</span><span>${b.status}</span></li>`).join("")}</ul>` : `<p class="muted">None. Suspiciously clean.</p>`}</div>
    <div class="panel"><h2>Loans</h2>${rv.loans.length ? `<ul class="plain">${rv.loans.map((l) => `<li><span>${name(l.lender)} lent ${name(l.borrower)} ${coins(l.amount)}</span><span>repaid ${l.repaid}/${l.owed}</span></li>`).join("")}</ul>` : `<p class="muted">None.</p>`}</div>
    ${m ? `<div class="panel"><h2>The Town Meeting</h2>
      <ul class="plain">${Object.entries(m.rumours).map(([h, r]) => { const fake = m.plants.find((p) => p.recipient === h); return `<li><span>${name(h)} heard: ${name(r.subject)} backed HARM ${r.count}×</span><span>${fake ? `<b>planted by ${name(fake.planter)}</b>` : "true"}</span></li>`; }).join("")}</ul>
      <p>Nominations: ${Object.entries(m.nominations).map(([a, b]) => `${name(a)} → ${b ? name(b) : "nobody"}`).join(" · ") || "none"}</p>
      <p>${m.lockedUp ? `${name(m.lockedUp)} went in the stocks and was ${m.audit.caught ? `<b>caught</b>, paying ${coins(m.audit.amount)}` : `<b>innocent</b>, receiving ${coins(m.audit.amount)}`}.` : "Nobody went in the stocks."}</p></div>` : ""}
    <div class="panel scroll"><h2>The numbers</h2><table><thead><tr><th></th><th>HELP</th><th>HARM</th><th>Skimmed</th><th>Pot</th><th>Events</th><th>Dividends</th></tr></thead><tbody>
      ${rv.players.map((p) => `<tr><td>${name(p.id)}</td><td>${p.stats.helpVotes}</td><td>${p.stats.harmVotes}</td><td>${p.stats.skimmed}</td><td>${signed(p.stats.potWinnings)}</td><td>${signed(p.stats.cardNet)}</td><td>${p.stats.dividends}</td></tr>`).join("")}
    </tbody></table></div>
    ${me.isHost || !pub.players.find((p) => p.isHost)?.connected ? `<p><button data-cmd='{"type":"REMATCH"}'>Rematch (back to the lobby)</button></p>` : `<p class="muted">Waiting for the host to start a rematch.</p>`}`;
}

// ---------------------------------------------------------------------------------------
// Wiring

function wire() {
  app.querySelectorAll("[data-cmd]").forEach((b) => (b.onclick = () => send(JSON.parse(b.dataset.cmd))));
  app.querySelectorAll("[data-copy]").forEach((b) => (b.onclick = () => navigator.clipboard?.writeText(b.dataset.copy).then(() => toast("Link copied."))));
  const forms = {
    bribe: () => ({ type: "OFFER_BRIBE", to: $("#b-to").value, side: $("#b-side").value, amount: Number($("#b-amt").value) }),
    loan: () => ({ type: "OFFER_LOAN", to: $("#l-to").value, amount: Number($("#l-amt").value) }),
    plant: () => ({ type: "PLANT", target: $("#pl-to").value, count: Number($("#pl-n").value) }),
  };
  app.querySelectorAll("form[data-form]").forEach((f) => {
    f.onsubmit = (e) => {
      e.preventDefault();
      send(forms[f.dataset.form]());
    };
  });
}

$("#chat-form").onsubmit = (e) => {
  e.preventDefault();
  const input = $("#chat-input");
  if (!input.value.trim()) return;
  send({ type: "CHAT", text: input.value });
  input.value = "";
};

// ---------------------------------------------------------------------------------------
// Boot

function boot() {
  const code = (location.hash.match(/^#\/([A-Za-z0-9]{6})$/)?.[1] ?? "").toUpperCase();
  if (ws) {
    ws.onclose = null;
    ws.close();
    ws = null;
  }
  session = code ? store.get(code) : null;
  if (session) connect();
  else renderHome(code);
}
window.addEventListener("hashchange", () => {
  const code = location.hash.slice(2).toUpperCase();
  if (!session || session.code !== code) boot();
});
boot();
