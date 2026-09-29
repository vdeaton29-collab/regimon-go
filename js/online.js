// Regimon GO — online mode: see other trainers live.
// Uses a tiny MQTT 3.1.1 client over WebSocket and the free public HiveMQ broker. Every player
// publishes a small presence message every 2 seconds; everyone subscribes to everyone's presence.
// What is shared: trainer name, level, neighborhood, and (in Explore mode only) the in-game position.
// Chat, emotes and duel invites go through the same broker. Everything received is treated as untrusted:
// names and messages are cleaned, length-limited, rate-limited and HTML-escaped by the game before display.
window.RGOnline = (() => {
  const BROKER = 'wss://broker.hivemq.com:8884/mqtt';
  const ROOT = 'regimongo/v1';
  const STALE_MS = 12000, MAX_PEERS = 150;
  const enc = new TextEncoder(), dec = new TextDecoder();

  let ws = null, hooks = null, id = '', connected = false, wantOnline = false;
  let pingTimer = 0, pubTimer = 0, retryTimer = 0, retryDelay = 2000, pid = 1;
  let buf = new Uint8Array(0);
  const peers = new Map();

  const str = s => { const b = enc.encode(s); return [b.length >> 8, b.length & 255, ...b]; };
  function remLen(n) { const out = []; do { let d = n % 128; n = Math.floor(n / 128); if (n > 0) d |= 128; out.push(d); } while (n > 0); return out; }
  const packet = (type, body) => new Uint8Array([type, ...remLen(body.length), ...body]);
  function send(p) { if (ws && ws.readyState === 1) ws.send(p); }
  function publish(topic, obj) { send(packet(0x30, [...str(topic), ...enc.encode(JSON.stringify(obj))])); }
  function subscribe(topic) { const n = pid++ & 0xffff; send(packet(0x82, [n >> 8, n & 255, ...str(topic), 0])); }

  // Chat: short, filtered messages; emotes are picked from a fixed list so only an index is sent.
  const EMOTES = ['👋', '😂', '🔥', '😎', '🎉', '💪', '❤️', '😭', '🤔', '😡', '🏆', 'GG'];
  const BAD = /\b(f+u+c+k+\w*|sh[i1]+t+\w*|b[i1]+t+c+h+\w*|a+s+s+h+o+l+e+\w*|d[i1]+c+k+(s|head|heads)?|c+u+n+t+\w*|p+u+s+s+y+\w*|n+[i1]+g+\w*|f+a+g+\w*|r+e+t+a+r+d+\w*|wh+o+r+e+\w*|s+l+u+t+\w*|d+a+m+n+|b+a+s+t+a+r+d+\w*|p+[o0]+r+n+\w*)\b/gi;
  const cleanText = s => String(s || '').replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120)
    .replace(BAD, w => w[0] + '*'.repeat(w.length - 1));
  let lastChat = 0;
  const recent = new Map();   // sender id → timestamps of their recent messages
  function flood(from) {
    const now = Date.now(), list = (recent.get(from) || []).filter(t => now - t < 10000);
    list.push(now); recent.set(from, list);
    if (recent.size > 500) recent.clear();
    return list.length > 6;
  }
  const cleanName = s => String(s || '').replace(/[^\p{L}\p{N} _.\-']/gu, '').trim().slice(0, 16) || 'Trainer';
  const num = (v, lo, hi) => (typeof v === 'number' && isFinite(v) && v >= lo && v <= hi ? v : null);

  function start(h) {
    hooks = h; id = h.id; wantOnline = true;
    connect();
  }
  function stop() {
    wantOnline = false;
    clearInterval(pingTimer); clearInterval(pubTimer); clearTimeout(retryTimer);
    if (ws) {
      try { if (connected) { publish(`${ROOT}/p/${id}`, { id, leave: true }); send(new Uint8Array([0xe0, 0])); } ws.close(); } catch (e) { /* ignore */ }
    }
    ws = null; connected = false; peers.clear();
    hooks && hooks.onStatus('off');
  }
  function connect() {
    if (!wantOnline) return;
    hooks.onStatus('connecting');
    try {
      ws = new WebSocket(BROKER, ['mqtt']);
    } catch (e) { scheduleRetry(); return; }
    ws.binaryType = 'arraybuffer';
    buf = new Uint8Array(0);
    ws.onopen = () => {
      const clientId = 'rg-' + id.slice(0, 10) + '-' + Math.random().toString(36).slice(2, 7);
      send(packet(0x10, [...str('MQTT'), 4, 0x02, 0, 60, ...str(clientId)]));
    };
    ws.onmessage = e => onData(new Uint8Array(e.data));
    ws.onclose = () => { connected = false; clearInterval(pingTimer); clearInterval(pubTimer); if (wantOnline) { hooks.onStatus('connecting'); scheduleRetry(); } };
    ws.onerror = () => { /* onclose follows */ };
  }
  function scheduleRetry() {
    clearTimeout(retryTimer);
    retryTimer = setTimeout(connect, retryDelay);
    retryDelay = Math.min(30000, retryDelay * 2);
  }
  // Split the byte stream into MQTT packets.
  function onData(chunk) {
    const merged = new Uint8Array(buf.length + chunk.length); merged.set(buf); merged.set(chunk, buf.length); buf = merged;
    for (;;) {
      if (buf.length < 2) return;
      let len = 0, mul = 1, i = 1, b;
      do { if (i >= buf.length) return; b = buf[i++]; len += (b & 127) * mul; mul *= 128; } while (b & 128);
      if (buf.length < i + len) return;
      handle(buf[0], buf.subarray(i, i + len));
      buf = buf.slice(i + len);
    }
  }
  function handle(h, body) {
    const type = h >> 4;
    if (type === 2) {   // CONNACK
      if (body[1] !== 0) { hooks.onStatus('error'); return; }
      connected = true; retryDelay = 2000;
      subscribe(`${ROOT}/p/+`);
      subscribe(`${ROOT}/wave/${id}`);
      subscribe(`${ROOT}/chat`);
      subscribe(`${ROOT}/duel/${id}`);
      clearInterval(pingTimer); pingTimer = setInterval(() => send(new Uint8Array([0xc0, 0])), 30000);
      clearInterval(pubTimer); pubTimer = setInterval(sendPresence, 2000);
      sendPresence();
      hooks.onStatus('online');
    } else if (type === 3) {   // PUBLISH (QoS 0)
      const tl = (body[0] << 8) | body[1];
      const topic = dec.decode(body.subarray(2, 2 + tl));
      let msg;
      try { msg = JSON.parse(dec.decode(body.subarray(2 + tl))); } catch (e) { return; }
      if (!msg || typeof msg !== 'object') return;
      if (topic === `${ROOT}/chat`) { onChat(msg); return; }
      if (topic.startsWith(`${ROOT}/duel/`)) { if (typeof msg.from === 'string' && msg.from !== id && msg.from.length <= 40 && !flood(msg.from)) hooks.onDuel && hooks.onDuel(msg); return; }
      if (topic.startsWith(`${ROOT}/wave/`)) { if (typeof msg.from === 'string' && msg.from !== id) hooks.onWave(cleanName(msg.n)); return; }
      onPresence(msg);
    }
  }
  function sendPresence() {
    if (!connected) return;
    const s = hooks.getState();
    publish(`${ROOT}/p/${id}`, { id, ...s, v: 1 });
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
      b: Number.isInteger(m.b) && m.b > 0 && m.b < 2000 ? m.b : null, bs: m.bs === 1, bx: old ? old.bx : null, by: old ? old.by : null,
    });
  }
  function list() {
    const now = Date.now();
    for (const [k, p] of peers) if (now - p.t > STALE_MS) peers.delete(k);
    return [...peers.values()];
  }
  function onChat(m) {
    if (typeof m.from !== 'string' || m.from.length > 40 || m.from === id || flood(m.from)) return;
    const e = Number.isInteger(m.e) && m.e >= 0 && m.e < EMOTES.length ? m.e : null;
    const text = e == null ? cleanText(m.t) : '';
    if (e == null && !text) return;
    hooks.onChat && hooks.onChat({ from: m.from, name: cleanName(m.n), text, emote: e == null ? null : EMOTES[e] });
  }
  // Returns the cleaned text that was sent, or null when sending too fast.
  function chat(text) {
    const t = cleanText(text);
    if (!t || !connected || Date.now() - lastChat < 1500) return null;
    lastChat = Date.now();
    publish(`${ROOT}/chat`, { from: id, n: hooks.getState().n, t });
    return t;
  }
  function emote(i) {
    if (!connected || Date.now() - lastChat < 800) return false;
    lastChat = Date.now();
    publish(`${ROOT}/chat`, { from: id, n: hooks.getState().n, e: i });
    return true;
  }
  function duel(peerId, msg) { if (connected && typeof peerId === 'string') publish(`${ROOT}/duel/${peerId}`, { ...msg, from: id, n: hooks.getState().n }); }
  function wave(peerId) { if (connected) publish(`${ROOT}/wave/${peerId}`, { from: id, n: hooks.getState().n }); }

  return { start, stop, list, wave, chat, emote, duel, EMOTES, isOn: () => wantOnline, isConnected: () => connected, cleanName, cleanText, get: pid => peers.get(pid) };
})();
