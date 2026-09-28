// Regimon GO — online mode: see other trainers live.
// Uses a tiny MQTT 3.1.1 client over WebSocket and the free public HiveMQ broker. Every player
// publishes a small presence message every 2 seconds; everyone subscribes to everyone's presence.
// What is shared: trainer name, level, neighborhood, and (in Explore mode only) the in-game position.
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
    });
  }
  function list() {
    const now = Date.now();
    for (const [k, p] of peers) if (now - p.t > STALE_MS) peers.delete(k);
    return [...peers.values()];
  }
  function wave(peerId) { if (connected) publish(`${ROOT}/wave/${peerId}`, { from: id, n: hooks.getState().n }); }

  return { start, stop, list, wave, isOn: () => wantOnline, isConnected: () => connected, cleanName };
})();
