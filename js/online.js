// Regimon GO — online mode: see other trainers live.
// A tiny MQTT 3.1.1 client over WebSocket. To stay reliable on free public brokers, the game connects to
// THREE brokers at once, sends every message through all of them, and drops the duplicates it receives.
// If one broker is slow or down, the others keep everyone connected.
// What is shared: trainer name, level, neighborhood, and (in Explore mode only) the in-game position.
// Chat, emotes, duel invites and live battles use the same connections. Everything received is treated as
// untrusted: names and messages are cleaned, length-limited, rate-limited and HTML-escaped before display.
window.RGOnline = (() => {
  const BROKERS = ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt', 'wss://test.mosquitto.org:8081/mqtt'];
  const ROOT = 'regimongo/v1';
  const STALE_MS = 20000, MAX_PEERS = 150;
  const enc = new TextEncoder(), dec = new TextDecoder();

  let hooks = null, id = '', wantOnline = false, pubTimer = 0, lastStatus = '';
  const peers = new Map();
  const conns = BROKERS.map(url => ({ url, ws: null, connected: false, buf: new Uint8Array(0), pingTimer: 0, retryTimer: 0, retryDelay: 1500, pid: 1 }));

  const str = s => { const b = enc.encode(s); return [b.length >> 8, b.length & 255, ...b]; };
  function remLen(n) { const out = []; do { let d = n % 128; n = Math.floor(n / 128); if (n > 0) d |= 128; out.push(d); } while (n > 0); return out; }
  function packet(type, body) { const h = [type, ...remLen(body.length)], p = new Uint8Array(h.length + body.length); p.set(h); p.set(body, h.length); return p; }
  const sendTo = (c, p) => { if (c.ws && c.ws.readyState === 1) c.ws.send(p); };
  function pubPacket(topic, obj) {
    const t = str(topic), payload = enc.encode(JSON.stringify(obj)), body = new Uint8Array(t.length + payload.length);
    body.set(t); body.set(payload, t.length);
    return packet(0x30, body);
  }
  // Publish through every connected broker.
  function publish(topic, obj) { const p = pubPacket(topic, obj); for (const c of conns) if (c.connected) sendTo(c, p); }
  function subscribe(c, topic) { const n = c.pid++ & 0xffff; sendTo(c, packet(0x82, new Uint8Array([n >> 8, n & 255, ...str(topic), 0]))); }
  const anyConnected = () => conns.some(c => c.connected);
  const newMid = () => Math.random().toString(36).slice(2, 11);

  // Messages arrive once per broker; remember recent message ids and ignore repeats.
  const seen = new Map();
  function dupe(mid) {
    if (typeof mid !== 'string' || mid.length > 16) return false;
    if (seen.has(mid)) return true;
    seen.set(mid, Date.now());
    if (seen.size > 3000) { const cut = Date.now() - 60000; for (const [k, t] of seen) if (t < cut) seen.delete(k); if (seen.size > 3000) seen.clear(); }
    return false;
  }

  // Chat: short, filtered messages; emotes are picked from a fixed list so only an index is sent.
  const EMOTES = ['👋', '😂', '🔥', '😎', '🎉', '💪', '❤️', '😭', '🤔', '😡', '🏆', 'GG'];
  const BAD = /\b(f+u+c+k+\w*|sh[i1]+t+\w*|b[i1]+t+c+h+\w*|a+s+s+h+o+l+e+\w*|d[i1]+c+k+(s|head|heads)?|c+u+n+t+\w*|p+u+s+s+y+\w*|n+[i1]+g+\w*|f+a+g+\w*|r+e+t+a+r+d+\w*|wh+o+r+e+\w*|s+l+u+t+\w*|d+a+m+n+|b+a+s+t+a+r+d+\w*|p+[o0]+r+n+\w*)\b/gi;
  const cleanText = s => String(s || '').replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120)
    .replace(BAD, w => w[0] + '*'.repeat(w.length - 1));
  let lastChat = 0;
  const recent = new Map();   // sender id + channel → timestamps of their recent messages
  function flood(from, limit = 6) {
    const now = Date.now(), list = (recent.get(from) || []).filter(t => now - t < 10000);
    list.push(now); recent.set(from, list);
    if (recent.size > 500) recent.clear();
    return list.length > limit;
  }
  const cleanName = s => String(s || '').replace(/[^\p{L}\p{N} _.\-']/gu, '').trim().slice(0, 16) || 'Trainer';
  const num = (v, lo, hi) => (typeof v === 'number' && isFinite(v) && v >= lo && v <= hi ? v : null);

  function status() {
    const s = !wantOnline ? 'off' : anyConnected() ? 'online' : 'connecting';
    if (s !== lastStatus) { lastStatus = s; hooks && hooks.onStatus(s); }
  }
  function start(h) {
    hooks = h; id = h.id; wantOnline = true; lastStatus = '';
    for (const c of conns) connect(c);
    clearInterval(pubTimer); pubTimer = setInterval(sendPresence, 2000);
    status();
  }
  function stop() {
    if (anyConnected()) publish(`${ROOT}/p/${id}`, { id, leave: true });
    wantOnline = false;
    clearInterval(pubTimer);
    for (const c of conns) {
      clearInterval(c.pingTimer); clearTimeout(c.retryTimer);
      if (c.ws) { try { if (c.connected) sendTo(c, new Uint8Array([0xe0, 0])); c.ws.close(); } catch (e) { /* ignore */ } }
      c.ws = null; c.connected = false;
    }
    peers.clear();
    status();
  }
  function connect(c) {
    if (!wantOnline || (c.ws && c.ws.readyState <= 1)) return;
    let ws;
    try { ws = new WebSocket(c.url, ['mqtt']); } catch (e) { retry(c); return; }
    c.ws = ws; c.buf = new Uint8Array(0);
    ws.binaryType = 'arraybuffer';
    // A broker that doesn't answer within 8 seconds is dropped and retried later.
    const guard = setTimeout(() => { if (!c.connected && c.ws === ws) { try { ws.close(); } catch (e) { /* ignore */ } } }, 8000);
    ws.onopen = () => {
      const clientId = 'rg-' + id.slice(0, 10) + '-' + Math.random().toString(36).slice(2, 8);
      sendTo(c, packet(0x10, new Uint8Array([...str('MQTT'), 4, 0x02, 0, 45, ...str(clientId)])));
    };
    ws.onmessage = e => onData(c, new Uint8Array(e.data));
    ws.onclose = () => {
      clearTimeout(guard);
      if (c.ws !== ws) return;
      c.connected = false; c.ws = null; clearInterval(c.pingTimer);
      status();
      if (wantOnline) retry(c);
    };
    ws.onerror = () => { /* onclose follows */ };
  }
  function retry(c) {
    clearTimeout(c.retryTimer);
    c.retryTimer = setTimeout(() => connect(c), c.retryDelay);
    c.retryDelay = Math.min(20000, c.retryDelay * 1.7);
  }
  // Phones pause background tabs; reconnect as soon as the game is visible again.
  addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !wantOnline) return;
    for (const c of conns) if (!c.connected) { clearTimeout(c.retryTimer); c.retryDelay = 1500; connect(c); }
    sendPresence();
  });
  addEventListener('online', () => { if (wantOnline) for (const c of conns) if (!c.connected) { c.retryDelay = 1500; connect(c); } });

  // Split the byte stream into MQTT packets.
  function onData(c, chunk) {
    const merged = new Uint8Array(c.buf.length + chunk.length); merged.set(c.buf); merged.set(chunk, c.buf.length); c.buf = merged;
    for (;;) {
      if (c.buf.length < 2) return;
      let len = 0, mul = 1, i = 1, b;
      do { if (i >= c.buf.length) return; b = c.buf[i++]; len += (b & 127) * mul; mul *= 128; } while (b & 128);
      if (c.buf.length < i + len) return;
      handle(c, c.buf[0], c.buf.subarray(i, i + len));
      c.buf = c.buf.slice(i + len);
    }
  }
  function handle(c, h, body) {
    const type = h >> 4;
    if (type === 2) {   // CONNACK
      if (body[1] !== 0) { try { c.ws.close(); } catch (e) { /* ignore */ } return; }
      c.connected = true; c.retryDelay = 1500;
      for (const t of [`${ROOT}/p/+`, `${ROOT}/wave/${id}`, `${ROOT}/chat`, `${ROOT}/duel/${id}`, `${ROOT}/bt/${id}`]) subscribe(c, t);
      clearInterval(c.pingTimer); c.pingTimer = setInterval(() => sendTo(c, new Uint8Array([0xc0, 0])), 20000);
      sendPresence();
      status();
    } else if (type === 3) {   // PUBLISH (QoS 0)
      const tl = (body[0] << 8) | body[1];
      const topic = dec.decode(body.subarray(2, 2 + tl));
      let msg;
      try { msg = JSON.parse(dec.decode(body.subarray(2 + tl))); } catch (e) { return; }
      if (!msg || typeof msg !== 'object') return;
      if (topic.startsWith(`${ROOT}/p/`)) { onPresence(msg); return; }
      if (dupe(msg.mid)) return;
      if (typeof msg.from !== 'string' || msg.from.length > 40 || msg.from === id) return;
      if (topic === `${ROOT}/chat`) { onChat(msg); return; }
      if (topic.startsWith(`${ROOT}/bt/`)) { if (!flood(msg.from + ':bt', 250)) hooks.onBattle && hooks.onBattle(msg); return; }
      if (topic.startsWith(`${ROOT}/duel/`)) { if (!flood(msg.from + ':duel', 12)) hooks.onDuel && hooks.onDuel(msg); return; }
      if (topic.startsWith(`${ROOT}/wave/`)) { hooks.onWave(cleanName(msg.n)); return; }
    }
  }
  function sendPresence() {
    if (!wantOnline || !anyConnected()) return;
    publish(`${ROOT}/p/${id}`, { id, ...hooks.getState(), v: 2 });
  }
  function onPresence(m) {
    if (typeof m.id !== 'string' || m.id.length > 40 || m.id === id) return;
    if (m.leave) { peers.delete(m.id); return; }
    if (!peers.has(m.id) && peers.size >= MAX_PEERS) return;
    const W = hooks.world.W, H = hooks.world.H;
    const x = num(m.x, 0, W), y = num(m.y, 0, H);
    const old = peers.get(m.id);
    peers.set(m.id, {
      id: m.id, name: cleanName(m.n), lvl: num(m.l, 1, 999) || 1, hood: String(m.h || '').slice(0, 40), live: !!m.live,
      x, y, rx: old && old.rx != null && x != null ? old.rx : x, ry: old && old.ry != null && y != null ? old.ry : y,
      face: m.f === -1 ? -1 : 1, moving: !!m.mv, walkT: old ? old.walkT : 0, t: Date.now(),
      q: m.q === 1,
      b: Number.isInteger(m.b) && m.b > 0 && m.b < 2000 ? m.b : null, bs: m.bs === 1, bx: old ? old.bx : null, by: old ? old.by : null,
    });
  }
  function list() {
    const now = Date.now();
    for (const [k, p] of peers) if (now - p.t > STALE_MS) peers.delete(k);
    return [...peers.values()];
  }
  function onChat(m) {
    if (flood(m.from + ':chat')) return;
    const e = Number.isInteger(m.e) && m.e >= 0 && m.e < EMOTES.length ? m.e : null;
    const text = e == null ? cleanText(m.t) : '';
    if (e == null && !text) return;
    hooks.onChat && hooks.onChat({ from: m.from, name: cleanName(m.n), text, emote: e == null ? null : EMOTES[e] });
  }
  // Returns the cleaned text that was sent, or null when sending too fast.
  function chat(text) {
    const t = cleanText(text);
    if (!t || !anyConnected() || Date.now() - lastChat < 1500) return null;
    lastChat = Date.now();
    publish(`${ROOT}/chat`, { mid: newMid(), from: id, n: hooks.getState().n, t });
    return t;
  }
  function emote(i) {
    if (!anyConnected() || Date.now() - lastChat < 800) return false;
    lastChat = Date.now();
    publish(`${ROOT}/chat`, { mid: newMid(), from: id, n: hooks.getState().n, e: i });
    return true;
  }
  function duel(peerId, msg) { if (anyConnected() && typeof peerId === 'string') publish(`${ROOT}/duel/${peerId}`, { ...msg, mid: newMid(), from: id, n: hooks.getState().n }); }
  // Live battle traffic (inputs and state) has its own channel with a higher rate limit.
  function battle(peerId, msg) { if (anyConnected() && typeof peerId === 'string') publish(`${ROOT}/bt/${peerId}`, { ...msg, mid: newMid(), from: id }); }
  function wave(peerId) { if (anyConnected()) publish(`${ROOT}/wave/${peerId}`, { mid: newMid(), from: id, n: hooks.getState().n }); }

  return {
    start, stop, list, wave, chat, emote, duel, battle, EMOTES, cleanName, cleanText,
    isOn: () => wantOnline, isConnected: anyConnected, links: () => conns.filter(c => c.connected).length, get: pid => peers.get(pid),
  };
})();
