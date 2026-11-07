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
// One die face per colour; the cube rotation that brings each face to the front.
const CUBE = [
  { side: 'rotateY(0deg)',   x: 0,   y: 0 },
  { side: 'rotateY(90deg)',  x: 0,   y: -90 },
  { side: 'rotateY(180deg)', x: 0,   y: 180 },
  { side: 'rotateY(-90deg)', x: 0,   y: 90 },
  { side: 'rotateX(90deg)',  x: -90, y: 0 },
  { side: 'rotateX(-90deg)', x: 90,  y: 0 },
];
const DIE_FACES = [...COLORS, BLACK];
const SAVE_KEY = 'memory-chiess:save';
const NAMES_KEY = 'memory-chiess:names';

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

let game = null;      // { players, chips, turn }: the part that is saved
let phase = 'idle';   // idle | roll | rolling | pick | reveal
let target = null;
let session = 0;      // bumps when a game is left, so pending timers stop acting on it
let cubeX = 0, cubeY = 0;
let playerCount = 2;
let names = store.get(NAMES_KEY) || [];

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
  $('#end-sheet').hidden = true;
  $('#continue').hidden = !store.get(SAVE_KEY);
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

function newGame() {
  const players = Array.from({ length: playerCount }, (_, i) => ({
    name: names[i] || `Player ${i + 1}`, buddy: i, score: 0,
  }));
  const chips = shuffle(COLORS.flatMap((c) => Array(CHIPS_PER_COLOR).fill(c.id))).map((color) => ({ color, gone: false }));
  game = { players, chips, turn: 0 };
  store.set(SAVE_KEY, game);
  startBoard();
}

function startBoard() {
  session++;
  $('#end-sheet').hidden = true;
  show('game');
  renderPlayers();
  renderChips();
  startTurn();
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
    // The back art depends on the slot, never on the colour underneath.
    el.innerHTML = `<div class="flip"><div class="side back">${Art.chipBack(100 + i)}</div><div class="side front">${Art.chipFront(color, 200 + i)}</div></div>`;
    box.append(el);
  });
}

function say(html) { $('#bubble').innerHTML = html; }
const dot = (c) => `<i class="dot" style="background:${c.fill};border-color:${c.edge}"></i>`;
const safe = (s) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const current = () => game.players[game.turn];

function startTurn() {
  phase = 'roll';
  target = null;
  store.set(SAVE_KEY, game);
  document.querySelectorAll('.player').forEach((el, i) => el.classList.toggle('active', i === game.turn));
  $('#board').classList.remove('picking');
  $('#die').classList.add('ready');
  say(`<b>${safe(current().name)}</b>, tap the die!`);
}

function nextTurn() {
  game.turn = (game.turn + 1) % game.players.length;
  startTurn();
}

/* ---------- Turn ---------- */

async function roll() {
  if (phase !== 'roll') return;
  phase = 'rolling';
  const me = session;
  $('#die').classList.remove('ready');
  say('Rolling…');

  // A colour with no chips left is rolled again, so nobody hunts for chips that don't exist.
  const left = new Set(game.chips.filter((c) => !c.gone).map((c) => c.color));
  const options = DIE_FACES.filter((f) => f === BLACK || left.has(f.id));
  const face = options[Math.floor(Math.random() * options.length)];

  const pose = CUBE[DIE_FACES.indexOf(face)];
  cubeX = Math.ceil(cubeX / 360) * 360 + 720 + pose.x;
  cubeY = Math.ceil(cubeY / 360) * 360 + 1080 + pose.y;
  $('#cube').style.transform = `rotateX(${cubeX}deg) rotateY(${cubeY}deg)`;
  await wait(1150);
  if (me !== session) return;

  if (face === BLACK) {
    say(`${dot(BLACK)} Black! <b>${safe(current().name)}</b> skips this round`);
    await wait(1900);
    if (me === session) nextTurn();
    return;
  }
  target = face;
  phase = 'pick';
  $('#board').classList.add('picking');
  say(`${dot(face)} Find a <b>${face.name}</b> chip!`);
}

async function pick(el) {
  if (phase !== 'pick') return;
  phase = 'reveal';
  const me = session;
  const i = +el.dataset.i;
  const chip = game.chips[i];
  const color = COLORS.find((c) => c.id === chip.color);
  $('#board').classList.remove('picking');
  el.classList.add('up');
  el.setAttribute('aria-label', `${color.name} chip`);
  await wait(520);
  if (me !== session) return;

  if (chip.color === target.id) {
    chip.gone = true;
    current().score++;
    say(`${dot(color)} Yay! One point for <b>${safe(current().name)}</b>`);
    el.classList.add('match');
    burst(el);
    await wait(750);
    if (me !== session) return;
    flyToPlayer(el);
    await wait(620);
    if (me !== session) return;
    el.remove();
    if (game.chips.every((c) => c.gone)) return finish();
    await wait(250);
  } else {
    say(`${dot(color)} Oops, that's <b>${color.name}</b>. Remember it!`);
    el.classList.add('miss');
    await wait(1500);
    if (me !== session) return;
    el.classList.remove('up', 'miss');
    el.setAttribute('aria-label', `Hidden chip ${i + 1}`);
    await wait(420);
    if (me !== session) return;
  }
  nextTurn();
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

function flyToPlayer(el) {
  const card = document.querySelector(`.player[data-i="${game.turn}"]`);
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
    card.querySelector('.score').textContent = game.players[game.turn]?.score ?? '';
    card.classList.remove('bump');
    void card.offsetWidth;
    card.classList.add('bump');
  }, 520);
}

function finish() {
  phase = 'idle';
  store.del(SAVE_KEY);
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
  $('#end-sheet').hidden = false;
}

/* ---------- Wiring ---------- */

function init() {
  $('#hero').innerHTML = Art.hero();
  $('#board-art').innerHTML = Art.board(slots);
  $('#cube').innerHTML = DIE_FACES.map((f, i) => {
    const ink = f === BLACK ? '#fff4f7' : Art.INK;
    const art = Art.svg(100, Art.face(f === BLACK ? 'sleep' : f.face, 50, 50, 56, ink));
    return `<div class="die-face" style="--side:${CUBE[i].side};background:${f.fill};border-color:${f.edge}">${art}</div>`;
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
  $('#how').addEventListener('click', () => { $('#how-sheet').hidden = false; });
  $('[data-close]').addEventListener('click', () => { $('#how-sheet').hidden = true; });
  $('#home').addEventListener('click', openMenu);
  $('#die').addEventListener('click', roll);
  $('#chips').addEventListener('click', (e) => {
    const el = e.target.closest('.slot');
    if (el && !el.classList.contains('up')) pick(el);
  });
  $('#again').addEventListener('click', () => { playerCount = game.players.length; newGame(); });
  $('#to-menu').addEventListener('click', openMenu);

  openMenu();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js');
}

init();
