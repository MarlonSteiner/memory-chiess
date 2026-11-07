// Online rooms. Phones talk through a free public MQTT relay, so the game needs no server of its own.
// The relay keeps the latest room state, which is what lets a phone rejoin after locking or reloading.
// Everything is encrypted with a key made from the room code, so the relay only sees scrambled bytes.
const Net = (() => {
  const BROKER = 'wss://broker.hivemq.com:8884/mqtt';
  const ROOM_LIFETIME = 24 * 60 * 60;
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  async function loadClient() {
    if (window.mqtt) return;
    await new Promise((ok, fail) => {
      const s = document.createElement('script');
      s.src = 'vendor/mqtt.min.js';
      s.onload = ok;
      s.onerror = () => fail(new Error('relay client failed to load'));
      document.head.append(s);
    });
  }

  const sha = (text) => crypto.subtle.digest('SHA-256', enc.encode(text));
  const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

  async function open(code, handlers) {
    await loadClient();
    const key = await crypto.subtle.importKey('raw', await sha(`memory-chiess:key:${code}`), 'AES-GCM', false, ['encrypt', 'decrypt']);
    const base = `memory-chiess/v1/${hex(await sha(`memory-chiess:topic:${code}`)).slice(0, 32)}`;
    const STATE = `${base}/state`, ASK = `${base}/ask`;

    let client = null;
    let closed = false;
    let hiddenAt = 0;
    let inbox = Promise.resolve(); // decrypting is async; this keeps messages in arrival order

    async function seal(obj) {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const body = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj)));
      const out = new Uint8Array(12 + body.byteLength);
      out.set(iv);
      out.set(new Uint8Array(body), 12);
      return out;
    }

    async function unseal(bytes) {
      const data = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, key, bytes.slice(12));
      return JSON.parse(dec.decode(data));
    }

    function connect() {
      const c = mqtt.connect(BROKER, { protocolVersion: 5, clean: true, keepalive: 20, reconnectPeriod: 1500, connectTimeout: 8000, resubscribe: false });
      client = c;
      c.on('connect', () => {
        c.subscribe([STATE, ASK], { qos: 1 });
        handlers.onStatus(true);
      });
      c.on('close', () => { if (c === client && !closed) handlers.onStatus(false); });
      c.on('error', () => {});
      c.on('message', (topic, payload) => {
        const bytes = new Uint8Array(payload);
        if (!bytes.length) return;
        inbox = inbox.then(async () => {
          let msg;
          try { msg = await unseal(bytes); } catch { return; } // not from this room
          if (closed) return;
          if (topic === STATE) handlers.onState(msg);
          else handlers.onAsk(msg);
        });
      });
    }

    // iPhones freeze sockets in the background, and a frozen one can still look open. Start fresh on return.
    function onVisibility() {
      if (document.hidden) { hiddenAt = Date.now(); return; }
      if (hiddenAt && Date.now() - hiddenAt > 3000) {
        const old = client;
        connect();
        old.end(true);
      }
      hiddenAt = 0;
    }
    document.addEventListener('visibilitychange', onVisibility);

    connect();

    return {
      async state(obj) {
        client.publish(STATE, await seal(obj), { qos: 1, retain: true, properties: { messageExpiryInterval: ROOM_LIFETIME } });
      },
      async ask(obj) {
        client.publish(ASK, await seal(obj), { qos: 0 });
      },
      close() {
        closed = true;
        document.removeEventListener('visibilitychange', onVisibility);
        client.end(false);
      },
    };
  }

  return { open };
})();
