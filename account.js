// The player's account. Usernames, passwords and money live on a small server; rooms stay on the relay.
const Account = (() => {
  const API = 'https://memory-chiess-accounts.vercel.app/api/account';
  const KEY = 'memory-chiess:account';

  let me = null; // { id, name, balance, token }
  try { me = JSON.parse(localStorage.getItem(KEY)); } catch {}

  function remember(next) {
    me = next;
    try {
      if (me) localStorage.setItem(KEY, JSON.stringify(me));
      else localStorage.removeItem(KEY);
    } catch {}
  }

  async function call(action, body = {}) {
    let res;
    try {
      res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(me && { Authorization: `Bearer ${me.token}` }) },
        body: JSON.stringify({ action, ...body }),
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw new Error("Couldn't reach the server. Check your internet and try again.");
    }
    const json = await res.json().catch(() => ({}));
    if (res.status === 401 && me) remember(null);
    if (!res.ok) throw new Error(json.error || 'Something went wrong. Try again.');
    return json;
  }

  return {
    get id() { return me?.id; },
    get name() { return me?.name; },
    get balance() { return me?.balance ?? 0; },
    get signedIn() { return !!me; },
    async enter(action, username, password) { remember(await call(action, { username, password })); },
    signOut() { remember(null); },
    async refresh() {
      if (!me) return;
      const { balance } = await call('me');
      remember({ ...me, balance });
    },
    stake: (game, bet) => call('stake', { game, bet }),
    settle: (game, bet, players, winners) => call('settle', { game, bet, players, winners }),
  };
})();
