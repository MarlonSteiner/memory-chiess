const COLORS = [
  { id: 'rose',   name: 'pink',   face: 'smile',  edge: '#ee5f8c', fill: '#ff9dbb', light: '#ffc6d8' },
  { id: 'butter', name: 'yellow', face: 'joy',    edge: '#efb02e', fill: '#ffdb73', light: '#ffeeb0' },
  { id: 'mint',   name: 'green',  face: 'wink',   edge: '#5fb981', fill: '#a4e0b5', light: '#d0f0d9' },
  { id: 'sky',    name: 'blue',   face: 'ooh',    edge: '#5aa5e0', fill: '#a3d3f6', light: '#d2eafb' },
  { id: 'lilac',  name: 'purple', face: 'tongue', edge: '#9574e0', fill: '#cbb3f4', light: '#e6dbfb' },
];
const BLACK = { id: 'black', name: 'black', edge: '#231c20', fill: '#3a3136', light: '#4b4046' };
const BUDDIES = [
  { shape: 'flower', face: 'smile',  edge: '#f58fb0', fill: '#ffc4d6', light: '#ffe0ea' },
  { shape: 'star',   face: 'joy',    edge: '#f2bd45', fill: '#ffe08a', light: '#fff0bd' },
  { shape: 'cloud',  face: 'wink',   edge: '#7db8e6', fill: '#bfe0f8', light: '#e0f0fc' },
  { shape: 'clover', face: 'ooh',    edge: '#79c495', fill: '#b7e6c5', light: '#dbf3e2' },
];
const CHIPS_PER_COLOR = 4;
const RINGS = [{ count: 13, radius: 39.5, start: -90 }, { count: 7, radius: 22.5, start: -90 }];
// One dice face per color; the cube rotation that brings each face to the front.
const CUBE = [
  { side: 'rotateY(0deg)',   x: 0,   y: 0 },
  { side: 'rotateY(90deg)',  x: 0,   y: -90 },
  { side: 'rotateY(180deg)', x: 0,   y: 180 },
  { side: 'rotateY(-90deg)', x: 0,   y: 90 },
  { side: 'rotateX(90deg)',  x: -90, y: 0 },
  { side: 'rotateX(-90deg)', x: 90,  y: 0 },
];
const DICE_FACES = [...COLORS, BLACK];
const SAVE_KEY = 'memory-chiess:save';
const NAMES_KEY = 'memory-chiess:names';
const ID_KEY = 'memory-chiess:id';
const ROOM_KEY = 'memory-chiess:room';
const MAX_PLAYERS = 4;
const CODE_LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I/L to mix up
const CODE_LENGTH = 5;

const $ = (s) => document.querySelector(s);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};

const slots = RINGS.flatMap((ring) => Array.from({ length: ring.count }, (_, i) => {
  const a = ((ring.start + (i * 360) / ring.count) * Math.PI) / 180;
  return { x: 50 + Math.cos(a) * ring.radius, y: 50 + Math.sin(a) * ring.radius };
}));

let game = null;      // { players, chips, turn, pending, again }: identical on every phone in a room
let phase = 'idle';   // idle | roll | pick | busy
let session = 0;      // bumps when a game is left, so pending timers stop acting on it
let chain = Promise.resolve(); // animations play one at a time, in order
let cubeX = 0, cubeY = 0;
let playerCount = 2;
let names = store.get(NAMES_KEY) || [];
let online = null;    // { code, me, host, seq, status, lobby, room, joining }; null when playing on one device

/* ---------- Menu ---------- */

function show(id) {
  for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id;
}

function renderNames() {
  for (const b of document.querySelectorAll('[data-count]')) {
    const on = +b.dataset.count === playerCount;
    b.classList.toggle('on', on);
    b.setAttribute('aria-checked', on);
  }
  $('#names').innerHTML = BUDDIES.slice(0, playerCount).map((p, i) =>
    `<label class="name">${Art.buddy(p, 50 + i)}<input data-i="${i}" maxlength="10" autocomplete="off" autocorrect="off"
      aria-label="Name of player ${i + 1}" placeholder="Player ${i + 1}"></label>`).join('');
  for (const input of document.querySelectorAll('#names input')) {
    input.value = names[input.dataset.i] || '';
    input.addEventListener('input', () => {
      names[input.dataset.i] = input.value.trim();
      store.set(NAMES_KEY, names);
    });
  }
}

function openMenu() {
  session++;
  phase = 'idle';
  leaveRoom();
  $('#end-sheet').hidden = true;
  $('#continue').hidden = !store.get(SAVE_KEY);
  const room = store.get(ROOM_KEY);
  $('#rejoin').hidden = !room;
  if (room) $('#rejoin').textContent = `Rejoin room ${room.code}`;
  renderNames();
  show('menu');
}

/* ---------- Game setup ---------- */

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function dealChips() {
  return shuffle(COLORS.flatMap((c) => Array(CHIPS_PER_COLOR).fill(c.id))).map((color) => ({ color, gone: false }));
}

function newGame() {
  const players = Array.from({ length: playerCount }, (_, i) => ({
    name: names[i] || `Player ${i + 1}`, buddy: i, score: 0,
  }));
  game = { players, chips: dealChips(), turn: 0, pending: null, again: false };
  store.set(SAVE_KEY, game);
  startBoard();
}

// Draws the board straight from the current state, with no animation.
function startBoard() {
  session++;
  chain = Promise.resolve();
  $('#end-sheet').hidden = true;
  show('game');
  renderPlayers();
  renderChips();
  if (game.pending) spinTo(DICE_FACES.find((f) => f.id === game.pending));
  settle();
}

function renderPlayers() {
  const box = $('#players');
  box.dataset.n = game.players.length;
  box.innerHTML = game.players.map((p, i) => `
    <div class="player" data-i="${i}">
      ${Art.buddy(BUDDIES[p.buddy], 50 + p.buddy)}
      <b class="score">${p.score}</b>
      <span class="pname"></span>
    </div>`).join('');
  box.querySelectorAll('.pname').forEach((el, i) => { el.textContent = game.players[i].name; });
}

function renderChips() {
  const box = $('#chips');
  box.innerHTML = '';
  game.chips.forEach((chip, i) => {
    if (chip.gone) return;
    const color = COLORS.find((c) => c.id === chip.color);
    const el = document.createElement('button');
    el.className = 'slot';
    el.dataset.i = i;
    el.setAttribute('aria-label', `Hidden chip ${i + 1}`);
    el.style.left = `${slots[i].x}%`;
    el.style.top = `${slots[i].y}%`;
    el.style.animationDelay = `${i * 22}ms`;
    // The back art depends on the slot, never on the color underneath.
    el.innerHTML = `<div class="flip"><div class="side back">${Art.chipBack(100 + i)}</div><div class="side front">${Art.chipFront(color, 200 + i)}</div></div>`;
    box.append(el);
  });
}

function say(html) { $('#bubble').innerHTML = `<span>${html}</span>`; }
const dot = (c) => `<i class="dot" style="background:${c.fill};border-color:${c.edge}"></i>`;
const safe = (s) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const current = () => game.players[game.turn];
const isMine = () => !online || current().id === online.me;
const isOver = () => game.chips.every((c) => c.gone);

// Everything the screen shows between animations follows from the state alone.
function settle() {
  if (isOver()) return finish();
  if (!online) store.set(SAVE_KEY, game);
  phase = game.pending ? 'pick' : 'roll';
  $('#end-sheet').hidden = true;
  document.querySelectorAll('.player').forEach((el, i) => el.classList.toggle('active', i === game.turn));
  $('#board').classList.toggle('picking', phase === 'pick' && isMine());
  $('#dice').classList.toggle('ready', phase === 'roll' && isMine());

  const who = `<b>${safe(current().name)}</b>`;
  const color = DICE_FACES.find((f) => f.id === game.pending);
  if (color) {
    say(isMine() ? `${dot(color)} Find a <b>${color.name}</b> chip!` : `${dot(color)} ${who} is finding a <b>${color.name}</b> chip`);
  } else if (online && isMine()) {
    say(game.again ? '<b>You</b> get to roll again!' : '<b>Your</b> turn, tap the dice!');
  } else if (online) {
    say(game.again ? `${who} rolls again` : `It's ${who}'s turn`);
  } else {
    say(game.again ? `${who}, roll again!` : `${who}, tap the dice!`);
  }
}

/* ---------- Turn ---------- */

// The rules: the same action gives the same result on every phone.
function applyAction(g, act) {
  const s = JSON.parse(JSON.stringify(g));
  const pass = () => { s.turn = (s.turn + 1) % s.players.length; };
  s.again = false;
  if (act.t === 'roll') {
    if (act.face === BLACK.id) pass();
    else s.pending = act.face;
  } else {
    const chip = s.chips[act.i];
    if (chip.color === s.pending) {
      chip.gone = true;
      s.players[s.turn].score++;
      s.again = true; // a correct guess keeps the turn: only a wrong chip or black passes the dice on
    } else {
      pass();
    }
    s.pending = null;
  }
  return s;
}

function act(a) {
  phase = 'busy';
  $('#board').classList.remove('picking');
  $('#dice').classList.remove('ready');
  const next = applyAction(game, a);
  if (online) {
    online.seq++;
    online.room.state(roomMessage(a, next));
  }
  play(a, next);
}

// Queued so a message that arrives mid-animation waits its turn before changing the state.
function play(a, next) {
  const me = session;
  chain = chain.then(() => {
    if (me !== session) return null;
    const before = game;
    game = next;
    return a.t === 'roll' ? showRoll(a, before, me) : showPick(a, before, me);
  }).catch(console.error);
}

function spinTo(face) {
  const pose = CUBE[DICE_FACES.indexOf(face)];
  cubeX = Math.ceil(cubeX / 360) * 360 + 720 + pose.x;
  cubeY = Math.ceil(cubeY / 360) * 360 + 1080 + pose.y;
  $('#cube').style.transform = `rotateX(${cubeX}deg) rotateY(${cubeY}deg)`;
}

function roll() {
  if (phase !== 'roll' || !isMine()) return;
  // A color with no chips left is rolled again, so nobody hunts for chips that don't exist.
  const left = new Set(game.chips.filter((c) => !c.gone).map((c) => c.color));
  const options = DICE_FACES.filter((f) => f === BLACK || left.has(f.id));
  act({ t: 'roll', face: options[Math.floor(Math.random() * options.length)].id });
}

function pick(el) {
  if (phase !== 'pick' || !isMine()) return;
  act({ t: 'pick', i: +el.dataset.i });
}

async function showRoll(a, before, me) {
  if (me !== session) return;
  phase = 'busy';
  $('#dice').classList.remove('ready');
  say('Rolling…');
  const face = DICE_FACES.find((f) => f.id === a.face);
  spinTo(face);
  await wait(1150);
  if (me !== session) return;
  if (face === BLACK) {
    say(`${dot(BLACK)} Black! <b>${safe(before.players[before.turn].name)}</b> skips this round`);
    await wait(1900);
    if (me !== session) return;
  }
  settle();
}

async function showPick(a, before, me) {
  if (me !== session) return;
  phase = 'busy';
  $('#board').classList.remove('picking');
  const el = document.querySelector(`.slot[data-i="${a.i}"]`);
  if (!el) return settle();
  const chip = before.chips[a.i];
  const color = COLORS.find((c) => c.id === chip.color);
  const name = before.players[before.turn].name;
  el.classList.add('up');
  el.setAttribute('aria-label', `${color.name} chip`);
  await wait(520);
  if (me !== session) return;

  if (chip.color === before.pending) {
    say(`${dot(color)} Yay! One point for <b>${safe(name)}</b>`);
    el.classList.add('match');
    burst(el);
    bloom(a.i, color);
    await wait(750);
    if (me !== session) return;
    flyToPlayer(el, before.turn);
    await wait(620);
    if (me !== session) return;
    el.remove();
    if (!isOver()) await wait(250);
  } else {
    say(`${dot(color)} Oops, that's <b>${color.name}</b>. Remember it!`);
    el.classList.add('miss');
    await wait(1500);
    if (me !== session) return;
    el.classList.remove('up', 'miss');
    el.setAttribute('aria-label', `Hidden chip ${a.i + 1}`);
    await wait(420);
  }
  if (me === session) settle();
}

function burst(el) {
  const box = document.createElement('div');
  box.className = 'burst';
  box.innerHTML = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2;
    return `<span style="--x:${Math.cos(a) * 62}px;--y:${Math.sin(a) * 62}px">${Art.svg(24, Art.sparkle(12, 12, 1))}</span>`;
  }).join('');
  el.append(box);
}

// A ring of flowers opens around the scored chip. It stays on the board while the chip flies off.
function bloom(i, color) {
  const friend = COLORS[(COLORS.indexOf(color) + 1) % COLORS.length];
  const count = 7;
  const box = document.createElement('div');
  box.className = 'bloom';
  box.style.left = `${slots[i].x}%`;
  box.style.top = `${slots[i].y}%`;
  box.innerHTML = Array.from({ length: count }, (_, k) => {
    const a = (k / count) * Math.PI * 2 - Math.PI / 2;
    const reach = 11.5 + (k % 2) * 3;
    const style = `--x:${(Math.cos(a) * reach).toFixed(1)}cqw;--y:${(Math.sin(a) * reach).toFixed(1)}cqw;` +
      `--s:${9 + (k % 3) * 2}cqw;--r:${k * 47}deg;--d:${k * 45}ms`;
    return `<div class="bloom-flower" style="${style}">${Art.bloom(k % 2 ? friend : color)}</div>`;
  }).join('');
  $('#chips').append(box);
  setTimeout(() => box.remove(), 1500);
}

function flyToPlayer(el, who) {
  const card = document.querySelector(`.player[data-i="${who}"]`);
  const from = el.getBoundingClientRect();
  const to = card.getBoundingClientRect();
  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  el.style.zIndex = 20;
  el.animate(
    [{ translate: '-50% -50%', scale: 1, opacity: 1 },
     { translate: `calc(-50% + ${dx}px) calc(-50% + ${dy}px)`, scale: 0.35, opacity: 0.7 }],
    { duration: 580, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'forwards' });
  setTimeout(() => {
    card.querySelector('.score').textContent = game.players[who]?.score ?? '';
    card.classList.remove('bump');
    void card.offsetWidth;
    card.classList.add('bump');
  }, 520);
}

function finish() {
  phase = 'idle';
  if (!online) store.del(SAVE_KEY);
  // Score cards can lag behind the last flying chip, so settle them before the sheet opens.
  game.players.forEach((p, i) => { document.querySelector(`.player[data-i="${i}"] .score`).textContent = p.score; });
  const top = Math.max(...game.players.map((p) => p.score));
  const winners = game.players.filter((p) => p.score === top);
  $('#winner-art').innerHTML = winners.map((p) => Art.buddy(BUDDIES[p.buddy], 50 + p.buddy)).join('');
  $('#winner-title').textContent = winners.length > 1 ? "It's a tie!" : `${winners[0].name} wins!`;
  $('#ranking').innerHTML = '';
  [...game.players].sort((a, b) => b.score - a.score).forEach((p) => {
    const li = document.createElement('li');
    li.innerHTML = `${Art.buddy(BUDDIES[p.buddy], 50 + p.buddy)}<span></span><b>${p.score}</b>`;
    li.querySelector('span').textContent = p.name;
    $('#ranking').append(li);
  });
  $('#petals').innerHTML = Array.from({ length: 26 }, (_, i) => {
    const c = COLORS[i % COLORS.length];
    return `<span style="left:${(i * 37) % 100}%;animation-delay:${(i * 0.23) % 3}s;animation-duration:${3.4 + (i % 5) * 0.5}s">${Art.svg(100, Art.wash(50, 50, 46, c, 400 + i, 'flower'))}</span>`;
  }).join('');
  const canRestart = !online || online.host === online.me;
  $('#again').hidden = !canRestart;
  $('#waiting-host').hidden = canRestart;
  $('#end-sheet').hidden = false;
}

/* ---------- Online rooms ---------- */

function myId() {
  let id = store.get(ID_KEY);
  if (!id) {
    id = Math.random().toString(36).slice(2, 12);
    store.set(ID_KEY, id);
  }
  return id;
}

function makeCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  return [...bytes].map((b) => CODE_LETTERS[b % CODE_LETTERS.length]).join('');
}

const cleanCode = (s) => s.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH);
const myName = () => $('#online-name').value.trim() || 'Player';

function roomMessage(a = null, g = game) {
  const { seq, status, host, lobby } = online;
  return { seq, status, host, lobby, game: g, act: a };
}

function openOnline(code = '', error = '') {
  leaveRoom();
  $('#online-name').value = names[0] || '';
  $('#join-code').value = code;
  $('#online-error').textContent = error;
  setOnlineBusy(false);
  show('online');
}

function setOnlineBusy(busy) {
  $('#create-room').disabled = busy;
  $('#join-room').disabled = busy;
}

function leaveRoom() {
  if (!online) return;
  clearTimeout(online.joinTimeout);
  clearInterval(online.joining);
  online.room?.close();
  online = null;
  $('#net').hidden = true;
}

function forgetRoom() {
  store.del(ROOM_KEY);
  leaveRoom();
}

function failJoin(message) {
  const code = online?.code || '';
  forgetRoom();
  openOnline(code, message);
}

async function connectRoom(code) {
  const me = myId();
  online = { code, me, host: null, seq: 0, status: 'joining', lobby: [], room: null };
  const mine = online;
  const room = await Net.open(code, {
    onStatus: (up) => { if (online === mine) showNet(up); },
    onState: (msg) => { if (online === mine) onRoomState(msg); },
    onAsk: (msg) => { if (online === mine) onRoomAsk(msg); },
  });
  if (online !== mine) room.close();
  else online.room = room;
  return online === mine;
}

let netTimer = 0;
function showNet(up) {
  clearTimeout(netTimer);
  if (up) $('#net').hidden = true;
  else netTimer = setTimeout(() => { if (online) $('#net').hidden = false; }, 1200);
}

async function createRoom() {
  setOnlineBusy(true);
  names[0] = $('#online-name').value.trim();
  store.set(NAMES_KEY, names);
  try {
    const code = makeCode();
    if (!await connectRoom(code)) return;
    Object.assign(online, { host: online.me, status: 'lobby', seq: 1, lobby: [{ id: online.me, name: myName() }] });
    online.room.state(roomMessage());
    store.set(ROOM_KEY, { code });
    renderLobby();
  } catch {
    failJoin("Couldn't connect. Check your internet and try again.");
  }
}

async function joinRoom(code = cleanCode($('#join-code').value)) {
  if (code.length !== CODE_LENGTH) {
    $('#online-error').textContent = `Room codes have ${CODE_LENGTH} letters.`;
    return;
  }
  setOnlineBusy(true);
  $('#online-error').textContent = 'Looking for the room…';
  names[0] = $('#online-name').value.trim() || names[0] || '';
  store.set(NAMES_KEY, names);
  try {
    if (!await connectRoom(code)) return;
    online.joinTimeout = setTimeout(() => {
      if (online?.status === 'joining') failJoin("We couldn't find that room. Check the code.");
    }, 9000);
  } catch {
    failJoin("Couldn't connect. Check your internet and try again.");
  }
}

function askToJoin() {
  if (online.joining) return;
  const ask = () => online?.room?.ask({ t: 'join', id: online.me, name: names[0] || 'Player' });
  ask();
  // The host may be away for a moment sharing the code, and asks aren't stored, so keep asking.
  online.joining = setInterval(ask, 1500);
}

function onRoomAsk(msg) {
  if (online.host !== online.me || online.status !== 'lobby') return;
  const known = online.lobby.some((p) => p.id === msg.id);
  if (msg.t === 'leave') {
    online.lobby = online.lobby.filter((p) => p.id !== msg.id);
  } else if (msg.t === 'join' && !known && online.lobby.length < MAX_PLAYERS) {
    online.lobby.push({ id: msg.id, name: String(msg.name).slice(0, 10) });
  } else {
    return;
  }
  online.seq++;
  online.room.state(roomMessage());
  renderLobby();
}

function onRoomState(msg) {
  if (msg.seq <= online.seq && online.status !== 'joining') return;
  const firstLook = online.status === 'joining';
  const next = msg.seq === online.seq + 1;
  Object.assign(online, { seq: msg.seq, status: msg.status, host: msg.host, lobby: msg.lobby });
  clearTimeout(online.joinTimeout);

  if (msg.status === 'closed') return failJoin('The host closed the room.');

  const member = msg.lobby.some((p) => p.id === online.me);
  if (member) {
    clearInterval(online.joining);
    online.joining = null;
    store.set(ROOM_KEY, { code: online.code });
  }

  if (msg.status === 'lobby') {
    if (member) renderLobby();
    else if (msg.lobby.length >= MAX_PLAYERS) failJoin('That room is full.');
    else { renderWaitingToJoin(); askToJoin(); }
    return;
  }

  if (!member) return failJoin('That game has already started.');

  // The next action in line can be animated; after any gap, just redraw from the latest state.
  if (next && !firstLook && msg.act && game) {
    play(msg.act, msg.game);
  } else {
    game = msg.game;
    startBoard();
  }
}

function renderWaitingToJoin() {
  $('#online-error').textContent = 'Joining…';
}

function renderLobby() {
  $('#room-code').textContent = online.code;
  const isHost = online.host === online.me;
  $('#lobby-list').innerHTML = '';
  online.lobby.forEach((p, i) => {
    const li = document.createElement('li');
    li.innerHTML = `${Art.buddy(BUDDIES[i], 50 + i)}<span></span>`;
    li.querySelector('span').textContent = p.id === online.me ? `${p.name} (you)` : p.name;
    $('#lobby-list').append(li);
  });
  $('#start-room').hidden = !isHost;
  $('#start-room').disabled = online.lobby.length < 2;
  $('#start-room').textContent = online.lobby.length < 2 ? 'Waiting for a friend…' : 'Start game';
  const host = online.lobby.find((p) => p.id === online.host);
  $('#lobby-wait').hidden = isHost;
  $('#lobby-wait').textContent = `Waiting for ${host?.name || 'the host'} to start…`;
  show('lobby');
}

function startRoomGame() {
  const players = online.lobby.map((p, i) => ({ id: p.id, name: p.name, buddy: i, score: 0 }));
  game = { players, chips: dealChips(), turn: 0, pending: null, again: false };
  online.status = 'play';
  online.seq++;
  online.room.state(roomMessage());
  startBoard();
}

async function shareRoom() {
  const url = `${location.origin}${location.pathname}?room=${online.code}`;
  const text = `Play Memory Chiess with me! Room code: ${online.code}`;
  try {
    if (navigator.share) await navigator.share({ title: 'Memory Chiess', text, url });
    else {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      $('#share-room').textContent = 'Link copied!';
      setTimeout(() => { $('#share-room').textContent = 'Share invite'; }, 1800);
    }
  } catch {} // closing the share sheet counts as an error; nothing to do
}

function leaveLobby() {
  if (online.host === online.me) {
    online.status = 'closed';
    online.seq++;
    online.room.state(roomMessage());
  } else {
    online.room.ask({ t: 'leave', id: online.me });
  }
  const left = online;
  // Give the goodbye a moment to go out before the connection closes.
  store.del(ROOM_KEY);
  setTimeout(() => left.room?.close(), 400);
  online = null;
  $('#net').hidden = true;
  openMenu();
}

/* ---------- Wiring ---------- */

function init() {
  $('#hero').innerHTML = Art.hero();
  $('#board-art').innerHTML = Art.board(slots);
  $('#cube').innerHTML = DICE_FACES.map((f, i) => {
    const ink = f === BLACK ? '#fff4f7' : Art.INK;
    const art = Art.svg(100, Art.face(f === BLACK ? 'sleep' : f.face, 50, 50, 56, ink));
    return `<div class="dice-face" style="--side:${CUBE[i].side};background:${f.fill};border-color:${f.edge}">${art}</div>`;
  }).join('');
  const stars = [[8, 12, 1.2], [90, 8, 0.9], [5, 52, 0.8], [94, 46, 1.1], [12, 90, 1], [88, 92, 1.3], [50, 4, 0.7], [52, 97, 0.8]];
  $('#sky').innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">${stars.map(([x, y, s], i) => Art.sparkle(x, y, s * 0.22, i % 2 ? '#ffffff' : '#ffe9a6', i * 20)).join('')}</svg>`;

  for (const b of document.querySelectorAll('[data-count]')) {
    b.addEventListener('click', () => { playerCount = +b.dataset.count; renderNames(); });
  }
  $('#play').addEventListener('click', newGame);
  $('#continue').addEventListener('click', () => {
    game = store.get(SAVE_KEY);
    if (game) startBoard();
  });
  $('#rejoin').addEventListener('click', () => {
    const room = store.get(ROOM_KEY);
    if (!room) return;
    openOnline(room.code, 'Looking for the room…');
    $('#online-name').value = names[0] || '';
    joinRoom(room.code);
  });
  $('#play-online').addEventListener('click', () => openOnline());
  $('#online-back').addEventListener('click', openMenu);
  $('#create-room').addEventListener('click', createRoom);
  $('#join-room').addEventListener('click', () => joinRoom());
  $('#join-code').addEventListener('input', (e) => { e.target.value = cleanCode(e.target.value); });
  $('#share-room').addEventListener('click', shareRoom);
  $('#start-room').addEventListener('click', startRoomGame);
  $('#leave-room').addEventListener('click', leaveLobby);
  $('#how').addEventListener('click', () => { $('#how-sheet').hidden = false; });
  $('[data-close]').addEventListener('click', () => { $('#how-sheet').hidden = true; });
  $('#home').addEventListener('click', openMenu);
  $('#dice').addEventListener('click', roll);
  $('#chips').addEventListener('click', (e) => {
    const el = e.target.closest('.slot');
    if (el && !el.classList.contains('up')) pick(el);
  });
  $('#again').addEventListener('click', () => {
    if (online) startRoomGame();
    else { playerCount = game.players.length; newGame(); }
  });
  $('#to-menu').addEventListener('click', () => {
    if (online) store.del(ROOM_KEY);
    openMenu();
  });

  openMenu();
  const invite = cleanCode(new URLSearchParams(location.search).get('room') || '');
  if (invite) {
    history.replaceState(null, '', location.pathname);
    openOnline(invite);
  }
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js');
}

init();
