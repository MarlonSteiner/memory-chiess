// Accounts and bets. The store is passed in, so the same rules run on Vercel and in local tests.
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const START_BALANCE = 100000;
const MIN_BET = 1000;
const BET_STEP = 500;
const MAX_SESSIONS = 5;
const MAX_FAILS = 8;
const LOCK_MS = 10 * 60 * 1000;
const NAME = /^[A-Za-z0-9_-]{3,10}$/;
const GAME = /^[a-z0-9]{8,32}$/;

const hashPassword = async (password, salt) => (await promisify(scrypt)(password, salt, 32)).toString('hex');
const sha = (s) => createHash('sha256').update(s).digest('hex');
const userPath = (id) => `users/${id}.json`;

class Refusal extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function accounts(store) {
  // Two phones can write the same account at once, so a lost race reads again and retries.
  async function change(id, edit) {
    for (let i = 0; i < 6; i++) {
      const found = await store.read(userPath(id));
      if (!found) throw new Refusal(404, 'That account no longer exists.');
      edit(found.data);
      if (await store.update(userPath(id), found.data, found.etag)) return found.data;
    }
    throw new Refusal(503, 'The server is busy. Try again.');
  }

  function checkLogin(username, password) {
    if (typeof username !== 'string' || !NAME.test(username)) {
      throw new Refusal(400, 'Usernames have 3 to 10 letters or numbers.');
    }
    if (typeof password !== 'string' || password.length < 6 || password.length > 72) {
      throw new Refusal(400, 'Passwords have at least 6 characters.');
    }
  }

  function newSession(user, id) {
    const secret = randomBytes(24).toString('hex');
    user.sessions = [...user.sessions, sha(secret)].slice(-MAX_SESSIONS);
    return `${id}.${secret}`;
  }

  const profile = (user, token) => ({ id: user.name.toLowerCase(), name: user.name, balance: user.balance, ...(token && { token }) });

  async function register({ username, password }) {
    checkLogin(username, password);
    const id = username.toLowerCase();
    const salt = randomBytes(16).toString('hex');
    const user = { name: username, salt, hash: await hashPassword(password, salt), balance: START_BALANCE, sessions: [], fails: 0, lockedUntil: 0 };
    const token = newSession(user, id);
    if (!await store.create(userPath(id), user)) throw new Refusal(409, 'That username is taken.');
    return profile(user, token);
  }

  async function login({ username, password }) {
    checkLogin(username, password);
    const id = username.toLowerCase();
    const found = await store.read(userPath(id));
    const wrong = new Refusal(401, 'Wrong username or password.');
    if (!found) throw wrong;
    if (found.data.lockedUntil > Date.now()) throw new Refusal(429, 'Too many tries. Wait a few minutes.');
    const given = Buffer.from(await hashPassword(password, found.data.salt), 'hex');
    if (!timingSafeEqual(given, Buffer.from(found.data.hash, 'hex'))) {
      await change(id, (u) => {
        u.fails++;
        if (u.fails >= MAX_FAILS) { u.fails = 0; u.lockedUntil = Date.now() + LOCK_MS; }
      });
      throw wrong;
    }
    let token;
    const user = await change(id, (u) => { u.fails = 0; token = newSession(u, id); });
    return profile(user, token);
  }

  async function signedIn(token) {
    const [id, secret] = String(token).split('.');
    const found = id && secret && NAME.test(id) ? await store.read(userPath(id)) : null;
    if (!found || !found.data.sessions.includes(sha(secret))) throw new Refusal(401, 'Please sign in again.');
    return { id, user: found.data };
  }

  function checkBet(game, bet) {
    if (typeof game !== 'string' || !GAME.test(game)) throw new Refusal(400, 'Unknown game.');
    if (!Number.isInteger(bet) || bet < MIN_BET || bet % BET_STEP) throw new Refusal(400, 'That bet is not allowed.');
  }

  // Each phone agrees to its own bet, so nobody can be charged for a game they never played.
  async function stake({ game, bet }, token) {
    const { id, user } = await signedIn(token);
    checkBet(game, bet);
    if (user.balance < bet) throw new Refusal(409, 'Not enough money for this bet.');
    await store.create(`stakes/${game}/${id}.json`, { bet });
    return profile(user);
  }

  // Every phone reports the end of the game. The first report pays out and the rest get the same answer.
  async function settle({ game, bet, players, winners }, token) {
    const { id } = await signedIn(token);
    checkBet(game, bet);
    if (!Array.isArray(players) || !Array.isArray(winners) || players.length > 4) throw new Refusal(400, 'Unknown game.');
    const path = `games/${game}.json`;
    const done = await store.read(path);
    if (done) return { delta: done.data.deltas[id] ?? 0 };

    const ids = players.filter((p) => typeof p === 'string' && NAME.test(p));
    const stakes = await Promise.all(ids.map((p) => store.read(`stakes/${game}/${p}.json`)));
    const betting = ids.filter((_, i) => stakes[i]?.data.bet === bet);
    if (!betting.includes(id)) throw new Refusal(403, 'You have no bet in this game.');
    const paid = betting.filter((p) => winners.includes(p));
    const deltas = {};
    if (betting.length > 1 && paid.length) {
      const share = Math.floor((bet * betting.length) / paid.length);
      for (const p of betting) deltas[p] = (paid.includes(p) ? share : 0) - bet;
    }
    if (!await store.create(path, { bet, deltas })) {
      const first = await store.read(path);
      return { delta: first.data.deltas[id] ?? 0 };
    }
    await Promise.all(Object.entries(deltas).filter(([, d]) => d).map(([p, d]) =>
      change(p, (u) => { u.balance = Math.max(0, u.balance + d); })));
    return { delta: deltas[id] ?? 0 };
  }

  const actions = {
    register: (body) => register(body),
    login: (body) => login(body),
    me: async (_, token) => profile((await signedIn(token)).user),
    stake,
    settle,
  };

  return async function handle(body, token) {
    const run = actions[body?.action];
    if (!run) return { status: 400, json: { error: 'Unknown request.' } };
    try {
      return { status: 200, json: await run(body, token) };
    } catch (e) {
      if (e instanceof Refusal) return { status: e.status, json: { error: e.message } };
      console.error(e);
      return { status: 500, json: { error: 'Something went wrong. Try again.' } };
    }
  };
}
